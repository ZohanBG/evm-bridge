'use client';

import { useState, useCallback } from 'react';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { PixiBridgeCanvas } from '@/components/PixiBridgeCanvas';
import { BridgeForm } from '@/components/BridgeForm';
import { TransactionHistory } from '@/components/TransactionHistory';
import { BridgeStats } from '@/components/BridgeStats';
import { usePendingClaims, usePendingReleases } from '@/hooks/usePendingEvents';
import { useAccount } from 'wagmi';
import { chainA, chainB, chainC } from '@/config/chains';

type BridgePair = 'AB' | 'AC';
type BridgeAction = 'lock' | 'claim' | 'burn' | 'release';

export default function BridgePage() {
  const { address } = useAccount();

  const [pair, setPair]       = useState<BridgePair>('AB');
  const [action, setAction]   = useState<BridgeAction>('lock');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: pendingClaims   } = usePendingClaims(address);
  const { data: pendingReleases } = usePendingReleases(address);

  const otherChainId = pair === 'AB' ? chainB.id : chainC.id;
  const fromChainId  = action === 'lock' || action === 'claim' ? chainA.id : otherChainId;
  const toChainId    = action === 'lock' || action === 'claim' ? otherChainId : chainA.id;
  const direction = action === 'lock' || action === 'claim' ? 'outgoing' : 'incoming';

  const myClaimCount = address
    ? pendingClaims.filter((e) => e.fromAddress?.toLowerCase() === address.toLowerCase()).length
    : 0;
  const myReleaseCount = address
    ? pendingReleases.filter((e) => e.fromAddress?.toLowerCase() === address.toLowerCase()).length
    : 0;

  const handleActionComplete = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950">
      {/* Header */}
      <header className="shrink-0 z-50 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800/50">
        <div className="max-w-[1800px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              B
            </div>
            <span className="font-semibold text-white">Token Bridge</span>
          </div>
          <div className="flex items-center gap-3">
            {myClaimCount > 0 && (
              <button
                onClick={() => setAction('claim')}
                className="flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-xs text-amber-300 font-medium animate-pulse"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {myClaimCount} claim{myClaimCount > 1 ? 's' : ''} ready
              </button>
            )}
            {myReleaseCount > 0 && (
              <button
                onClick={() => setAction('release')}
                className="flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-500/40 px-3 py-1 text-xs text-blue-300 font-medium animate-pulse"
              >
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                {myReleaseCount} release{myReleaseCount > 1 ? 's' : ''} ready
              </button>
            )}
            <WalletConnectButton />
          </div>
        </div>
      </header>

      {/* Main: left animation, right controls */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Full-height PixiJS canvas */}
        <div className="flex-1 relative">
          <PixiBridgeCanvas pair={pair} direction={direction} onPairChange={setPair} />

          {/* Pair selector floating at bottom of canvas */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {([
              { p: 'AB' as BridgePair, label: 'A ↔ B' },
              { p: 'AC' as BridgePair, label: 'A ↔ C' },
            ]).map(({ p, label }) => (
              <button
                key={p}
                onClick={() => setPair(p)}
                className={`rounded-full px-5 py-2 text-sm font-semibold border transition-all ${
                  pair === p
                    ? 'bg-indigo-600/90 border-indigo-400/50 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-900/70 backdrop-blur border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Controls panel */}
        <div className="w-[420px] shrink-0 border-l border-slate-800/50 flex flex-col overflow-y-auto bg-slate-900/50">
          <div className="p-4 space-y-4">
            <BridgeStats />
            <BridgeForm
              key={`bf-${refreshKey}`}
              fromChainId={fromChainId}
              toChainId={toChainId}
              pendingClaims={pendingClaims}
              pendingReleases={pendingReleases}
              onActionComplete={handleActionComplete}
              action={action}
              onActionChange={setAction}
            />
            <TransactionHistory key={`th-${refreshKey}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
