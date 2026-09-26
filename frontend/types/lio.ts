export interface ProtocolConfig {
  treasury: string;
  paymentAsset: string;
  minimumInvestment: bigint;
  directReferralBps: bigint;
  claimDeductionBps: bigint;
  lockDuration: bigint;
  roiMinBps: bigint;
  roiMaxBps: bigint;
  roiStrategyId: bigint;
  currentWeekId: bigint;
  paused: boolean;
  treasuryBalance: bigint;
  totalLiabilities: bigint;
  availableLiquidity: bigint;
}

/** Mirrors LioInvestment.UserProfile. */
export interface UserProfile {
  active: boolean;
  referrer: string;
  activationTimestamp: bigint;
  unlockTimestamp: bigint;
  principal: bigint;
  roiAccrued: bigint;
  roiClaimed: bigint;
  directRewards: bigint;
  teamRewards: bigint;
  leftBusiness: bigint;
  rightBusiness: bigint;
  freshBusiness: bigint;
  claimableBalance: bigint;
  totalClaimed: bigint;
  status: bigint;
}

export interface WeeklyTier {
  index: number;
  threshold: bigint;
  reward: bigint;
  enabled: boolean;
}

export interface ExpenseTier {
  index: number;
  threshold: bigint;
  benefit: bigint;
  enabled: boolean;
}

export interface TourReward {
  index: number;
  name: string;
  target: bigint;
  enabled: boolean;
}

export const ACCOUNT_STATUS = ['Inactive', 'Active', 'Suspended'] as const;
