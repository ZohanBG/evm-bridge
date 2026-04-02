import { formatUnits, parseUnits } from 'viem';

export function formatTokenAmount(raw: bigint, decimals = 18): string {
  const formatted = formatUnits(raw, decimals);
  const num = parseFloat(formatted);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function parseTokenAmount(value: string, decimals = 18): bigint {
  try {
    return parseUnits(value, decimals);
  } catch {
    return 0n;
  }
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortenHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function computeFee(amount: bigint, feeBps: bigint, minFee: bigint): bigint {
  const pctFee = (amount * feeBps) / 10_000n;
  return pctFee < minFee ? minFee : pctFee;
}

/** Returns (fee, recipientAmount) */
export function splitAmountAndFee(
  amount: bigint,
  feeBps: bigint,
  minFee: bigint,
): [bigint, bigint] {
  const fee = computeFee(amount, feeBps, minFee);
  return [fee, amount - fee];
}
