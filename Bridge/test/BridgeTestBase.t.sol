// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Bridge} from "../src/Bridge.sol";
import {GenericToken} from "../src/tokens/GenericToken.sol";
import {WrappedToken} from "../src/tokens/WrappedToken.sol";
import {IBridgeErrors} from "../src/interfaces/IBridgeErrors.sol";
import {IBridgeEvents} from "../src/interfaces/IBridgeEvents.sol";

/**
 * @title BridgeTestBase
 * @notice Shared fixtures for Bridge unit and fuzz tests.
 *
 * Topology:
 *   bridgeA (CHAIN_A_ID=1)  — holds GenericToken (KLS)
 *   bridgeB (CHAIN_B_ID=2)  — holds WrappedToken (wKLS)
 *
 * Routes registered:
 *   bridgeA.lockRoutes[2][token]    = wrappedToken  (A→B lock)
 *   bridgeB.burnRoutes[wrappedToken] = token         (B→A burn)
 */
abstract contract BridgeTestBase is Test, IBridgeErrors, IBridgeEvents {
    // --- Contracts ---
    Bridge        public bridgeA;
    Bridge        public bridgeB;
    GenericToken  public token;
    WrappedToken  public wrappedToken;

    // --- Constants ---
    uint256 public constant CHAIN_A_ID      = 1;
    uint256 public constant CHAIN_B_ID      = 2;
    uint256 public constant INITIAL_SUPPLY  = 1_000_000e18;
    uint256 public constant TEST_AMOUNT     = 100e18;
    uint256 public constant FEE_BPS         = 100;   // 1 %
    uint256 public constant MIN_FEE         = 0;
    uint256 public constant REQUIRED_VOTES  = 1;

    // fee for TEST_AMOUNT at FEE_BPS=100: 100e18 * 100 / 10000 = 1e18
    uint256 public constant TEST_FEE        = 1e18;

    // --- Actors ---
    address public owner     = makeAddr("owner");
    address public validator = makeAddr("validator");
    address public user      = makeAddr("user");
    address public user2     = makeAddr("user2");
    address public relayer   = makeAddr("relayer");

    // -------------------------------------------------------------------------
    // setUp — override with `super.setUp()` if extending further
    // -------------------------------------------------------------------------

    function setUp() public virtual {
        vm.startPrank(owner);

        bridgeA = new Bridge(owner, CHAIN_A_ID, REQUIRED_VOTES, FEE_BPS, MIN_FEE);
        bridgeB = new Bridge(owner, CHAIN_B_ID, REQUIRED_VOTES, FEE_BPS, MIN_FEE);

        token        = new GenericToken("Kles", "KLS", 0);
        wrappedToken = new WrappedToken(
            "Wrapped Kles", "wKLS",
            address(token), CHAIN_A_ID,
            address(bridgeB),
            0 // no supply cap in tests
        );

        // A→B lock route on bridgeA
        bridgeA.registerLockRoute(CHAIN_B_ID, address(token), address(wrappedToken));
        // B→A burn route on bridgeB
        bridgeB.registerBurnRoute(address(wrappedToken), address(token));

        bridgeA.addValidator(validator);
        bridgeB.addValidator(validator);

        vm.stopPrank();

        // Seed user with tokens and bridgeA with locked supply for release tests
        vm.prank(owner);
        token.mint(user, INITIAL_SUPPLY);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// Approve + lock `amount` of `token` from `from` on bridgeA targeting chainB.
    /// Returns the txHash emitted by the contract.
    function _lock(address from, uint256 amount) internal returns (bytes32 txHash) {
        vm.startPrank(from);
        token.approve(address(bridgeA), amount);
        txHash = bridgeA.lock(address(token), CHAIN_B_ID, amount, 0);
        vm.stopPrank();
    }

    /// Validator submits witness on bridgeB, then relayer claims on bridgeB.
    function _witnessAndClaim(
        bytes32 txHash,
        address to,
        uint256 amount,
        uint256 fee,
        uint256 nonce
    ) internal {
        vm.prank(validator);
        bridgeB.submitWitness(txHash);

        vm.prank(relayer);
        bridgeB.claim(address(wrappedToken), to, amount, fee, CHAIN_A_ID, nonce);
    }

    /// Full lock → witness → claim flow. Returns the witness txHash.
    function _lockAndClaim(address from, uint256 amount) internal returns (bytes32 txHash) {
        uint256 nonce = bridgeA.globalNonce();
        uint256 fee   = (amount * FEE_BPS) / 10_000;
        txHash = _lock(from, amount);
        _witnessAndClaim(txHash, from, amount, fee, nonce);
    }

    /// Seed bridgeA with `amount` of token so release tests have funds to pay out.
    function _seedBridgeA(uint256 amount) internal {
        vm.prank(owner);
        token.mint(address(bridgeA), amount);
    }
}
