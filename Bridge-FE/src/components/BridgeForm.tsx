'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  useAccount, useChainId, useSwitchChain,
  useReadContract, useWriteContract, useWaitForTransactionReceipt,
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { BRIDGE_ABI, ERC20_ABI } from '@/lib/contracts';
import { BRIDGE_ADDRESSES, TOKEN_ADDRESSES, CHAIN_META, chainA, chainB, chainC } from '@/config/chains';
import { computeFee, formatTokenAmount, parseTokenAmount } from '@/lib/utils';
import type { BridgeEvent } from '@/hooks/usePendingEvents';

type BridgeAction = 'lock' | 'claim' | 'burn' | 'release';

interface BridgeFormProps {
  fromChainId: number | null;
  toChainId:   number | null;
  pendingClaims:   BridgeEvent[];
  pendingReleases: BridgeEvent[];
  onActionComplete: () => void;
  action: BridgeAction;
  onActionChange: (a: BridgeAction) => void;
}

export function BridgeForm({
  fromChainId,
  toChainId,
  pendingClaims,
  pendingReleases,
  onActionComplete,
  action,
  onActionChange,
}: BridgeFormProps) {
  const { address }          = useAccount();
  const connectedChainId     = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContract, data: txHash, isPending: isWritePending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [amount, setAmount]             = useState('');
  const [selectedEvent, setSelectedEvent] = useState<BridgeEvent | null>(null);
  const [status, setStatus]             = useState('');
  const [step, setStep]                 = useState<'idle' | 'approving' | 'locking'>('idle');

  const srcChain = fromChainId ?? chainA.id;
  const dstChain = toChainId   ?? chainB.id;

  const bridgeAddress = BRIDGE_ADDRESSES[srcChain];
  const tokenAddress  = TOKEN_ADDRESSES[srcChain];

  // --- Fee config ---
  const { data: feeBps    } = useReadContract({ address: bridgeAddress, abi: BRIDGE_ABI, functionName: 'feeBps' });
  const { data: minFee    } = useReadContract({ address: bridgeAddress, abi: BRIDGE_ABI, functionName: 'minFeeAmount' });
  const { data: isPaused  } = useReadContract({ address: bridgeAddress, abi: BRIDGE_ABI, functionName: 'paused' });

  // --- Token balance + allowance ---
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, bridgeAddress],
    query: { enabled: !!address },
  });
  const { data: decimals } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });
  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'symbol',
  });

  const dec  = (decimals as number) ?? 18;
  const sym  = (symbol  as string)  ?? 'TOKEN';

  const amountBig  = parseTokenAmount(amount, dec);
  const feeBigBps  = (feeBps as bigint) ?? 30n;
  const minFeeBig  = (minFee as bigint) ?? 0n;
  const fee        = computeFee(amountBig, feeBigBps, minFeeBig);
  const netAmount  = amountBig > fee ? amountBig - fee : 0n;
  const needApprove = (allowance as bigint ?? 0n) < amountBig;

  // After approve confirms, automatically proceed to lock
  useEffect(() => {
    if (isConfirmed && step === 'approving') {
      setStatus('Approved! Now locking...');
      refetchAllowance().then(() => {
        setStep('locking');
        resetWrite();
        const maxFee = (fee * 110n) / 100n;
        writeContract({
          address: bridgeAddress,
          abi: BRIDGE_ABI,
          functionName: 'lock',
          args: [tokenAddress, BigInt(dstChain), amountBig, maxFee],
          chainId: srcChain,
        });
      });
      return;
    }
    if (isConfirmed && step !== 'approving') {
      setStatus('Transaction confirmed!');
      setAmount('');
      setSelectedEvent(null);
      setStep('idle');
      refetchBalance();
      refetchAllowance();
      onActionComplete();
    }
  }, [isConfirmed]);

  const handleLockFlow = async () => {
    // Ensure on source chain
    if (connectedChainId !== srcChain) {
      try { await switchChainAsync({ chainId: srcChain }); } catch { return; }
    }

    if (needApprove) {
      setStep('approving');
      setStatus('Approving...');
      writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [bridgeAddress, amountBig],
        chainId: srcChain,
      });
    } else {
      setStep('locking');
      const maxFee = (fee * 110n) / 100n;
      writeContract({
        address: bridgeAddress,
        abi: BRIDGE_ABI,
        functionName: 'lock',
        args: [tokenAddress, BigInt(dstChain), amountBig, maxFee],
        chainId: srcChain,
      });
    }
  };

  const handleBurnFlow = async () => {
    if (connectedChainId !== srcChain) {
      try { await switchChainAsync({ chainId: srcChain }); } catch { return; }
    }
    setStep('locking');
    const maxFee = (fee * 110n) / 100n;
    writeContract({
      address: bridgeAddress,
      abi: BRIDGE_ABI,
      functionName: 'burn',
      args: [tokenAddress, BigInt(dstChain), amountBig, maxFee],
      chainId: srcChain,
    });
  };

  const handleClaim = async (ev: BridgeEvent) => {
    const targetChain = Number(ev.targetChainId);
    // Auto-switch to destination chain if needed
    if (connectedChainId !== targetChain) {
      try { await switchChainAsync({ chainId: targetChain }); } catch { return; }
    }
    const dstBridge = BRIDGE_ADDRESSES[targetChain];
    writeContract({
      address: dstBridge,
      abi: BRIDGE_ABI,
      functionName: 'claim',
      args: [
        ev.tokenAddress as `0x${string}`,
        address!,
        BigInt(ev.amount),
        BigInt(ev.fee ?? '0'),
        BigInt(ev.sourceChainId ?? '0'),
        BigInt(ev.nonce ?? '0'),
      ],
      chainId: targetChain,
    });
  };

  const handleRelease = async (ev: BridgeEvent) => {
    const sourceChain = Number(ev.sourceChainId);
    // Auto-switch to source chain if needed
    if (connectedChainId !== sourceChain) {
      try { await switchChainAsync({ chainId: sourceChain }); } catch { return; }
    }
    const srcBridge = BRIDGE_ADDRESSES[sourceChain];
    writeContract({
      address: srcBridge,
      abi: BRIDGE_ABI,
      functionName: 'release',
      args: [
        ev.tokenAddress as `0x${string}`,
        address!,
        BigInt(ev.amount),
        BigInt(ev.fee ?? '0'),
        BigInt(ev.sourceChainId ?? '0'),
        BigInt(ev.nonce ?? '0'),
      ],
      chainId: sourceChain,
    });
  };

  const isBusy = isWritePending || isConfirming;

  const lockButtonLabel = () => {
    if (isBusy && step === 'approving') return 'Step 1/2: Approving…';
    if (isBusy && step === 'locking') return 'Step 2/2: Locking…';
    if (isBusy) return 'Confirming…';
    if (needApprove) return `Approve & Lock ${sym}`;
    return `Lock ${sym} on Chain ${CHAIN_META[srcChain]?.label}`;
  };

  if (!address) {
    return (
      <div className="rounded-xl bg-slate-800 border border-slate-700 p-6 text-center text-slate-400">
        Connect your wallet to start bridging
      </div>
    );
  }

  if (!fromChainId || !toChainId) {
    return (
      <div className="rounded-xl bg-slate-800 border border-slate-700 p-6 text-center text-slate-400">
        Select source and destination chains in the triangle above
      </div>
    );
  }

  // Filter claims/releases for current user (show ALL, not just current chain)
  const myClaims = pendingClaims.filter(
    (e) => e.fromAddress?.toLowerCase() === address.toLowerCase(),
  );
  const myReleases = pendingReleases.filter(
    (e) => e.fromAddress?.toLowerCase() === address.toLowerCase(),
  );

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-6 space-y-5">
      {/* Paused banner */}
      {isPaused && (
        <div className="rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-red-300 text-sm">
          Bridge is currently paused by the owner
        </div>
      )}

      {/* Action tabs */}
      <div className="grid grid-cols-4 gap-1 bg-slate-900/70 rounded-lg p-1">
        {(['lock', 'claim', 'burn', 'release'] as BridgeAction[]).map((a) => {
          const count = a === 'claim' ? myClaims.length : a === 'release' ? myReleases.length : 0;
          return (
            <button
              key={a}
              onClick={() => { onActionChange(a); setStatus(''); resetWrite(); setStep('idle'); }}
              className={`py-2 rounded-md text-sm font-medium transition-colors capitalize relative ${
                action === a
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {a}
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[10px] text-white flex items-center justify-center font-bold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chain indicator */}
      <div className="flex items-center justify-between text-sm">
        <ChainBadge chainId={srcChain} label="From" />
        <span className="text-slate-500 text-lg">&rarr;</span>
        <ChainBadge chainId={dstChain} label="To" />
      </div>

      {/* Amount input (lock / burn) */}
      {(action === 'lock' || action === 'burn') && (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Amount</span>
              {balance !== undefined && (
                <button
                  onClick={() => setAmount(formatUnits(balance as bigint, dec))}
                  className="hover:text-white transition-colors"
                >
                  Max: {formatTokenAmount(balance as bigint, dec)} {sym}
                </button>
              )}
            </div>
            <div className="flex rounded-lg overflow-hidden border border-slate-600 focus-within:border-indigo-500">
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-slate-900/70 px-4 py-3 text-white outline-none"
              />
              <div className="flex items-center px-3 bg-slate-700/50 text-slate-300 text-sm font-mono">
                {sym}
              </div>
            </div>
          </div>

          {/* Fee breakdown */}
          {amountBig > 0n && (
            <div className="rounded-lg bg-slate-900/70 px-4 py-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Bridge fee ({feeBigBps.toString()} bps)</span>
                <span>{formatTokenAmount(fee, dec)} {sym}</span>
              </div>
              <div className="flex justify-between text-white font-medium">
                <span>You receive</span>
                <span>{formatTokenAmount(netAmount, dec)} {sym}</span>
              </div>
            </div>
          )}

          {/* Single action button for lock (handles approve + lock) */}
          <button
            onClick={action === 'lock' ? handleLockFlow : handleBurnFlow}
            disabled={isBusy || amountBig === 0n || !!isPaused}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            {action === 'lock'
              ? lockButtonLabel()
              : isBusy ? 'Confirming…' : `Burn ${sym} on Chain ${CHAIN_META[srcChain]?.label}`
            }
          </button>

          {/* Progress indicator for approve+lock */}
          {step !== 'idle' && action === 'lock' && needApprove && (
            <div className="flex gap-2 items-center justify-center text-xs text-slate-400">
              <div className={`w-2 h-2 rounded-full ${step === 'approving' ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
              <span>Approve</span>
              <span className="text-slate-600">&rarr;</span>
              <div className={`w-2 h-2 rounded-full ${step === 'locking' ? 'bg-amber-400 animate-pulse' : step === 'approving' ? 'bg-slate-600' : 'bg-green-400'}`} />
              <span>Lock</span>
            </div>
          )}
        </div>
      )}

      {/* Claim list — show ALL claims, auto-switch chain on click */}
      {action === 'claim' && (
        <PendingList
          events={myClaims}
          emptyLabel="No pending claims"
          actionLabel="Claim"
          onAction={handleClaim}
          isBusy={isBusy}
          decimals={dec}
          symbol={sym}
          connectedChainId={connectedChainId}
          getTargetChain={(e) => Number(e.targetChainId)}
        />
      )}

      {/* Release list — show ALL releases, auto-switch chain on click */}
      {action === 'release' && (
        <PendingList
          events={myReleases}
          emptyLabel="No pending releases"
          actionLabel="Release"
          onAction={handleRelease}
          isBusy={isBusy}
          decimals={dec}
          symbol={sym}
          connectedChainId={connectedChainId}
          getTargetChain={(e) => Number(e.sourceChainId)}
        />
      )}

      {/* Status */}
      {(status || writeError) && (
        <p className={`text-sm text-center ${writeError ? 'text-red-400' : 'text-green-400'}`}>
          {writeError ? (writeError as any).shortMessage ?? writeError.message : status}
        </p>
      )}
    </div>
  );
}

