// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BridgeTestBase} from "./BridgeTestBase.t.sol";
import {Bridge} from "../src/Bridge.sol";
import {GenericToken} from "../src/tokens/GenericToken.sol";
import {WrappedToken} from "../src/tokens/WrappedToken.sol";

contract BridgeTest is BridgeTestBase {

    // =========================================================================
    // Constructor / initial state
    // =========================================================================

    function test_Constructor() public view {
        assertEq(bridgeA.owner(), owner);
        assertEq(bridgeA.CHAIN_ID(), CHAIN_A_ID);
        assertEq(bridgeA.feeBps(), FEE_BPS);
        assertEq(bridgeA.requiredVotes(), REQUIRED_VOTES);
        assertEq(bridgeA.isValidator(validator), true);
        assertFalse(bridgeA.paused());
    }

    // =========================================================================
    // Ownership — 2-step transfer
    // =========================================================================

    function test_RevertsIf_NonOwner_TransferOwnership() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(NotOwner.selector, user));
        bridgeA.transferOwnership(user2);
    }

    function test_TransferOwnership_SetsPendingOwner() public {
        vm.prank(owner);
        bridgeA.transferOwnership(user2);
        assertEq(bridgeA.pendingOwner(), user2);
        assertEq(bridgeA.owner(), owner); // not changed yet
    }

    function test_RevertsIf_WrongAddress_AcceptsOwnership() public {
        vm.prank(owner);
        bridgeA.transferOwnership(user2);

        vm.prank(user); // wrong caller
        vm.expectRevert(abi.encodeWithSelector(NotPendingOwner.selector, user));
        bridgeA.acceptOwnership();
    }

    function test_AcceptOwnership_CompletesTransfer() public {
        vm.prank(owner);
        bridgeA.transferOwnership(user2);

        vm.prank(user2);
        bridgeA.acceptOwnership();

        assertEq(bridgeA.owner(), user2);
        assertEq(bridgeA.pendingOwner(), address(0));
    }

    // =========================================================================
    // Validator management
    // =========================================================================

    function test_RevertsIf_NonOwner_AddValidator() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(NotOwner.selector, user));
        bridgeA.addValidator(user2);
    }

    function test_Owner_CanAddAndRemoveValidator() public {
        vm.startPrank(owner);
        bridgeA.addValidator(user2);
        assertTrue(bridgeA.isValidator(user2));
        assertEq(bridgeA.validatorCount(), 2); // validator + user2

        bridgeA.removeValidator(user2);
        assertFalse(bridgeA.isValidator(user2));
        assertEq(bridgeA.validatorCount(), 1);
        vm.stopPrank();
    }

    function test_SetRequiredVotes() public {
        vm.startPrank(owner);
        bridgeA.addValidator(user2); // now 2 validators
        bridgeA.setRequiredVotes(2);
        assertEq(bridgeA.requiredVotes(), 2);
        vm.stopPrank();
    }

    function test_RevertsIf_RequiredVotes_ExceedsValidatorCount() public {
        // only 1 validator; asking for 2 should revert
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(InvalidRequiredVotes.selector, 2, 1));
        bridgeA.setRequiredVotes(2);
    }

    // =========================================================================
    // Fee / config management
    // =========================================================================

    function test_RevertsIf_NonOwner_SetFeeBps() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(NotOwner.selector, user));
        bridgeA.setFeeBps(50);
    }

    function test_Owner_CanSetFeeBps() public {
        vm.prank(owner);
        bridgeA.setFeeBps(50);
        assertEq(bridgeA.feeBps(), 50);
    }

    function test_RevertsIf_FeeBps_ExceedsCap() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(InvalidFee.selector, 1001, 1000));
        bridgeA.setFeeBps(1001); // > 10 %
    }

    function test_Owner_CanSetCooldown() public {
        vm.prank(owner);
        bridgeA.setCooldownPeriod(60);
        assertEq(bridgeA.cooldownPeriod(), 60);
    }

    // =========================================================================
    // Token registration
    // =========================================================================

    function test_RevertsIf_NonOwner_RegisterLockRoute() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(NotOwner.selector, user));
        bridgeA.registerLockRoute(CHAIN_B_ID, address(token), address(wrappedToken));
    }

    function test_RevertsIf_LockRoute_SameChain() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SameChainId.selector, CHAIN_A_ID));
        bridgeA.registerLockRoute(CHAIN_A_ID, address(token), address(wrappedToken));
    }

    function test_RegisterLockRoute_Succeeds() public view {
        assertEq(bridgeA.lockRoutes(CHAIN_B_ID, address(token)), address(wrappedToken));
    }

    function test_RegisterBurnRoute_Succeeds() public view {
        assertEq(bridgeB.burnRoutes(address(wrappedToken)), address(token));
    }

    // =========================================================================
    // Pause / emergency
    // =========================================================================

    function test_RevertsIf_NonOwner_Pause() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(NotOwner.selector, user));
        bridgeA.pause();
    }

    function test_Pause_BlocksLock() public {
        vm.prank(owner);
        bridgeA.pause();

        vm.startPrank(user);
        token.approve(address(bridgeA), TEST_AMOUNT);
        vm.expectRevert(BridgePaused.selector);
        bridgeA.lock(address(token), CHAIN_B_ID, TEST_AMOUNT, 0);
        vm.stopPrank();
    }

    function test_EmergencyWithdraw_RequiresPaused() public {
        vm.prank(owner);
        vm.expectRevert(BridgeNotPaused.selector);
        bridgeA.emergencyWithdraw(address(token), owner, 1);
    }

    function test_EmergencyWithdraw_DrainsFunds() public {
        // Seed bridgeA with locked tokens
        _seedBridgeA(TEST_AMOUNT);

        vm.startPrank(owner);
        bridgeA.pause();
        bridgeA.emergencyWithdraw(address(token), owner, TEST_AMOUNT);
        vm.stopPrank();

        assertEq(token.balanceOf(owner), TEST_AMOUNT);
        assertEq(token.balanceOf(address(bridgeA)), 0);
    }

    // =========================================================================
    // submitWitness — multi-validator
    // =========================================================================

    function test_RevertsIf_NonValidator_SubmitWitness() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(NotValidator.selector, user));
        bridgeB.submitWitness(bytes32("test"));
    }

    function test_SubmitWitness_ReachesThreshold() public {
        bytes32 h = keccak256("test");
        vm.prank(validator);
        bridgeB.submitWitness(h);
        assertEq(uint8(bridgeB.transactionStatuses(h)), uint8(Bridge.TxStatus.Submitted));
    }

    function test_MultiValidator_RequiresBothVotes() public {
        // Add second validator and raise threshold to 2
        vm.startPrank(owner);
        bridgeB.addValidator(user2);
        bridgeB.setRequiredVotes(2);
        vm.stopPrank();

        bytes32 h = keccak256("test");

        vm.prank(validator);
        bridgeB.submitWitness(h);
        // Only 1 vote — still None
        assertEq(uint8(bridgeB.transactionStatuses(h)), uint8(Bridge.TxStatus.None));
        assertEq(bridgeB.voteCount(h), 1);

        vm.prank(user2);
        bridgeB.submitWitness(h);
        // 2 votes — now Submitted
        assertEq(uint8(bridgeB.transactionStatuses(h)), uint8(Bridge.TxStatus.Submitted));
    }

    function test_RevertsIf_ValidatorVotesTwice() public {
        // Raise threshold to 2 so the first vote doesn't immediately set status=Submitted,
        // allowing the AlreadyVoted check to fire on the second vote.
        vm.startPrank(owner);
        bridgeB.addValidator(user2);
        bridgeB.setRequiredVotes(2);
        vm.stopPrank();

        bytes32 h = keccak256("test");
        vm.startPrank(validator);
        bridgeB.submitWitness(h);
        vm.expectRevert(abi.encodeWithSelector(AlreadyVoted.selector, h, validator));
        bridgeB.submitWitness(h);
        vm.stopPrank();
    }

    function test_RevertsIf_SubmitWitness_AlreadyProcessed() public {
        bytes32 txHash = _lock(user, TEST_AMOUNT);
        _witnessAndClaim(txHash, user, TEST_AMOUNT, TEST_FEE, 0);

        vm.prank(validator);
        vm.expectRevert(abi.encodeWithSelector(TransactionAlreadyProcessed.selector, txHash));
        bridgeB.submitWitness(txHash);
    }

    // =========================================================================
    // lock
    // =========================================================================

    function test_RevertsIf_Lock_ZeroAmount() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(InvalidAmount.selector, 0, 1));
        bridgeA.lock(address(token), CHAIN_B_ID, 0, 0);
    }

    function test_RevertsIf_Lock_ZeroAddress() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(InvalidTokenAddress.selector, address(0)));
        bridgeA.lock(address(0), CHAIN_B_ID, TEST_AMOUNT, 0);
    }

    function test_RevertsIf_Lock_SameChain() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(SameChainId.selector, CHAIN_A_ID));
        bridgeA.lock(address(token), CHAIN_A_ID, TEST_AMOUNT, 0);
    }

    function test_RevertsIf_Lock_UnregisteredToken() public {
        GenericToken other = new GenericToken("Other", "OTH", 0);
        vm.startPrank(user);
        vm.expectRevert(abi.encodeWithSelector(WrappedTokenNotRegistered.selector, address(other), CHAIN_B_ID));
        bridgeA.lock(address(other), CHAIN_B_ID, TEST_AMOUNT, 0);
        vm.stopPrank();
    }

    function test_RevertsIf_Lock_MaxFeeExceeded() public {
        // maxFee = 0.5e18 but actual fee = 1e18 → should revert
        vm.startPrank(user);
        token.approve(address(bridgeA), TEST_AMOUNT);
        vm.expectRevert(abi.encodeWithSelector(FeeExceedsMaximum.selector, TEST_FEE, 0.5e18));
        bridgeA.lock(address(token), CHAIN_B_ID, TEST_AMOUNT, 0.5e18);
        vm.stopPrank();
    }

    function test_Lock_Success() public {
        uint256 expectedFee = TEST_FEE;
        bytes32 expectedTxHash = keccak256(abi.encodePacked(
            address(wrappedToken), user, TEST_AMOUNT, expectedFee,
            CHAIN_A_ID, uint256(0), CHAIN_B_ID
        ));

        // Approve first, then place expectEmit directly before the lock call
        vm.startPrank(user);
        token.approve(address(bridgeA), TEST_AMOUNT);

        vm.expectEmit(true, true, true, true);
        emit TokenLocked(
            address(token), user, TEST_AMOUNT, expectedFee,
            CHAIN_B_ID, CHAIN_A_ID, 0, expectedTxHash
        );
        bytes32 txHash = bridgeA.lock(address(token), CHAIN_B_ID, TEST_AMOUNT, 0);
        vm.stopPrank();

        assertEq(txHash, expectedTxHash);
        assertEq(token.balanceOf(address(bridgeA)), TEST_AMOUNT);
        assertEq(token.balanceOf(user), INITIAL_SUPPLY - TEST_AMOUNT);
        assertEq(bridgeA.totalLocked(address(token)), TEST_AMOUNT);
        assertEq(bridgeA.globalNonce(), 1);
    }

    function test_Lock_CooldownPreventsSpam() public {
        // First lock with no cooldown active — this seeds lastBridgeTime[user]
        // (otherwise it stays at 0 and the test would trip the cooldown on the
        // very first call because block.timestamp starts at 1 in Foundry).
        _lock(user, TEST_AMOUNT);
        uint256 lastBridge = bridgeA.lastBridgeTime(user);

        // Now activate the cooldown for subsequent locks
        vm.prank(owner);
        bridgeA.setCooldownPeriod(60);

        // Warp to 30 seconds after the first lock — elapsed=30, remaining=30
        vm.warp(lastBridge + 30);

        vm.startPrank(user);
        token.approve(address(bridgeA), TEST_AMOUNT);
        vm.expectRevert(abi.encodeWithSelector(CooldownNotElapsed.selector, user, 30));
        bridgeA.lock(address(token), CHAIN_B_ID, TEST_AMOUNT, 0);
        vm.stopPrank();
    }

    // =========================================================================
    // claim
    // =========================================================================

    function test_RevertsIf_Claim_NotSubmitted() public {
        // The revert includes the txHash computed from the call parameters
        bytes32 expectedTxHash = keccak256(abi.encodePacked(
            address(wrappedToken), user, TEST_AMOUNT, TEST_FEE, CHAIN_A_ID, uint256(0), CHAIN_B_ID
        ));
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(TransactionNotSubmitted.selector, expectedTxHash));
        bridgeB.claim(address(wrappedToken), user, TEST_AMOUNT, TEST_FEE, CHAIN_A_ID, 0);
    }

    function test_RevertsIf_Claim_SameChain() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(SameChainId.selector, CHAIN_B_ID));
        bridgeB.claim(address(wrappedToken), user, TEST_AMOUNT, TEST_FEE, CHAIN_B_ID, 0);
    }

    function test_Claim_Success_RelayerGetsFee() public {
        bytes32 txHash = _lock(user, TEST_AMOUNT);

        vm.prank(validator);
        bridgeB.submitWitness(txHash);

        vm.prank(relayer);
        bridgeB.claim(address(wrappedToken), user, TEST_AMOUNT, TEST_FEE, CHAIN_A_ID, 0);

        assertEq(wrappedToken.balanceOf(user),    TEST_AMOUNT - TEST_FEE);
        assertEq(wrappedToken.balanceOf(relayer), TEST_FEE);
        assertEq(uint8(bridgeB.transactionStatuses(txHash)), uint8(Bridge.TxStatus.Processed));
    }

    function test_RevertsIf_Claim_AlreadyProcessed() public {
        bytes32 txHash = _lock(user, TEST_AMOUNT);
        _witnessAndClaim(txHash, user, TEST_AMOUNT, TEST_FEE, 0);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(TransactionNotSubmitted.selector, txHash));
        bridgeB.claim(address(wrappedToken), user, TEST_AMOUNT, TEST_FEE, CHAIN_A_ID, 0);
    }

    // =========================================================================
    // burn
    // =========================================================================

    function test_RevertsIf_Burn_UnregisteredToken() public {
        WrappedToken other = new WrappedToken("Other", "OTH", address(token), CHAIN_A_ID, address(bridgeB), 0);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(WrappedTokenNotRegistered.selector, address(other), CHAIN_A_ID));
        bridgeB.burn(address(other), CHAIN_A_ID, TEST_AMOUNT, 0);
    }

    function test_Burn_Success() public {
        // Give user wrapped tokens to burn
        bytes32 lockTxHash = _lock(user, TEST_AMOUNT);
        _witnessAndClaim(lockTxHash, user, TEST_AMOUNT, TEST_FEE, 0);

        uint256 userWrapped = wrappedToken.balanceOf(user); // TEST_AMOUNT - TEST_FEE

        uint256 burnFee = (userWrapped * FEE_BPS) / 10_000;
        // First burn on bridgeB — globalNonce is 0 (claim does not increment nonce)
        bytes32 expectedBurnHash = keccak256(abi.encodePacked(
            address(token), user, userWrapped, burnFee,
            CHAIN_B_ID, uint256(0), CHAIN_A_ID
        ));

        vm.expectEmit(true, true, true, true);
        emit TokenBurned(address(wrappedToken), user, userWrapped, burnFee, CHAIN_A_ID, CHAIN_B_ID, 0, expectedBurnHash);

        vm.prank(user);
        bytes32 burnTxHash = bridgeB.burn(address(wrappedToken), CHAIN_A_ID, userWrapped, 0);

        assertEq(burnTxHash, expectedBurnHash);
        assertEq(wrappedToken.balanceOf(user), 0);
        assertEq(bridgeB.globalNonce(), 1);
    }

    // =========================================================================
    // release
    // =========================================================================

    function test_RevertsIf_Release_NotSubmitted() public {
        // The revert includes the txHash computed from the call parameters
        bytes32 expectedTxHash = keccak256(abi.encodePacked(
            address(token), user, TEST_AMOUNT, TEST_FEE, CHAIN_B_ID, uint256(0), CHAIN_A_ID
        ));
        _seedBridgeA(TEST_AMOUNT);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(TransactionNotSubmitted.selector, expectedTxHash));
        bridgeA.release(address(token), user, TEST_AMOUNT, TEST_FEE, CHAIN_B_ID, 0);
    }

    function test_Release_Success_RelayerGetsFee() public {
        _seedBridgeA(TEST_AMOUNT);

        uint256 releaseNonce = 0;
        uint256 fee = TEST_FEE;
        bytes32 txHash = keccak256(abi.encodePacked(
            address(token), user, TEST_AMOUNT, fee,
            CHAIN_B_ID, releaseNonce, CHAIN_A_ID
        ));

        vm.prank(validator);
        bridgeA.submitWitness(txHash);

        uint256 userBalBefore    = token.balanceOf(user);
        uint256 relayerBalBefore = token.balanceOf(relayer);

        vm.prank(relayer);
        bridgeA.release(address(token), user, TEST_AMOUNT, fee, CHAIN_B_ID, releaseNonce);

        assertEq(token.balanceOf(user),    userBalBefore + TEST_AMOUNT - fee);
        assertEq(token.balanceOf(relayer), relayerBalBefore + fee);
        assertEq(bridgeA.totalLocked(address(token)), 0);
        assertEq(uint8(bridgeA.transactionStatuses(txHash)), uint8(Bridge.TxStatus.Processed));
    }

    // =========================================================================
    // Full round-trip: A→B→A
    // =========================================================================

    function test_FullRoundTrip() public {
        // --- Forward: lock on A, claim on B ---
        bytes32 lockTxHash = _lock(user, TEST_AMOUNT);
        _witnessAndClaim(lockTxHash, user, TEST_AMOUNT, TEST_FEE, 0);

        uint256 userWrapped = wrappedToken.balanceOf(user);
        assertEq(userWrapped, TEST_AMOUNT - TEST_FEE);

        // --- Reverse: burn on B, release on A ---
        uint256 burnNonce = bridgeB.globalNonce();
        uint256 burnFee   = (userWrapped * FEE_BPS) / 10_000;

        vm.prank(user);
        bytes32 burnTxHash = bridgeB.burn(address(wrappedToken), CHAIN_A_ID, userWrapped, 0);

        _seedBridgeA(userWrapped); // simulate locked funds available

        vm.prank(validator);
        bridgeA.submitWitness(burnTxHash);

        vm.prank(relayer);
        bridgeA.release(address(token), user, userWrapped, burnFee, CHAIN_B_ID, burnNonce);

        // User's final KLS = initial - lockAmount + (userWrapped - burnFee)
        uint256 expected = INITIAL_SUPPLY - TEST_AMOUNT + (userWrapped - burnFee);
        assertEq(token.balanceOf(user), expected);
        assertEq(wrappedToken.balanceOf(user), 0);
    }
}
