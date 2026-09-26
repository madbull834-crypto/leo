import { useCallback, useEffect, useState } from 'react';
import {
  CONTRACT_ADDRESS,
  decodeError,
  getLocalSigner,
  getReadContract,
  getReadProvider,
  getWriteContract,
  listLocalAccounts,
} from '../lib/contract';
import type {
  ExpenseTier,
  ProtocolConfig,
  TourReward,
  UserProfile,
  WeeklyTier,
} from '../types/lio';

const WEEKLY_TIER_COUNT = 5;
const EXPENSE_TIER_COUNT = 4;
const TOUR_REWARD_COUNT = 4;

export interface Investor {
  address: string;
  profile: UserProfile;
  tier: bigint;
}

export interface LioState {
  status: 'loading' | 'ready' | 'error';
  message: string;
  chainId: string;
  /** Latest block timestamp. Seeding advances chain time, so elapsed-time
   *  maths must use this and never the browser clock. */
  chainTime: number;
  accounts: string[];
  account: string;
  config?: ProtocolConfig;
  profile?: UserProfile;
  tier?: bigint;
  investors: Investor[];
  weeklyTiers: WeeklyTier[];
  expenseTiers: ExpenseTier[];
  tourRewards: TourReward[];
}

const INITIAL: LioState = {
  status: 'loading',
  message: 'Connecting to local network...',
  chainId: '-',
  chainTime: 0,
  accounts: [],
  account: '',
  investors: [],
  weeklyTiers: [],
  expenseTiers: [],
  tourRewards: [],
};

