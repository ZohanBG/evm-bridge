# Bridge Backend & Indexer

NestJS backend API and blockchain event indexer for the multi-chain token bridge.

## What It Does

- **REST API** — Exposes bridge statistics, transaction history, pending claims/releases, and token data
- **Chain Indexer** — Polls all 3 chains for bridge events (lock, claim, burn, release) and stores them in PostgreSQL
- **Witness Service** — Automatically submits cross-chain witness confirmations when tokens are locked or burned
- **Swagger Docs** — Auto-generated API documentation at `/api`

## Prerequisites

- Node.js 18+
- npm
- Docker & Docker Compose (for PostgreSQL)
- Deployed bridge contracts (see [Bridge/README.md](../Bridge/README.md))

## Setup

### 1. Install Dependencies

```bash
cd Bridge-BE
npm install
```

### 2. Start PostgreSQL

```bash
docker-compose up -d postgres
```

This starts a PostgreSQL 15 container on port `5432` with database `bridge_db`.

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in the deployed contract addresses from `Bridge/.deploy-addresses`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BRIDGE_A`, `BRIDGE_B`, `BRIDGE_C` | Bridge contract addresses per chain |
| `GENERIC_TOKEN_A` | KLS token address on Chain A |
| `WRAPPED_TOKEN_B`, `WRAPPED_TOKEN_C` | wKLS token addresses on Chains B/C |
| `VALIDATOR_PRIVATE_KEY` | Private key of the registered validator (Anvil account #9 for local dev) |
| `CHAIN_*_RPC_URL` | RPC endpoints for each chain |
| `INDEXER_POLL_INTERVAL` | How often to poll for new blocks (ms) |

### 4. Run Database Migrations

```bash
npx prisma migrate dev
```

This creates the schema with tables for `BridgeEvent`, `IndexerCheckpoint`, and `WitnessSubmission`.

### 5. Generate Prisma Client

```bash
npx prisma generate
```

### 6. Start the API Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`. Swagger docs at `http://localhost:3000/api`.

### 7. Start the Indexer (separate terminal)

```bash
npm run indexer:dev
```

The indexer will begin polling all 3 chains for bridge events and automatically submit witness confirmations.

## Docker (Full Stack)

Run the entire backend (API + Indexer + PostgreSQL) with Docker:

```bash
docker-compose up -d
```

This starts:
- `bridge-postgres` — PostgreSQL database
- `bridge-api` — NestJS API server (port 3000)
- `bridge-indexer` — Event indexer + witness service

> **Note:** RPC URLs in `.env` must be accessible from inside Docker containers. For local Anvil chains, use `host.docker.internal` instead of `127.0.0.1`.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/bridge/statistics` | Bridge stats (total TXs, volume, pending claims/releases, locked/burned counts) |
| `GET` | `/bridge/events` | List bridge events with pagination and filters |
| `GET` | `/bridge/events/:hash` | Get event by transaction hash |
| `GET` | `/bridge/pending-claims/:address` | Pending claims for a user address |
| `GET` | `/bridge/pending-releases/:address` | Pending releases for a user address |
| `GET` | `/bridge/tokens` | Token statistics across chains |
| `GET` | `/health` | Health check |

## Available Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start API in watch mode |
| `npm run start:prod` | Start API in production mode |
| `npm run build` | Build the NestJS application |
| `npm run indexer:dev` | Start indexer in development mode |
| `npm run indexer:build` | Build the indexer |
| `npm run indexer:start` | Start built indexer |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio (DB GUI) |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |

## Database

Uses PostgreSQL with Prisma ORM. Key tables:

- **BridgeEvent** — All indexed bridge events (TOKEN_LOCKED, TOKEN_CLAIMED, TOKEN_BURNED, TOKEN_RELEASED)
- **IndexerCheckpoint** — Last processed block per chain (for resumable indexing)
- **WitnessSubmission** — Tracks witness submissions to prevent duplicates

### Reset Database

```bash
npx prisma migrate reset --force
```

### View Database

```bash
npx prisma studio
```

## Project Structure

```
Bridge-BE/
├── src/
│   ├── main.ts                 # App entry point
│   ├── app.module.ts           # Root module
│   ├── bridge/
│   │   ├── bridge.controller.ts  # REST API endpoints
│   │   ├── bridge.service.ts     # Business logic
│   │   └── dto/                  # Request/response DTOs
│   ├── prisma/
│   │   └── prisma.service.ts     # Database service
│   └── health/                   # Health check module
├── indexer/
│   ├── main.ts                   # Indexer entry point
│   └── services/
│       ├── ChainListener.service.ts  # Polls chains for events
│       └── Witness.service.ts        # Submits cross-chain witnesses
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Migration files
├── docker-compose.yml            # PostgreSQL + API + Indexer
├── Dockerfile                    # Multi-stage production build
└── .env.example                  # Environment template
```
