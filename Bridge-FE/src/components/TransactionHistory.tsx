'use client';

import { useAccount } from 'wagmi';
import { useWalletHistory } from '@/hooks/usePendingEvents';
import { CHAIN_META } from '@/config/chains';
import { formatTokenAmount, shortenHash } from '@/lib/utils';

const EVENT_COLORS: Record<string, string> = {
  TOKEN_LOCKED:   'bg-indigo-900/60 text-indigo-300',
  TOKEN_CLAIMED:  'bg-green-900/60  text-green-300',
  TOKEN_BURNED:   'bg-amber-900/60  text-amber-300',
  TOKEN_RELEASED: 'bg-blue-900/60   text-blue-300',
};

const EVENT_LABELS: Record<string, string> = {
  TOKEN_LOCKED:   'Locked',
  TOKEN_CLAIMED:  'Claimed',
  TOKEN_BURNED:   'Burned',
  TOKEN_RELEASED: 'Released',
};

export function TransactionHistory() {
  const { address } = useAccount();
  const { data, isLoading } = useWalletHistory(address);

  if (!address) return null;

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">Transaction History</h3>

      {isLoading && <p className="text-center text-slate-500 text-sm py-4">Loading…</p>}

      {!isLoading && data.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-4">No transactions yet</p>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {data.map((ev) => {
          const srcMeta = CHAIN_META[Number(ev.sourceChainId ?? ev.chainId)];
          const dstMeta = CHAIN_META[Number(ev.targetChainId)];

          return (
            <div
              key={ev.id}
              className="flex items-start justify-between rounded-lg bg-slate-900/70 px-4 py-3 gap-3"
            >
              <div className="flex-1 space-y-1 min-w-0">
                {/* Event type badge */}
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    EVENT_COLORS[ev.eventType] ?? 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                </span>

                {/* Amount */}
                <p className="text-white text-sm font-mono">
                  {formatTokenAmount(BigInt(ev.amount))} tokens
                  {ev.fee && ev.fee !== '0' && (
                    <span className="text-slate-400 ml-1 text-xs">
                      (fee: {formatTokenAmount(BigInt(ev.fee))})
                    </span>
                  )}
                </p>

                {/* Chain route */}
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  {srcMeta && (
                    <span
                      className="inline-block w-4 h-4 rounded-full text-center text-white text-[10px] font-bold leading-4"
                      style={{ background: srcMeta.color }}
                    >
                      {srcMeta.label}
                    </span>
                  )}
                  {dstMeta && (
                    <>
                      <span>→</span>
                      <span
                        className="inline-block w-4 h-4 rounded-full text-center text-white text-[10px] font-bold leading-4"
                        style={{ background: dstMeta.color }}
                      >
                        {dstMeta.label}
                      </span>
                    </>
                  )}
                  <span className="ml-1 font-mono">{shortenHash(ev.txHash)}</span>
                </div>
              </div>

              {/* Status pill */}
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                  ev.processed
                    ? 'bg-green-900/60 text-green-400'
                    : 'bg-yellow-900/60 text-yellow-400'
                }`}
              >
                {ev.processed ? 'Done' : 'Pending'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
