'use client';

import { useReadContracts } from 'wagmi';
import { BRIDGE_ABI } from '@/lib/contracts';
import { BRIDGE_ADDRESSES, TOKEN_ADDRESSES } from '@/config/chains';

export function useBridgeConfig(chainId: number) {
  const bridgeAddress = BRIDGE_ADDRESSES[chainId];

  const { data, isLoading } = useReadContracts({
    contracts: [
      { address: bridgeAddress, abi: BRIDGE_ABI, functionName: 'feeBps' },
      { address: bridgeAddress, abi: BRIDGE_ABI, functionName: 'minFeeAmount' },
      { address: bridgeAddress, abi: BRIDGE_ABI, functionName: 'paused' },
    ],
    query: { enabled: !!bridgeAddress && bridgeAddress !== '0x0', refetchInterval: 10_000 },
  });

  return {
    bridgeAddress,
    tokenAddress: TOKEN_ADDRESSES[chainId],
    feeBps:      (data?.[0]?.result ?? 30n) as bigint,
    minFee:      (data?.[1]?.result ?? 0n) as bigint,
    isPaused:    (data?.[2]?.result ?? false) as boolean,
    isLoading,
  };
}
