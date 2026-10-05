import { useEffect, useState } from 'react';
import type { LioState } from './useLio';

const MONTH_SECONDS = 30n * 86_400n;

export function useGeneratedRoi(state: LioState): { generated: bigint; available: bigint } {
  const [liveChainTime, setLiveChainTime] = useState(state.chainTime);

  useEffect(() => {
    const startedAt = Date.now();
    setLiveChainTime(state.chainTime);
    const timer = window.setInterval(() => {
      setLiveChainTime(state.chainTime + Math.floor((Date.now() - startedAt) / 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [state.chainTime, state.account]);

  const profile = state.profile;
  const accrualStart = state.lastRoiAccrualTimestamp > 0n
    ? state.lastRoiAccrualTimestamp
    : (profile?.activationTimestamp ?? 0n);
  const elapsed = profile?.active && accrualStart > 0n
    ? BigInt(Math.max(0, liveChainTime - Number(accrualStart)))
    : 0n;
  const pending = profile?.active
    ? (profile.principal * state.selectedMonthlyRoiBps * elapsed) / (10_000n * MONTH_SECONDS)
    : 0n;
  const generated = (profile?.roiAccrued ?? 0n) + pending;
  const claimed = profile?.roiClaimed ?? 0n;

  return {
    generated,
    available: generated > claimed ? generated - claimed : 0n,
  };
}
