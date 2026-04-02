// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Bridge} from "../src/Bridge.sol";
import {WrappedToken} from "../src/tokens/WrappedToken.sol";
import {HelperConfig} from "./HelperConfig.s.sol";

contract DeployDestinationChain is Script {
    HelperConfig helperConfig;

    Bridge public bridgeB;
    WrappedToken public wrappedTokenB;

    function run() external {
        helperConfig = new HelperConfig();
        HelperConfig.DestConfig memory config = helperConfig.getDestConfig();

        require(config.genericTokenAAddress != address(0), "Missing genericTokenAAddress in config");

        vm.startBroadcast(config.deployerKey);

        bridgeB = new Bridge(
            config.owner,
            config.sourceChainId,
            config.destChainId
        );
        console.log("--- Destination Chain (B) Deployed ---");
        console.log("Bridge (B) deployed to:", address(bridgeB));

        wrappedTokenB = new WrappedToken(
            "Wrapped Kles",
            "wKLS",
            config.genericTokenAAddress,
            config.sourceChainId,
            address(bridgeB),
            config.initialSupply // cap wrapped supply to match origin token supply
        );
        console.log("WrappedToken (B) deployed to:", address(wrappedTokenB));

        bridgeB.registerSupportedToken(
            config.genericTokenAAddress,
            address(wrappedTokenB)
        );
        console.log("Token mapping registered on Bridge (B)");
        console.log("  Original (A): %s", config.genericTokenAAddress);
        console.log("  Wrapped (B): %s", address(wrappedTokenB));

        bridgeB.addValidator(config.validator);
        console.log("Validator added to Bridge (B):", config.validator);

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("Bridge (B): %s", address(bridgeB));
        console.log("WrappedToken (B): %s", address(wrappedTokenB));
        console.log("\n=== NEXT STEP ===");
        console.log("Add WRAPPED_TOKEN_B to your .env file:");
        console.log("WRAPPED_TOKEN_B=%s", address(wrappedTokenB));
        console.log("\nThen run: make configure-cross-chain");
    }
}