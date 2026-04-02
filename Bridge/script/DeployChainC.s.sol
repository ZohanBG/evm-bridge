// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Bridge} from "../src/Bridge.sol";
import {WrappedToken} from "../src/tokens/WrappedToken.sol";
import {HelperConfig} from "./HelperConfig.s.sol";

/**
 * @title DeployChainC
 * @notice Deploys Bridge + WrappedToken (wKLS) on Chain C.
 *
 * Prerequisites:
 *   GENERIC_TOKEN_A must be set in .env (from DeployChainA output)
 *
 * Usage (local):
 *   forge script script/DeployChainC.s.sol --rpc-url http://127.0.0.1:8547 --broadcast
 */
contract DeployChainC is Script {
    Bridge public bridge;
    WrappedToken public wrappedToken;

    function run() external {
        HelperConfig helper = new HelperConfig();
        HelperConfig.DestChainConfig memory cfg = helper.getChainCConfig();

        require(cfg.genericTokenAAddress != address(0), "GENERIC_TOKEN_A not set in .env");

        vm.startBroadcast(cfg.deployerKey);

        bridge = new Bridge(
            cfg.owner,
            cfg.chainId,
            cfg.requiredVotes,
            cfg.feeBps,
            cfg.minFeeAmount
        );

        wrappedToken = new WrappedToken(
            "Wrapped Kles",
            "wKLS",
            cfg.genericTokenAAddress,
            HelperConfig(address(new HelperConfig())).CHAIN_A_ID(),
            address(bridge),
            HelperConfig(address(new HelperConfig())).INITIAL_TOKEN_SUPPLY()
        );

        // Register burn route on Chain C: burning wKLS unlocks KLS on Chain A
        bridge.registerBurnRoute(address(wrappedToken), cfg.genericTokenAAddress);
        bridge.addValidator(cfg.validator);

        vm.stopBroadcast();

        console.log("=== Chain C Deployed ===");
        console.log("Bridge_C     :", address(bridge));
        console.log("WrappedToken :", address(wrappedToken));
        console.log("");
        console.log("Add to .env:");
        console.log("  BRIDGE_C=%s", address(bridge));
        console.log("  WRAPPED_TOKEN_C=%s", address(wrappedToken));
    }
}
