'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { chainA, chainB, chainC } from '@/config/chains';

export const wagmiConfig = getDefaultConfig({
  appName:   'Token Bridge',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'demo',
  chains:    [chainA, chainB, chainC],
  ssr:       true,
});
