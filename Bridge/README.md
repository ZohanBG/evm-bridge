# Bridge Smart Contracts

Solidity smart contracts for a multi-chain ERC-20 token bridge, built with [Foundry](https://book.getfoundry.sh/).

## Architecture

The bridge operates in a **3-chain triangle** topology:

- **Chain A** (origin) — holds the native `GenericToken` (KLS). Tokens are **locked** here when bridging outward.
- **Chain B & C** (destination) — hold `WrappedToken` (wKLS). Tokens are **minted** on arrival and **burned** when bridging back.

### Contracts

| Contract | Description |
|---|---|
| `Bridge.sol` | Core bridge logic — lock, claim, burn, release with validator-based witness system |
| `GenericToken.sol` | Standard ERC-20 token deployed on the origin chain |
| `WrappedToken.sol` | Mintable/burnable ERC-20 deployed on destination chains, controlled by the Bridge |
| `BridgeInternal.sol` | Internal library for bridge state management |

### Bridge Flow

```
Lock (Chain A)       --> Validator witnesses --> Claim / Mint (Chain B or C)
Burn (Chain B or C)  --> Validator witnesses --> Release / Unlock (Chain A)
```

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `anvil`, `cast`)
- GNU Make

## Quick Start

```bash
# Install dependencies
forge install

# Run tests
forge test -vv

# Run fuzz tests
forge test --match-contract FuzzBridge -vvv

# Gas snapshot
forge snapshot
```

## Local Deployment (3 Anvil Chains)

### One Command (Recommended)

```bash
make deploy-local-all
```

This will:
1. Start Anvil on ports `8545` (Chain A), `8546` (Chain B), `8547` (Chain C)
2. Deploy `Bridge` + `GenericToken` on Chain A
3. Deploy `Bridge` + `WrappedToken` on Chains B and C
4. Configure triangle cross-chain lock routes
5. Write all deployed addresses to `.deploy-addresses`

After deployment, copy the addresses from `.deploy-addresses` into `Bridge-BE/.env` and `Bridge-FE/.env.local`.

> **Tip:** The root-level `reset-chains.sh` script automates address copying to BE and FE env files.

### Step-by-Step (Manual)

```bash
# Start chains individually
make anvil-a    # port 8545, chainId 31337
make anvil-b    # port 8546, chainId 31338
make anvil-c    # port 8547, chainId 31339

# Deploy individually (order matters)
make deploy-a
make deploy-b   # requires GENERIC_TOKEN_A in .env
make deploy-c   # requires GENERIC_TOKEN_A in .env
make setup-cross-chain  # requires all bridge + token addresses in .env
```

### Reset Everything

```bash
# Kill chains, wipe state, redeploy fresh
make reset

# Just clean up (stop Anvil, remove artifacts)
make clean
```

## Testnet Deployment

```bash
# Set environment variables for your target chains
export CHAIN_A_RPC_URL=https://...
export CHAIN_A_ETHERSCAN_KEY=...
export CHAIN_A_ID=11155111

# Deploy with contract verification
make deploy-testnet-a
make deploy-testnet-b
make deploy-testnet-c
make setup-cross-chain-testnet
```

## Configuration

Default parameters are in `script/HelperConfig.s.sol`:

| Parameter | Default | Description |
|---|---|---|
| Fee | 0.3% (30 bps) | Bridge fee percentage |
| Min Fee | 0 | Minimum fee in token units |
| Required Votes | 1 | Validator confirmations needed |
| Initial Supply | 1,000,000 KLS | GenericToken initial mint to deployer |

## Project Structure

```
Bridge/
├── src/
│   ├── Bridge.sol                # Core bridge contract
│   ├── tokens/
│   │   ├── GenericToken.sol       # ERC-20 origin token
│   │   └── WrappedToken.sol       # Mintable/burnable wrapped token
│   ├── interfaces/
│   │   ├── IBridgeErrors.sol      # Custom error definitions
│   │   ├── IBridgeEvents.sol      # Event definitions
│   │   └── IWrappedToken.sol      # Wrapped token interface
│   └── libraries/
│       └── BridgeInternal.sol     # Internal helper library
├── script/
│   ├── DeployChainA.s.sol         # Deploy origin chain
│   ├── DeployChainB.s.sol         # Deploy destination chain B
│   ├── DeployChainC.s.sol         # Deploy destination chain C
│   ├── SetupCrossChain.s.sol      # Configure cross-chain routes
│   └── HelperConfig.s.sol         # Deployment configuration
├── test/
│   ├── Bridge.t.sol               # Unit tests
│   ├── BridgeTestBase.t.sol       # Test helpers / base contract
│   └── FuzzBridge.t.sol           # Fuzz tests
└── Makefile                       # Build & deploy automation
```

## Anvil Test Accounts

For local development, the contracts use Anvil's default pre-funded accounts:

- **Account #9** (`0xa0Ee7A142d267C1f36714E4a8F75612F20a79720`) is used as the deployer, validator, and initial token holder.
- Private key: `0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6`

> **Warning:** Never use Anvil private keys on mainnet or public testnets with real funds.
