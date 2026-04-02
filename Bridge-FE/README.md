# Bridge Frontend

Next.js web application for the multi-chain token bridge, featuring an interactive PixiJS visualization.

## Features

- **Bridge Tokens** — Lock tokens on Chain A to mint wrapped tokens on Chain B/C, or burn wrapped tokens to release originals
- **Auto Chain Switching** — Automatically prompts MetaMask to switch chains for claims and releases
- **Merged Approve + Lock** — Single-click flow that handles ERC-20 approval and bridge locking in one step
- **Pending Notifications** — Badge indicators for pending claims and releases
- **Interactive 3D Visualization** — PixiJS-powered canvas with rotating planet nodes, energy orb animations, starfield, and nebula effects
- **Real-Time Stats** — Live bridge statistics (volume, transaction count, locked/burned totals)

## Tech Stack

- [Next.js 16](https://nextjs.org/) with Turbopack
- [React 19](https://react.dev/)
- [wagmi v2](https://wagmi.sh/) + [viem](https://viem.sh/) for Ethereum interactions
- [RainbowKit](https://www.rainbowkit.com/) for wallet connection
- [PixiJS v8](https://pixijs.com/) for canvas animations
- [TailwindCSS](https://tailwindcss.com/) for styling

## Prerequisites

- Node.js 18+
- npm
- MetaMask or compatible Web3 wallet
- Running backend API (see [Bridge-BE/README.md](../Bridge-BE/README.md))
- Deployed bridge contracts (see [Bridge/README.md](../Bridge/README.md))

## Setup

### 1. Install Dependencies

```bash
cd bridge-fe
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with deployed contract addresses and chain configuration:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CHAIN_*_ID` | Chain IDs (31337, 31338, 31339 for local Anvil) |
| `NEXT_PUBLIC_CHAIN_*_RPC` | RPC endpoints |
| `NEXT_PUBLIC_BRIDGE_*` | Bridge contract addresses |
| `NEXT_PUBLIC_GENERIC_TOKEN_A` | KLS token address on Chain A |
| `NEXT_PUBLIC_WRAPPED_TOKEN_*` | wKLS token addresses on Chains B/C |
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID (get free at [cloud.walletconnect.com](https://cloud.walletconnect.com)) |

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### 4. Add Local Chains to MetaMask

Add these networks to MetaMask manually or they will be added automatically via RainbowKit:

| Network | Chain ID | RPC URL |
|---|---|---|
| Chain A | 31337 | http://127.0.0.1:8545 |
| Chain B | 31338 | http://127.0.0.1:8546 |
| Chain C | 31339 | http://127.0.0.1:8547 |

Import the Anvil test account #9 for local testing:
- Private key: `0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6`
- This account holds the initial KLS token supply.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## How to Bridge

1. **Connect Wallet** — Click "Connect Wallet" and select MetaMask
2. **Select Route** — Click A↔B or A↔C (or click a planet node)
3. **Lock Tokens** — Enter amount, click "Approve & Lock" (handles approval + lock in one flow)
4. **Wait for Witness** — The backend indexer detects the lock event and submits a witness to the destination chain
5. **Claim Tokens** — Switch to the "Claim" tab, you'll see pending claims with a notification badge. Click "Claim" to mint wrapped tokens
6. **Burn & Release** — To bridge back, switch to "Burn" tab on the destination chain, then "Release" on Chain A

## Project Structure

```
bridge-fe/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── page.tsx                # Main page (split canvas + controls)
│   │   └── providers.tsx           # wagmi, RainbowKit, React Query providers
│   ├── components/
│   │   ├── PixiBridgeCanvas.tsx    # PixiJS 3D planet visualization
│   │   ├── BridgeForm.tsx          # Bridge form with lock/claim/burn/release tabs
│   │   ├── BridgeStats.tsx         # Live statistics cards
│   │   ├── TransactionHistory.tsx  # Transaction list
│   │   └── WalletConnectButton.tsx # Wallet connection button
│   ├── config/
│   │   ├── chains.ts               # Chain definitions and metadata
│   │   └── abis/                   # Contract ABIs
│   └── lib/
│       └── utils.ts                # Utility functions
├── .env.example                    # Environment template
├── next.config.ts                  # Next.js configuration
├── tailwind.config.ts              # TailwindCSS configuration
└── tsconfig.json                   # TypeScript configuration
```