export function useLio() {
  const [state, setState] = useState<LioState>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [txMessage, setTxMessage] = useState('');

  const load = useCallback(async (preferredAccount?: string) => {
    try {
      const provider = getReadProvider();
      const network = await provider.getNetwork();

      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (code === '0x') {
        setState((prev) => ({
          ...prev,
          status: 'error',
          chainId: network.chainId.toString(),
          message:
            `No contract found at ${CONTRACT_ADDRESS}. Run the deploy script against this node.`,
        }));
        return;
      }

      const contract = getReadContract();
      const accounts = await listLocalAccounts();
      const latestBlock = await provider.getBlock('latest');
      const chainTime = Number(latestBlock?.timestamp ?? 0);

      const [
        treasury,
        paymentAsset,
        minimumInvestment,
        directReferralBps,
        claimDeductionBps,
        lockDuration,
        roiMinBps,
        roiMaxBps,
        roiStrategyId,
        currentWeekId,
        paused,
        treasuryBalance,
        totalLiabilities,
        availableLiquidity,
      ] = await Promise.all([
        contract.treasury(),
        contract.paymentAsset(),
        contract.minimumInvestment(),
        contract.directReferralBps(),
        contract.claimDeductionBps(),
        contract.lockDuration(),
        contract.roiMinBps(),
        contract.roiMaxBps(),
        contract.roiStrategyId(),
        contract.currentWeekId(),
        contract.isPaused(),
        contract.treasuryBalance(),
        contract.totalLiabilities(),
        contract.getAvailableLiquidity(),
      ]);

      const weeklyTiers: WeeklyTier[] = await Promise.all(
        Array.from({ length: WEEKLY_TIER_COUNT }, async (_, index) => {
          const tier = await contract.weeklyTiers(index);
          return {
            index,
            threshold: tier.threshold,
            reward: tier.reward,
            enabled: tier.enabled,
          };
        }),
      );

      const expenseTiers: ExpenseTier[] = await Promise.all(
        Array.from({ length: EXPENSE_TIER_COUNT }, async (_, index) => {
          const tier = await contract.expenseTiers(index);
          return {
            index,
            threshold: tier.threshold,
            benefit: tier.benefit,
            enabled: tier.enabled,
          };
        }),
      );

      const tourRewards: TourReward[] = await Promise.all(
        Array.from({ length: TOUR_REWARD_COUNT }, async (_, index) => {
          const reward = await contract.tourRewards(index);
          return {
            index,
            name: reward.name,
            target: reward.target,
            enabled: reward.enabled,
          };
        }),
      );

      // Every dev account is checked so network-wide charts can show the
      // whole cohort, not just the selected signer.
      const everyProfile = await Promise.all(
        accounts.map(async (address) => ({
          address,
          profile: (await contract.getUserProfile(address)) as UserProfile,
          tier: (await contract.getCurrentTier(address)) as bigint,
        })),
      );

      // Anyone who holds a position OR has earned referral/team rewards. The
      // referrer of a cohort has no position of their own but does hold direct
      // rewards, and omitting them would leave that series empty everywhere.
      const investors = everyProfile.filter(
        (entry) =>
          entry.profile.activationTimestamp !== 0n ||
          entry.profile.directRewards > 0n ||
          entry.profile.teamRewards > 0n,
      );

      // Default to the first account with an actual position, so the dashboard
      // opens on populated data rather than an empty admin account.
      const firstActive = everyProfile.find(
        (entry) => entry.profile.activationTimestamp !== 0n,
      );
      const account =
        preferredAccount || firstActive?.address || accounts[0] || '';

      const selected = everyProfile.find((entry) => entry.address === account);
      const profile = selected?.profile;
      const tier = selected?.tier;

      setState({
        status: 'ready',
        message: 'Connected to local Hardhat network',
        chainId: network.chainId.toString(),
        chainTime,
        accounts,
        account,
        config: {
          treasury,
          paymentAsset,
          minimumInvestment,
          directReferralBps,
          claimDeductionBps,
          lockDuration,
          roiMinBps,
          roiMaxBps,
          roiStrategyId,
          currentWeekId,
          paused,
          treasuryBalance,
          totalLiabilities,
          availableLiquidity,
        },
        profile,
        tier,
        investors,
        weeklyTiers,
        expenseTiers,
        tourRewards,
      });
    } catch (error) {
      console.error(error);
      setState((prev) => ({
        ...prev,
        status: 'error',
        message:
          'Local network not reachable. Start the Hardhat node, then deploy.',
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectAccount = useCallback(
    (account: string) => {
      setState((prev) => ({ ...prev, account }));
      void load(account);
    },
    [load],
  );

  /** Runs a write against the contract as the currently selected account. */
  const send = useCallback(
    async (label: string, run: (contract: any) => Promise<any>) => {
      if (!state.account) return;
      setBusy(true);
      setTxMessage(`${label}...`);
      try {
        const signer = await getLocalSigner(state.account);
        const contract = getWriteContract(signer);
        const tx = await run(contract);
        await tx.wait();
        setTxMessage(`${label} confirmed`);
        await load(state.account);
      } catch (error) {
        console.error(error);
        setTxMessage(`${label} failed: ${decodeError(error)}`);
      } finally {
        setBusy(false);
      }
    },
    [state.account, load],
  );

  const activate = useCallback(
    (referrer: string, amount: string) =>
      send('Activate investment', (contract) =>
        contract.activateInvestor(
          referrer,
          BigInt(amount),
          state.config?.paymentAsset === '0x0000000000000000000000000000000000000000'
            ? { value: BigInt(amount) }
            : {},
        ),
      ),
    [send, state.config?.paymentAsset],
  );

  const claimRoi = useCallback(
    () => send('Claim ROI', (contract) => contract.claimForUser(state.account)),
    [send, state.account],
  );

  const claimWeekly = useCallback(
    () =>
      send('Claim weekly reward', (contract) =>
        contract.claimWeeklyForUser(state.account),
      ),
    [send, state.account],
  );

  const withdrawPrincipal = useCallback(
    () => send('Withdraw principal', (contract) => contract.withdrawPrincipal()),
    [send],
  );

  return {
    state,
    busy,
    txMessage,
    reload: () => load(state.account),
    selectAccount,
    activate,
    claimRoi,
    claimWeekly,
    withdrawPrincipal,
  };
}
