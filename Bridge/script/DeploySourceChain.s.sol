// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Bridge} from "../src/Bridge.sol";
import {GenericToken} from "../src/tokens/GenericToken.sol";
import {HelperConfig} from "./HelperConfig.s.sol";

contract DeploySourceChain is Script {
    HelperConfig helperConfig;

    Bridge public bridgeA;
    GenericToken public genericTokenA;

    function run() external {
        helperConfig = new HelperConfig();
        HelperConfig.SourceConfig memory config = helperConfig.getSourceConfig();

        vm.startBroadcast(config.deployerKey);

        bridgeA = new Bridge(
            config.owner,
            config.sourceChainId,
            config.destChainId
        );
        console.log("--- Source Chain (A) Deployed ---");
        console.log("Bridge (A) deployed to:", address(bridgeA));

        genericTokenA = new GenericToken(
            "Kles",
            "KLS",
            config.initialSupply
        );
        console.log("GenericToken (A) deployed to:", address(genericTokenA));

        bridgeA.addValidator(config.validator);
        console.log("Validator added to Bridge (A):", config.validator);

        vm.stopBroadcast();

        console.log("\n=== IMPORTANT ===");
        console.log("Copy this address and add it to your .env file:");
        console.log("LOCAL_GENERIC_TOKEN_A_ADDRESS=", address(genericTokenA));
        console.log("\n=== NEXT STEP ===");
        console.log("1. Update .env with the address above");
        console.log("2. Deploy destination chain: make deploy-local-dest");
        console.log("3. Get WRAPPED_TOKEN_B address from destination deployment");
        console.log("4. Run: cast send <BRIDGE_A> \"registerSupportedToken(address,address)\" <GENERIC_TOKEN_A> <WRAPPED_TOKEN_B> --rpc-url http://127.0.0.1:8545 --private-key <OWNER_KEY>");
        console.log("\n--- Deployment of Chain (A) Complete ---");
        console.log("Bridge_A_Address:", address(bridgeA));
        console.log("GenericToken_A_Address:", address(genericTokenA));
    }
}