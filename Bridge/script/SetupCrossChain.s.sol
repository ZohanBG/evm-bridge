// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Bridge} from "../src/Bridge.sol";
import {HelperConfig} from "./HelperConfig.s.sol";

/**
 * @title SetupCrossChain
 * @notice Configures the triangle lock routes on Bridge A so it can bridge
 *         KLS to both Chain B and Chain C.
 *
 *  Required .env variables:
 *    BRIDGE_A, GENERIC_TOKEN_A, WRAPPED_TOKEN_B, WRAPPED_TOKEN_C
 *
 * Usage (local):
 *   forge script script/SetupCrossChain.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
 *
 * After this, Bridge A can:
 *   lock(KLS, 31338, ...) → claim wKLS on Chain B
 *   lock(KLS, 31339, ...) → claim wKLS on Chain C
 * And Bridge B/C already have burn routes registered from their deploy scripts.
 */
contract SetupCrossChain is Script {
    function run() external {
        HelperConfig helper = new HelperConfig();
        HelperConfig.ChainConfig memory cfg = helper.getChainAConfig();

        address bridgeA      = vm.envAddress("BRIDGE_A");
        address genericTokenA = vm.envAddress("GENERIC_TOKEN_A");
        address wrappedTokenB = vm.envAddress("WRAPPED_TOKEN_B");
        address wrappedTokenC = vm.envAddress("WRAPPED_TOKEN_C");

        require(bridgeA       != address(0), "BRIDGE_A missing");
        require(genericTokenA != address(0), "GENERIC_TOKEN_A missing");
        require(wrappedTokenB != address(0), "WRAPPED_TOKEN_B missing");
        require(wrappedTokenC != address(0), "WRAPPED_TOKEN_C missing");

        vm.startBroadcast(cfg.deployerKey);

        Bridge(bridgeA).registerLockRoute(
            HelperConfig(address(new HelperConfig())).CHAIN_B_ID(),
            genericTokenA,
            wrappedTokenB
        );

        Bridge(bridgeA).registerLockRoute(
            HelperConfig(address(new HelperConfig())).CHAIN_C_ID(),
            genericTokenA,
            wrappedTokenC
        );

        vm.stopBroadcast();

        console.log("=== Triangle Cross-Chain Setup Complete ===");
        console.log("Bridge A can now bridge KLS to:");
        console.log("  Chain B (31338) -> wKLS: %s", wrappedTokenB);
        console.log("  Chain C (31339) -> wKLS: %s", wrappedTokenC);
        console.log("");
        console.log("Flow summary:");
        console.log("  Lock  : A --lock(KLS, B)--> B --claim(wKLS)");
        console.log("  Return: B --burn(wKLS, A)--> A --release(KLS)");
        console.log("  Lock  : A --lock(KLS, C)--> C --claim(wKLS)");
        console.log("  Return: C --burn(wKLS, A)--> A --release(KLS)");
    }
}
