// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DeployChainA} from "../../script/DeployChainA.s.sol";
import {DeployChainB} from "../../script/DeployChainB.s.sol";
import {DeployChainC} from "../../script/DeployChainC.s.sol";
import {SetupCrossChain} from "../../script/SetupCrossChain.s.sol";
import {HelperConfig} from "../../script/HelperConfig.s.sol";
import {Bridge} from "../../src/Bridge.sol";
import {GenericToken} from "../../src/tokens/GenericToken.sol";
import {WrappedToken} from "../../src/tokens/WrappedToken.sol";

contract DeployScriptTest is Test {
    HelperConfig public helperConfig;

    // Script instances (exposed public state via updated scripts)
    DeployChainA    public deployA;
    DeployChainB    public deployB;
    DeployChainC    public deployC;
    SetupCrossChain public setupScript;

    // Mock addresses for public-testnet HelperConfig tests
    address public constant MOCK_OWNER     = address(0x1);
    address public constant MOCK_VALIDATOR = address(0x2);
    address public constant MOCK_TOKEN     = address(0x3);
    uint256 public constant MOCK_PRIV_KEY  = 0x123;
    uint256 public constant MOCK_CHAIN_ID  = 11155111; // Sepolia

    function setUp() public {
        helperConfig = new HelperConfig();
        deployA      = new DeployChainA();
        deployB      = new DeployChainB();
        deployC      = new DeployChainC();
        setupScript  = new SetupCrossChain();
    }

    // =========================================================================
    // Chain A deployment
    // =========================================================================

    function test_DeployChainA_Anvil() public {
        vm.chainId(helperConfig.CHAIN_A_ID());

        deployA.run();

        Bridge       bridge = deployA.bridge();
        GenericToken tok    = deployA.token();

        HelperConfig.ChainConfig memory cfg = helperConfig.getChainAConfig();

        assertNotEq(address(bridge), address(0), "Bridge A not deployed");
        assertNotEq(address(tok),    address(0), "GenericToken not deployed");
        assertEq(bridge.owner(),                 cfg.owner);
        assertEq(bridge.CHAIN_ID(),              cfg.chainId);
        assertEq(bridge.feeBps(),                cfg.feeBps);
        assertEq(bridge.requiredVotes(),         cfg.requiredVotes);
        assertEq(bridge.isValidator(cfg.validator), true);
        assertEq(tok.totalSupply(),              cfg.initialSupply);
    }

    // =========================================================================
    // Chain B deployment
    // =========================================================================

    function test_DeployChainB_Anvil() public {
        // Deploy A first to get GenericToken address
        vm.chainId(helperConfig.CHAIN_A_ID());
        deployA.run();
        address tokenA = address(deployA.token());

        // Set env for Chain B deploy
        vm.setEnv("GENERIC_TOKEN_A", vm.toString(tokenA));
        vm.chainId(helperConfig.CHAIN_B_ID());
        deployB.run();

        Bridge       bridgeB  = deployB.bridge();
        WrappedToken wrappedB = deployB.wrappedToken();

        HelperConfig.DestChainConfig memory cfg = helperConfig.getChainBConfig();

        assertNotEq(address(bridgeB),  address(0), "Bridge B not deployed");
        assertNotEq(address(wrappedB), address(0), "WrappedToken B not deployed");
        assertEq(bridgeB.owner(),                  cfg.owner);
        assertEq(bridgeB.CHAIN_ID(),               cfg.chainId);
        assertEq(bridgeB.isValidator(cfg.validator), true);

        // Burn route registered by DeployChainB
        assertEq(bridgeB.burnRoutes(address(wrappedB)), tokenA,
            "Burn route not registered on Bridge B");

        // WrappedToken ownership
        assertEq(wrappedB.owner(),          address(bridgeB), "WrappedToken owner must be Bridge B");
        assertEq(wrappedB.ORIGINAL_TOKEN(), tokenA,           "Original token mismatch");
        assertEq(wrappedB.name(),           "Wrapped Kles");
        assertEq(wrappedB.symbol(),         "wKLS");
    }

    // =========================================================================
    // Chain C deployment
    // =========================================================================

    function test_DeployChainC_Anvil() public {
        vm.chainId(helperConfig.CHAIN_A_ID());
        deployA.run();
        address tokenA = address(deployA.token());

        vm.setEnv("GENERIC_TOKEN_A", vm.toString(tokenA));
        vm.chainId(helperConfig.CHAIN_C_ID());
        deployC.run();

        Bridge       bridgeC  = deployC.bridge();
        WrappedToken wrappedC = deployC.wrappedToken();

        assertNotEq(address(bridgeC),  address(0), "Bridge C not deployed");
        assertNotEq(address(wrappedC), address(0), "WrappedToken C not deployed");
        assertEq(bridgeC.CHAIN_ID(),   helperConfig.CHAIN_C_ID());
        assertEq(bridgeC.burnRoutes(address(wrappedC)), tokenA,
            "Burn route not registered on Bridge C");
    }

    // =========================================================================
    // SetupCrossChain — triangle lock routes on Bridge A
    // =========================================================================

    function test_SetupCrossChain_RegistersTriangleRoutes() public {
        // Deploy all three chains
        vm.chainId(helperConfig.CHAIN_A_ID());
        deployA.run();
        address bridgeAAddr = address(deployA.bridge());
        address tokenA      = address(deployA.token());

        vm.setEnv("GENERIC_TOKEN_A", vm.toString(tokenA));

        vm.chainId(helperConfig.CHAIN_B_ID());
        deployB.run();
        address wrappedB = address(deployB.wrappedToken());

        vm.chainId(helperConfig.CHAIN_C_ID());
        deployC.run();
        address wrappedC = address(deployC.wrappedToken());

        // Provide env vars for SetupCrossChain
        // Re-set GENERIC_TOKEN_A here in case a prior test (e.g. test_HelperConfig_PublicChainB)
        // overwrote it with a mock value.
        vm.setEnv("GENERIC_TOKEN_A", vm.toString(tokenA));
        vm.setEnv("BRIDGE_A",        vm.toString(bridgeAAddr));
        vm.setEnv("WRAPPED_TOKEN_B", vm.toString(wrappedB));
        vm.setEnv("WRAPPED_TOKEN_C", vm.toString(wrappedC));

        // Run on Chain A
        vm.chainId(helperConfig.CHAIN_A_ID());
        setupScript.run();

        Bridge bridgeA = Bridge(bridgeAAddr);

        assertEq(
            bridgeA.lockRoutes(helperConfig.CHAIN_B_ID(), tokenA), wrappedB,
            "Lock route A->B not set"
        );
        assertEq(
            bridgeA.lockRoutes(helperConfig.CHAIN_C_ID(), tokenA), wrappedC,
            "Lock route A->C not set"
        );
    }

    // =========================================================================
    // HelperConfig — public testnet configs
    // =========================================================================

    function test_HelperConfig_PublicChainA() public {
        vm.chainId(MOCK_CHAIN_ID);

        vm.setEnv("CHAIN_A_OWNER",    vm.toString(MOCK_OWNER));
        vm.setEnv("CHAIN_A_VALIDATOR", vm.toString(MOCK_VALIDATOR));
        vm.setEnv("CHAIN_A_ID",       vm.toString(MOCK_CHAIN_ID));
        vm.setEnv("FEE_BPS",          "30");
        vm.setEnv("REQUIRED_VOTES",   "2");
        vm.setEnv("PRIVATE_KEY",      vm.toString(MOCK_PRIV_KEY));
        vm.setEnv("CHAIN_A_RPC_URL",  "http://mock-rpc-a.com");

        HelperConfig.ChainConfig memory cfg = helperConfig.getChainAConfig();

        assertEq(cfg.owner,         MOCK_OWNER);
        assertEq(cfg.validator,     MOCK_VALIDATOR);
        assertEq(cfg.chainId,       MOCK_CHAIN_ID);
        assertEq(cfg.feeBps,        30);
        assertEq(cfg.requiredVotes, 2);
        assertEq(cfg.deployerKey,   MOCK_PRIV_KEY);
        assertEq(cfg.rpcUrl,        "http://mock-rpc-a.com");
    }

    function test_HelperConfig_PublicChainB() public {
        vm.chainId(MOCK_CHAIN_ID);

        vm.setEnv("CHAIN_B_OWNER",    vm.toString(MOCK_OWNER));
        vm.setEnv("CHAIN_B_VALIDATOR", vm.toString(MOCK_VALIDATOR));
        vm.setEnv("CHAIN_B_ID",       vm.toString(uint256(421614)));
        vm.setEnv("PRIVATE_KEY",      vm.toString(MOCK_PRIV_KEY));
        vm.setEnv("CHAIN_B_RPC_URL",  "http://mock-rpc-b.com");
        vm.setEnv("GENERIC_TOKEN_A",  vm.toString(MOCK_TOKEN));

        HelperConfig.DestChainConfig memory cfg = helperConfig.getChainBConfig();

        assertEq(cfg.owner,                MOCK_OWNER);
        assertEq(cfg.validator,            MOCK_VALIDATOR);
        assertEq(cfg.genericTokenAAddress, MOCK_TOKEN);
        assertEq(cfg.deployerKey,          MOCK_PRIV_KEY);
        assertEq(cfg.rpcUrl,               "http://mock-rpc-b.com");
    }
}
