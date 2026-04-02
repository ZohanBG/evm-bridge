'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/config/chains';
import { formatTokenAmount } from '@/lib/utils';

interface Stats {
  totalTransactions: number;
  totalVolume: string;
  uniqueTokens: number;
  uniqueUsers: number;
  pendingClaims: number;
  pendingReleases: number;
  totalLocked: number;
  totalBurned: number;
}

export function BridgeStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`${API_URL}/bridge/statistics`)
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});

    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  if (!stats) return null;

  const row1 = [
    { label: 'Total TXs', value: stats.totalTransactions.toLocaleString() },
    { label: 'Volume',    value: formatTokenAmount(BigInt(stats.totalVolume)) },
    { label: 'Users',     value: stats.uniqueUsers.toLocaleString() },
  ];

  const row2 = [
    { label: 'Locked',           value: stats.totalLocked.toLocaleString() },
    { label: 'Burned',           value: stats.totalBurned.toLocaleString() },
    { label: 'Pending Claims',   value: stats.pendingClaims.toLocaleString() },
    { label: 'Pending Releases', value: stats.pendingReleases.toLocaleString() },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {row1.map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-slate-800 border border-slate-700 p-3 text-center">
            <p className="text-lg font-bold text-white">{value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {row2.map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-slate-800 border border-slate-700 p-3 text-center">
            <p className="text-lg font-bold text-white">{value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
