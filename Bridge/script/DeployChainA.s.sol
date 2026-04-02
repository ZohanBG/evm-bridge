// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Bridge} from "../src/Bridge.sol";
import {GenericToken} from "../src/tokens/GenericToken.sol";
import {HelperConfig} from "./HelperConfig.s.sol";

/**
 * @title DeployChainA
 * @notice Deploys Bridge + GenericToken (KLS) on Chain A (the origin chain).
 *
 * Usage (local):
 *   forge script script/DeployChainA.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
 *
 * After running, copy the printed addresses into .env before deploying Chain B/C.
 */
contract DeployChainA is Script {
    Bridge public bridge;
    GenericToken public token;

    function run() external {
        HelperConfig helper = new HelperConfig();
        HelperConfig.ChainConfig memory cfg = helper.getChainAConfig();

        vm.startBroadcast(cfg.deployerKey);

        bridge = new Bridge(
            cfg.owner,
            cfg.chainId,
            cfg.requiredVotes,
            cfg.feeBps,
            cfg.minFeeAmount
        );

        token = new GenericToken("Kles", "KLS", cfg.initialSupply);

        bridge.addValidator(cfg.validator);

        vm.stopBroadcast();

        console.log("=== Chain A Deployed ===");
        console.log("Bridge_A       :", address(bridge));
        console.log("GenericToken   :", address(token));
        console.log("Owner/Validator:", cfg.owner);
        console.log("");
        console.log("Add to .env:");
        console.log("  BRIDGE_A=%s", address(bridge));
        console.log("  GENERIC_TOKEN_A=%s", address(token));
    }
}
