/**
 * The local native-asset demo uses one smallest unit per business dollar. A
 * production token UI should format these values with that token's decimals.
 */
export function formatUnitsRaw(value: bigint | undefined): string {
  if (value === undefined) return '-';
  return value.toLocaleString('en-US');
}

export function formatBps(value: bigint | undefined): string {
  if (value === undefined) return '-';
  return `${Number(value) / 100}%`;
}

export function formatAddress(value: string | undefined): string {
  if (!value) return '-';
  if (value === '0x0000000000000000000000000000000000000000') return 'Native (0x0)';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatTimestamp(value: bigint | undefined): string {
  if (value === undefined || value === 0n) return '-';
  return new Date(Number(value) * 1000).toLocaleString();
}

export function formatDuration(seconds: bigint | undefined): string {
  if (seconds === undefined) return '-';
  const days = Number(seconds) / 86400;
  return `${days} days`;
}
