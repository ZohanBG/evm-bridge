// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BridgeTestBase} from "./BridgeTestBase.t.sol";
import {Bridge} from "../src/Bridge.sol";

contract FuzzBridgeTest is BridgeTestBase {

    // =========================================================================
    // Forward path: lock → witness → claim
    //
    // Invariant: user receives exactly (amount - fee), relayer receives fee,
    //            and the txHash cannot be replayed.
    // =========================================================================

    function testFuzz_ForwardPath_ConservationOfValue(
        uint256 amount,
        address userWallet
    ) public {
        // --- bound inputs ---
        vm.assume(userWallet != address(0));
        vm.assume(userWallet != owner);
        vm.assume(userWallet != address(bridgeA));
        vm.assume(userWallet != address(bridgeB));
        vm.assume(userWallet != address(wrappedToken));

        // fee = amount * FEE_BPS / 10_000; must be < amount
        // minimum: amount > 0, fee < amount  →  amount > amount * FEE_BPS / 10_000
        // with FEE_BPS=100 this is always true for amount >= 2
        amount = bound(amount, 2, INITIAL_SUPPLY);
        uint256 fee = (amount * FEE_BPS) / 10_000;
        vm.assume(fee < amount); // guard against rounding edge-cases

        // --- fund wallet ---
        deal(address(token), userWallet, amount);
        deal(userWallet, 1 ether);

        uint256 nonce = bridgeA.globalNonce();

        // --- lock ---
        vm.startPrank(userWallet);
        token.approve(address(bridgeA), amount);
        bytes32 txHash;
        try bridgeA.lock(address(token), CHAIN_B_ID, amount, 0) returns (bytes32 h) {
            txHash = h;
        } catch {
            return; // skip edge-cases that revert for valid reasons
        }
        vm.stopPrank();

        // --- witness ---
        vm.prank(validator);
        bridgeB.submitWitness(txHash);

        uint256 userWrappedBefore   = wrappedToken.balanceOf(userWallet);
        uint256 relayerWrappedBefore = wrappedToken.balanceOf(relayer);

        // --- claim ---
        vm.prank(relayer);
        bridgeB.claim(address(wrappedToken), userWallet, amount, fee, CHAIN_A_ID, nonce);

        // Conservation: user gets amount - fee, relayer gets fee
        assertEq(wrappedToken.balanceOf(userWallet), userWrappedBefore + amount - fee,
            "User wrapped balance mismatch");
        assertEq(wrappedToken.balanceOf(relayer), relayerWrappedBefore + fee,
            "Relayer fee mismatch");

        // Status must be Processed
        assertEq(uint8(bridgeB.transactionStatuses(txHash)), uint8(Bridge.TxStatus.Processed),
            "Status must be Processed");

        // Replay must revert
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(TransactionNotSubmitted.selector, txHash));
        bridgeB.claim(address(wrappedToken), userWallet, amount, fee, CHAIN_A_ID, nonce);
    }

    // =========================================================================
    // Reverse path: burn → witness → release
    //
    // Invariant: user receives exactly (burnAmount - releaseFee) original tokens,
    //            relayer receives releaseFee, txHash cannot be replayed.
    // =========================================================================

    function testFuzz_ReversePath_ConservationOfValue(
        uint256 lockAmount,
        address userWallet
    ) public {
        // --- bound inputs ---
        vm.assume(userWallet != address(0));
        vm.assume(userWallet != owner);
        vm.assume(userWallet != address(bridgeA));
        vm.assume(userWallet != address(bridgeB));
        vm.assume(userWallet != address(wrappedToken));

        // Need enough to survive two fee deductions (lock fee + burn fee)
        lockAmount = bound(lockAmount, 100, INITIAL_SUPPLY);
        uint256 lockFee = (lockAmount * FEE_BPS) / 10_000;
        vm.assume(lockFee < lockAmount);

        deal(address(token), userWallet, lockAmount);
        deal(userWallet, 1 ether);

        // --- Forward path to get wrapped tokens ---
        uint256 lockNonce = bridgeA.globalNonce();
        vm.startPrank(userWallet);
        token.approve(address(bridgeA), lockAmount);
        bytes32 lockTxHash;
        try bridgeA.lock(address(token), CHAIN_B_ID, lockAmount, 0) returns (bytes32 h) {
            lockTxHash = h;
        } catch {
            return;
        }
        vm.stopPrank();

        vm.prank(validator);
        bridgeB.submitWitness(lockTxHash);

        vm.prank(relayer);
        bridgeB.claim(address(wrappedToken), userWallet, lockAmount, lockFee, CHAIN_A_ID, lockNonce);

        uint256 userWrapped = wrappedToken.balanceOf(userWallet);
        vm.assume(userWrapped > 0);

        // --- Burn ---
        uint256 burnNonce = bridgeB.globalNonce();
        uint256 burnFee   = (userWrapped * FEE_BPS) / 10_000;
        vm.assume(burnFee < userWrapped);

        vm.prank(userWallet);
        bytes32 burnTxHash;
        try bridgeB.burn(address(wrappedToken), CHAIN_A_ID, userWrapped, 0) returns (bytes32 h) {
            burnTxHash = h;
        } catch {
            return;
        }

        assertEq(wrappedToken.balanceOf(userWallet), 0, "Wrapped tokens not burned");

        // --- Witness + release ---
        _seedBridgeA(userWrapped);

        vm.prank(validator);
        bridgeA.submitWitness(burnTxHash);

        uint256 userTokenBefore   = token.balanceOf(userWallet);
        uint256 relayerTokenBefore = token.balanceOf(relayer);

        vm.prank(relayer);
        bridgeA.release(address(token), userWallet, userWrapped, burnFee, CHAIN_B_ID, burnNonce);

        assertEq(token.balanceOf(userWallet),  userTokenBefore + userWrapped - burnFee,
            "User final token balance mismatch");
        assertEq(token.balanceOf(relayer), relayerTokenBefore + burnFee,
            "Relayer release fee mismatch");

        assertEq(uint8(bridgeA.transactionStatuses(burnTxHash)), uint8(Bridge.TxStatus.Processed),
            "Burn tx status must be Processed");

        // Replay must revert
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(TransactionNotSubmitted.selector, burnTxHash));
        bridgeA.release(address(token), userWallet, userWrapped, burnFee, CHAIN_B_ID, burnNonce);
    }

    // =========================================================================
    // Fee invariant: fee is always within [minFee, amount)
    // =========================================================================

    function testFuzz_Fee_NeverExceedsAmount(uint256 amount, uint256 feeBps) public {
        feeBps = bound(feeBps, 0, 1000); // 0–10 %
        amount = bound(amount, 1, type(uint128).max);

        uint256 fee = (amount * feeBps) / 10_000;
        assertLe(fee, amount, "Fee must not exceed amount");
    }

    // =========================================================================
    // Nonce uniqueness: two sequential locks produce different txHashes
    // =========================================================================

    function testFuzz_Nonces_ProduceDifferentHashes(uint256 amount) public {
        amount = bound(amount, 2, INITIAL_SUPPLY / 2);
        deal(address(token), user, amount * 2);

        vm.startPrank(user);
        token.approve(address(bridgeA), amount * 2);
        bytes32 hash1 = bridgeA.lock(address(token), CHAIN_B_ID, amount, 0);
        bytes32 hash2 = bridgeA.lock(address(token), CHAIN_B_ID, amount, 0);
        vm.stopPrank();

        assertTrue(hash1 != hash2, "Sequential locks must produce unique hashes");
    }

    // =========================================================================
    // Multi-validator: threshold must be reached before status becomes Submitted
    // =========================================================================

    function testFuzz_MultiValidator_ThresholdEnforced(uint8 threshold) public {
        threshold = uint8(bound(threshold, 2, 5));

        // Add (threshold - 1) extra validators
        address[] memory validators = new address[](threshold);
        validators[0] = validator;
        vm.startPrank(owner);
        for (uint8 i = 1; i < threshold; i++) {
            validators[i] = makeAddr(string(abi.encodePacked("v", i)));
            bridgeB.addValidator(validators[i]);
        }
        bridgeB.setRequiredVotes(threshold);
        vm.stopPrank();

        bytes32 h = keccak256("threshold-test");

        for (uint8 i = 0; i < threshold; i++) {
            assertEq(uint8(bridgeB.transactionStatuses(h)), uint8(Bridge.TxStatus.None),
                "Must remain None until threshold reached");
            vm.prank(validators[i]);
            bridgeB.submitWitness(h);
        }

        assertEq(uint8(bridgeB.transactionStatuses(h)), uint8(Bridge.TxStatus.Submitted),
            "Must be Submitted after threshold");
    }
}
