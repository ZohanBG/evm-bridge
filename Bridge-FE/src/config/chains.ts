import { defineChain } from 'viem';

export const chainA = defineChain({
  id:   parseInt(process.env.NEXT_PUBLIC_CHAIN_A_ID ?? '31337'),
  name: process.env.NEXT_PUBLIC_CHAIN_A_NAME ?? 'Chain A',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_CHAIN_A_RPC ?? 'http://127.0.0.1:8545'] },
  },
});

export const chainB = defineChain({
  id:   parseInt(process.env.NEXT_PUBLIC_CHAIN_B_ID ?? '31338'),
  name: process.env.NEXT_PUBLIC_CHAIN_B_NAME ?? 'Chain B',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_CHAIN_B_RPC ?? 'http://127.0.0.1:8546'] },
  },
});

export const chainC = defineChain({
  id:   parseInt(process.env.NEXT_PUBLIC_CHAIN_C_ID ?? '31339'),
  name: process.env.NEXT_PUBLIC_CHAIN_C_NAME ?? 'Chain C',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_CHAIN_C_RPC ?? 'http://127.0.0.1:8547'] },
  },
});

export const ALL_CHAINS = [chainA, chainB, chainC] as const;

/** Contract addresses per chain ID */
export const BRIDGE_ADDRESSES: Record<number, `0x${string}`> = {
  [chainA.id]: (process.env.NEXT_PUBLIC_BRIDGE_A ?? '0x0') as `0x${string}`,
  [chainB.id]: (process.env.NEXT_PUBLIC_BRIDGE_B ?? '0x0') as `0x${string}`,
  [chainC.id]: (process.env.NEXT_PUBLIC_BRIDGE_C ?? '0x0') as `0x${string}`,
};

/** Original/wrapped token addresses per chain */
export const TOKEN_ADDRESSES: Record<number, `0x${string}`> = {
  [chainA.id]: (process.env.NEXT_PUBLIC_GENERIC_TOKEN_A  ?? '0x0') as `0x${string}`,
  [chainB.id]: (process.env.NEXT_PUBLIC_WRAPPED_TOKEN_B  ?? '0x0') as `0x${string}`,
  [chainC.id]: (process.env.NEXT_PUBLIC_WRAPPED_TOKEN_C  ?? '0x0') as `0x${string}`,
};

/** Visual properties for the triangle */
export const CHAIN_META: Record<number, { label: string; color: string; accent: string }> = {
  [chainA.id]: { label: 'A', color: '#6366f1', accent: '#818cf8' },
  [chainB.id]: { label: 'B', color: '#22c55e', accent: '#4ade80' },
  [chainC.id]: { label: 'C', color: '#f59e0b', accent: '#fbbf24' },
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
