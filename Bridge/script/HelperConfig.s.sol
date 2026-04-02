// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";

/**
 * @title HelperConfig
 * @notice Provides typed configuration structs for all three local Anvil chains
 *         as well as public testnet deployments.
 *
 *  Chain A  — chainId 31337, port 8545  (original token KLS)
 *  Chain B  — chainId 31338, port 8546  (wrapped wKLS from A)
 *  Chain C  — chainId 31339, port 8547  (wrapped wKLS from A)
 */
contract HelperConfig is Script {
    // Default Anvil funded private key (index 9 — avoid index 0 to keep deployer separate)
    uint256 public constant DEFAULT_ANVIL_KEY =
        0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6;

    uint256 public constant CHAIN_A_ID = 31337;
    uint256 public constant CHAIN_B_ID = 31338;
    uint256 public constant CHAIN_C_ID = 31339;

    uint256 public constant INITIAL_TOKEN_SUPPLY = 1_000_000 * 1e18;
    uint256 public constant DEFAULT_FEE_BPS     = 30;   // 0.3 %
    uint256 public constant DEFAULT_MIN_FEE     = 0;
    uint256 public constant DEFAULT_REQ_VOTES   = 1;    // single-validator for local dev

    // -----------------------------------------------------------------------
    // Chain-generic config (same shape for all chains)
    // -----------------------------------------------------------------------

    struct ChainConfig {
        address owner;
        address validator;
        uint256 chainId;
        uint256 feeBps;
        uint256 minFeeAmount;
        uint256 requiredVotes;
        uint256 initialSupply;
        uint256 deployerKey;
        string  rpcUrl;
    }

    struct DestChainConfig {
        address owner;
        address validator;
        uint256 chainId;
        uint256 feeBps;
        uint256 minFeeAmount;
        uint256 requiredVotes;
        uint256 deployerKey;
        string  rpcUrl;
        address genericTokenAAddress; // needed to create WrappedToken
    }

    // -----------------------------------------------------------------------
    // Local Anvil configs
    // -----------------------------------------------------------------------

    function getChainAConfig() public view returns (ChainConfig memory cfg) {
        if (block.chainid == CHAIN_A_ID) {
            return _anvilChainAConfig();
        }
        return _publicChainAConfig();
    }

    function getChainBConfig() public view returns (DestChainConfig memory cfg) {
        if (block.chainid == CHAIN_B_ID) {
            return _anvilChainBConfig();
        }
        return _publicChainBConfig();
    }

    function getChainCConfig() public view returns (DestChainConfig memory cfg) {
        if (block.chainid == CHAIN_C_ID) {
            return _anvilChainCConfig();
        }
        return _publicChainCConfig();
    }

    // -----------------------------------------------------------------------
    // Anvil implementations
    // -----------------------------------------------------------------------

    function _anvilChainAConfig() internal pure returns (ChainConfig memory) {
        address addr = vm.addr(DEFAULT_ANVIL_KEY);
        return ChainConfig({
            owner:         addr,
            validator:     addr,
            chainId:       CHAIN_A_ID,
            feeBps:        DEFAULT_FEE_BPS,
            minFeeAmount:  DEFAULT_MIN_FEE,
            requiredVotes: DEFAULT_REQ_VOTES,
            initialSupply: INITIAL_TOKEN_SUPPLY,
            deployerKey:   DEFAULT_ANVIL_KEY,
            rpcUrl:        "http://127.0.0.1:8545"
        });
    }

    function _anvilChainBConfig() internal view returns (DestChainConfig memory) {
        address addr = vm.addr(DEFAULT_ANVIL_KEY);
        address tokenA = vm.envAddress("GENERIC_TOKEN_A");
        return DestChainConfig({
            owner:                addr,
            validator:            addr,
            chainId:              CHAIN_B_ID,
            feeBps:               DEFAULT_FEE_BPS,
            minFeeAmount:         DEFAULT_MIN_FEE,
            requiredVotes:        DEFAULT_REQ_VOTES,
            deployerKey:          DEFAULT_ANVIL_KEY,
            rpcUrl:               "http://127.0.0.1:8546",
            genericTokenAAddress: tokenA
        });
    }

    function _anvilChainCConfig() internal view returns (DestChainConfig memory) {
        address addr = vm.addr(DEFAULT_ANVIL_KEY);
        address tokenA = vm.envAddress("GENERIC_TOKEN_A");
        return DestChainConfig({
            owner:                addr,
            validator:            addr,
            chainId:              CHAIN_C_ID,
            feeBps:               DEFAULT_FEE_BPS,
            minFeeAmount:         DEFAULT_MIN_FEE,
            requiredVotes:        DEFAULT_REQ_VOTES,
            deployerKey:          DEFAULT_ANVIL_KEY,
            rpcUrl:               "http://127.0.0.1:8547",
            genericTokenAAddress: tokenA
        });
    }

    // -----------------------------------------------------------------------
    // Public testnet implementations
    // -----------------------------------------------------------------------

    function _publicChainAConfig() internal view returns (ChainConfig memory) {
        return ChainConfig({
            owner:         vm.envAddress("CHAIN_A_OWNER"),
            validator:     vm.envAddress("CHAIN_A_VALIDATOR"),
            chainId:       vm.envUint("CHAIN_A_ID"),
            feeBps:        vm.envOr("FEE_BPS", DEFAULT_FEE_BPS),
            minFeeAmount:  vm.envOr("MIN_FEE_AMOUNT", uint256(0)),
            requiredVotes: vm.envOr("REQUIRED_VOTES", DEFAULT_REQ_VOTES),
            initialSupply: INITIAL_TOKEN_SUPPLY,
            deployerKey:   vm.envUint("PRIVATE_KEY"),
            rpcUrl:        vm.envString("CHAIN_A_RPC_URL")
        });
    }

    function _publicChainBConfig() internal view returns (DestChainConfig memory) {
        return DestChainConfig({
            owner:                vm.envAddress("CHAIN_B_OWNER"),
            validator:            vm.envAddress("CHAIN_B_VALIDATOR"),
            chainId:              vm.envUint("CHAIN_B_ID"),
            feeBps:               vm.envOr("FEE_BPS", DEFAULT_FEE_BPS),
            minFeeAmount:         vm.envOr("MIN_FEE_AMOUNT", uint256(0)),
            requiredVotes:        vm.envOr("REQUIRED_VOTES", DEFAULT_REQ_VOTES),
            deployerKey:          vm.envUint("PRIVATE_KEY"),
            rpcUrl:               vm.envString("CHAIN_B_RPC_URL"),
            genericTokenAAddress: vm.envAddress("GENERIC_TOKEN_A")
        });
    }

    function _publicChainCConfig() internal view returns (DestChainConfig memory) {
        return DestChainConfig({
            owner:                vm.envAddress("CHAIN_C_OWNER"),
            validator:            vm.envAddress("CHAIN_C_VALIDATOR"),
            chainId:              vm.envUint("CHAIN_C_ID"),
            feeBps:               vm.envOr("FEE_BPS", DEFAULT_FEE_BPS),
            minFeeAmount:         vm.envOr("MIN_FEE_AMOUNT", uint256(0)),
            requiredVotes:        vm.envOr("REQUIRED_VOTES", DEFAULT_REQ_VOTES),
            deployerKey:          vm.envUint("PRIVATE_KEY"),
            rpcUrl:               vm.envString("CHAIN_C_RPC_URL"),
            genericTokenAAddress: vm.envAddress("GENERIC_TOKEN_A")
        });
    }
}
