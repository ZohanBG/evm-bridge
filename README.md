# Token Bridge

A multi-chain ERC-20 token bridge enabling secure cross-chain token transfers between 3 EVM-compatible chains. Features a validator-based witness system, automated event indexing, and an interactive web interface with PixiJS 3D visualizations.

## Architecture Overview

```
         Chain A (Origin)
        ┌─────────────┐
        │  Bridge.sol  │
        │ GenericToken │◄─── KLS (native ERC-20)
        │    (KLS)     │
        └──────┬───────┘
          Lock │ ▲ Release
               │ │
     ┌─────────┴─┴──────────┐
     │    Backend Indexer    │
     │   (Witness Service)  │
     └─────┬───────────┬────┘
     Claim │           │ Claim
           ▼           ▼
  ┌─────────────┐ ┌─────────────┐
  │  Bridge.sol │ │  Bridge.sol │
  │WrappedToken │ │WrappedToken │
  │   (wKLS)    │ │   (wKLS)    │
  └─────────────┘ └─────────────┘
    Chain B           Chain C
```

### How It Works

1. **Lock** — User locks KLS tokens in Bridge A, specifying destination chain (B or C)
2. **Witness** — Backend indexer detects the lock event and submits a witness confirmation to the destination chain's Bridge
3. **Claim** — User claims wrapped tokens (wKLS) on the destination chain
4. **Burn** — User burns wKLS on the destination chain to bridge back
5. **Release** — Backend witnesses the burn, user releases original KLS on Chain A

## Repository Structure

```
BridgeTask/
├── Bridge/         # Smart contracts (Foundry/Solidity)
├── Bridge-BE/      # Backend API + Indexer (NestJS/Prisma/PostgreSQL)
├── Bridge-FE/      # Frontend web app (Next.js/React/PixiJS)
├── CLI/            # CLI tool for bridge operations
└── reset-chains.sh # Full reset: redeploy chains + update env files
```

| Project | Tech Stack | Docs |
|---|---|---|
| [Bridge/](Bridge/) | Solidity, Foundry, Anvil | [Setup Guide](Bridge/README.md) |
| [Bridge-BE/](Bridge-BE/) | NestJS 11, Prisma, PostgreSQL, ethers.js | [Setup Guide](Bridge-BE/README.md) |
| [Bridge-FE/](Bridge-FE/) | Next.js 16, React 19, wagmi, viem, PixiJS 8 | [Setup Guide](Bridge-FE/README.md) |

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, anvil, cast)
- [Node.js](https://nodejs.org/) 18+
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [MetaMask](https://metamask.io/) browser extension
- GNU Make

## Quick Start (Local Development)

### 1. Deploy Smart Contracts

```bash
cd Bridge
forge install
make deploy-local-all
```

This starts 3 local Anvil chains and deploys all contracts. Addresses are saved to `Bridge/.deploy-addresses`.

### 2. Start the Backend

```bash
cd Bridge-BE

# Start PostgreSQL
docker-compose up -d postgres

# Install deps & setup database
npm install
cp .env.example .env
# Copy contract addresses from Bridge/.deploy-addresses into .env
npx prisma migrate dev
npx prisma generate

# Start API (terminal 1)
npm run start:dev

# Start Indexer (terminal 2)
npm run indexer:dev
```

### 3. Start the Frontend

```bash
cd Bridge-FE

npm install
cp .env.example .env.local
# Copy contract addresses into .env.local

npm run dev
```

Open [http://localhost:3001](http://localhost:3001) and connect MetaMask.

### 4. Import Test Account into MetaMask

Import Anvil account #9 (deployer + token holder):
- **Private Key:** `0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6`
- **Address:** `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720`

> **Warning:** This is a publicly known test key. Never use it on mainnet.

### Quick Reset

To kill all chains, redeploy fresh, and update env files automatically:

```bash
bash Bridge/reset-chains.sh
```

## Local Chain Configuration

| Chain | Chain ID | RPC Port | Role |
|---|---|---|---|
| Chain A | 31337 | 8545 | Origin (KLS token) |
| Chain B | 31338 | 8546 | Destination (wKLS) |
| Chain C | 31339 | 8547 | Destination (wKLS) |

## Services Overview

| Service | Port | Description |
|---|---|---|
| Anvil Chain A | 8545 | Local EVM chain (origin) |
| Anvil Chain B | 8546 | Local EVM chain (destination) |
| Anvil Chain C | 8547 | Local EVM chain (destination) |
| Backend API | 3000 | REST API + Swagger docs at `/api` |
| Frontend | 3001 | Next.js web application |
| PostgreSQL | 5432 | Bridge event database |

## Docker (Backend)

Run the entire backend stack with Docker:

```bash
cd Bridge-BE
docker-compose up -d
```

This starts PostgreSQL, the API server, and the indexer. See [Bridge-BE/README.md](Bridge-BE/README.md) for details.

## Testing

```bash
# Smart contract tests
cd Bridge && forge test -vv

# Backend tests
cd Bridge-BE && npm test

# Frontend lint
cd Bridge-FE && npm run lint
```
