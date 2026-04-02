// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Bridge} from "../src/Bridge.sol";
import {GenericToken} from "../src/tokens/GenericToken.sol";
import {HelperConfig} from "./HelperConfig.s.sol";

contract ConfigureCrossChain is Script {
    function run() external {
        HelperConfig helperConfig = new HelperConfig();
        HelperConfig.SourceConfig memory config = helperConfig.getSourceConfig();

        address bridgeA = vm.envAddress("BRIDGE_A");
        address genericTokenA = vm.envAddress("GENERIC_TOKEN_A");
        address wrappedTokenB = vm.envAddress("WRAPPED_TOKEN_B");
        address owner = vm.envAddress("OWNER");

        require(bridgeA != address(0), "Missing BRIDGE_A in .env");
        require(genericTokenA != address(0), "Missing GENERIC_TOKEN_A in .env");
        require(wrappedTokenB != address(0), "Missing WRAPPED_TOKEN_B in .env");
        require(owner != address(0), "Missing OWNER in .env");

        console.log("\n=== Configuring Source Chain (A) ===");
        
        vm.startBroadcast(config.deployerKey);

        Bridge(bridgeA).registerSupportedToken(genericTokenA, wrappedTokenB);
        console.log("Token mapping registered on Bridge (A)");
        console.log("  Original (A): %s", genericTokenA);
        console.log("  Wrapped (B): %s", wrappedTokenB);

        vm.stopBroadcast();

        console.log("\n=== CROSS-CHAIN CONFIGURATION COMPLETE ===");
        console.log("Bridge A is now configured to bridge to Bridge B");
        console.log("\nReady to test lock -> claim flow!");
    }
}