function ChainBadge({ chainId, label }: { chainId: number; label: string }) {
  const meta = CHAIN_META[chainId];
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-xs">{label}</span>
      <div
        className="rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-white"
        style={{ background: meta?.color ?? '#334155' }}
      >
        {meta?.label ?? '?'}
      </div>
      <span className="text-slate-300 text-xs font-mono">{chainId}</span>
    </div>
  );
}

function PendingList({
  events, emptyLabel, actionLabel, onAction, isBusy, decimals, symbol,
  connectedChainId, getTargetChain,
}: {
  events: BridgeEvent[];
  emptyLabel: string;
  actionLabel: string;
  onAction: (ev: BridgeEvent) => void;
  isBusy: boolean;
  decimals: number;
  symbol: string;
  connectedChainId: number;
  getTargetChain: (ev: BridgeEvent) => number;
}) {
  if (events.length === 0) {
    return <p className="text-center text-slate-500 text-sm py-4">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {events.map((ev) => {
        const targetChain = getTargetChain(ev);
        const needsSwitch = connectedChainId !== targetChain;
        const chainLabel = CHAIN_META[targetChain]?.label ?? '?';
        return (
          <div
            key={ev.id}
            className="flex items-center justify-between rounded-lg bg-slate-900 px-4 py-3"
          >
            <div className="text-xs space-y-0.5">
              <div className="text-white font-mono">
                {formatTokenAmount(BigInt(ev.amount), decimals)} {symbol}
              </div>
              <div className="text-slate-500">
                Fee: {formatTokenAmount(BigInt(ev.fee ?? '0'), decimals)} {symbol}
              </div>
              <div className="text-slate-600 text-[10px]">
                Chain {CHAIN_META[Number(ev.sourceChainId)]?.label ?? '?'} &rarr; Chain {CHAIN_META[Number(ev.targetChainId)]?.label ?? '?'}
              </div>
            </div>
            <button
              onClick={() => onAction(ev)}
              disabled={isBusy}
              className={`rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 ${
                needsSwitch
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {isBusy ? '…' : needsSwitch ? `Switch to ${chainLabel} & ${actionLabel}` : actionLabel}
            </button>
          </div>
        );
      })}
    </div>
  );
}
