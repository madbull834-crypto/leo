import { formatUnits } from 'ethers';
import { PAYMENT_ASSET_DECIMALS, PAYMENT_ASSET_SYMBOL } from './contract';

export function formatUnitsRaw(value: bigint | undefined): string {
  if (value === undefined) return '-';
  const [whole, fraction = ''] = formatUnits(value, PAYMENT_ASSET_DECIMALS).split('.');
  const readable = Number(whole).toLocaleString('en-US');
  const trimmedFraction = fraction.replace(/0+$/, '').slice(0, 2);
  return `${readable}${trimmedFraction ? `.${trimmedFraction}` : ''} ${PAYMENT_ASSET_SYMBOL}`;
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
