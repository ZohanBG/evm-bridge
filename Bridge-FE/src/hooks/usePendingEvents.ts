'use client';

import { useEffect, useState } from 'react';
import { useReadContracts } from 'wagmi';
import { API_URL, BRIDGE_ADDRESSES } from '@/config/chains';
import { BRIDGE_ABI } from '@/lib/contracts';

export interface BridgeEvent {
  id: string;
  eventType: 'TOKEN_LOCKED' | 'TOKEN_CLAIMED' | 'TOKEN_BURNED' | 'TOKEN_RELEASED';
  chainId: string;
  sourceChainId: string | null;
  targetChainId: string | null;
  txHash: string;
  transactionHash: string;
  tokenAddress: string;
  fromAddress: string | null;
  toAddress: string | null;
  amount: string;
  fee: string | null;
  nonce: string | null;
  blockTimestamp: string;
  processed: boolean;
}

/**
 * Fetch lock events from the API, then check on-chain transactionStatuses
 * on the *destination* chain to see which ones are claimable (status == 1 = Submitted).
 */
export function usePendingClaims(userAddress?: string) {
  const [allLocks, setAllLocks] = useState<BridgeEvent[]>([]);

  useEffect(() => {
    if (!userAddress) return;
    const load = () =>
      fetch(`${API_URL}/bridge/wallet/${userAddress}?limit=50`)
        .then((r) => r.json())
        .then((json) => {
          const locks = (json.data ?? []).filter(
            (e: BridgeEvent) => e.eventType === 'TOKEN_LOCKED',
          );
          setAllLocks(locks);
        })
        .catch(console.error);

    load();
    const id = setInterval(load, 8_000);
    return () => clearInterval(id);
  }, [userAddress]);

  // Build on-chain status read calls for each lock's txHash on the destination bridge
  const statusCalls = allLocks
    .filter((e) => e.targetChainId)
    .map((e) => ({
      address: BRIDGE_ADDRESSES[Number(e.targetChainId)] as `0x${string}`,
      abi: BRIDGE_ABI,
      functionName: 'transactionStatuses' as const,
      args: [e.txHash as `0x${string}`] as const,
      chainId: Number(e.targetChainId),
    }));

  const { data: statusResults } = useReadContracts({
    contracts: statusCalls,
    query: {
      enabled: statusCalls.length > 0,
      refetchInterval: 8_000,
    },
  });

  // Filter to only events where on-chain status == 1 (Submitted = ready to claim)
  const claimable = allLocks.filter((_, i) => {
    const result = statusResults?.[i];
    return result?.status === 'success' && Number(result.result) === 1;
  });

  return { data: claimable, isLoading: false };
}

/**
 * Fetch burn events from the API, then check on-chain transactionStatuses
 * on the *source* chain to see which ones are releasable (status == 1 = Submitted).
 */
export function usePendingReleases(userAddress?: string) {
  const [allBurns, setAllBurns] = useState<BridgeEvent[]>([]);

  useEffect(() => {
    if (!userAddress) return;
    const load = () =>
      fetch(`${API_URL}/bridge/wallet/${userAddress}?limit=50`)
        .then((r) => r.json())
        .then((json) => {
          const burns = (json.data ?? []).filter(
            (e: BridgeEvent) => e.eventType === 'TOKEN_BURNED',
          );
          setAllBurns(burns);
        })
        .catch(console.error);

    load();
    const id = setInterval(load, 8_000);
    return () => clearInterval(id);
  }, [userAddress]);

  const statusCalls = allBurns
    .filter((e) => e.sourceChainId)
    .map((e) => ({
      address: BRIDGE_ADDRESSES[Number(e.sourceChainId)] as `0x${string}`,
      abi: BRIDGE_ABI,
      functionName: 'transactionStatuses' as const,
      args: [e.txHash as `0x${string}`] as const,
      chainId: Number(e.sourceChainId),
    }));

  const { data: statusResults } = useReadContracts({
    contracts: statusCalls,
    query: {
      enabled: statusCalls.length > 0,
      refetchInterval: 8_000,
    },
  });

  const releasable = allBurns.filter((_, i) => {
    const result = statusResults?.[i];
    return result?.status === 'success' && Number(result.result) === 1;
  });

  return { data: releasable, isLoading: false };
}

export function useWalletHistory(userAddress?: string) {
  const [data, setData] = useState<BridgeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userAddress) return;
    setIsLoading(true);
    fetch(`${API_URL}/bridge/wallet/${userAddress}?limit=20`)
      .then((r) => r.json())
      .then((json) => setData(json.data ?? []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [userAddress]);

  return { data, isLoading };
}
