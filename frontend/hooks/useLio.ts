import { useCallback, useEffect, useState } from 'react';
import { parseUnits } from 'ethers';
import {
  CONTRACT_ADDRESS,
  NETWORK_LABEL,
  PAYMENT_ASSET_DECIMALS,
  decodeError,
  ensureDeploymentNetwork,
  getBrowserSigner,
  getLocalSigner,
  getPaymentToken,
  getReadContract,
  getReadProvider,
  getWriteContract,
  hasInjectedWallet,
  listBrowserAccounts,
  listLocalAccounts,
} from '../lib/contract';
import type {
  ExpenseTier,
  ProtocolConfig,
  TourReward,
  UserProfile,
  WeeklyTier,
} from '../types/lio';

const WEEKLY_TIER_COUNT = 6;
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
  paymentBalance: bigint;
  paymentAllowance: bigint;
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
  paymentBalance: 0n,
  paymentAllowance: 0n,
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
      const browserAccounts = hasInjectedWallet() ? await listBrowserAccounts() : [];
      const accounts = browserAccounts.length > 0 ? browserAccounts : await listLocalAccounts();
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

      // Only tiers the contract actually has configured. The count is read
      // optimistically, so a deployment with fewer tiers than the plan (an
      // older contract still on chain) yields empty rows that must not render
      // as zero-height bars.
      const weeklyTiersRaw: WeeklyTier[] = await Promise.all(
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

      const weeklyTiers = weeklyTiersRaw.filter((tier) => tier.enabled);

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
      let paymentBalance = 0n;
      let paymentAllowance = 0n;
      if (account && paymentAsset !== '0x0000000000000000000000000000000000000000') {
        const token = getPaymentToken(paymentAsset, provider);
        [paymentBalance, paymentAllowance] = await Promise.all([
          token.balanceOf(account),
          token.allowance(account, CONTRACT_ADDRESS),
        ]);
      }

      setState({
        status: 'ready',
        message: account ? 'Wallet connected' : 'Connect your wallet to begin',
        chainId: network.chainId.toString(),
        chainTime,
        accounts,
        account,
        paymentBalance,
        paymentAllowance,
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
        message: `${NETWORK_LABEL} is not responding. Check your connection and try again.`,
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const injected = (window as any).ethereum;
    if (!injected?.on) return;
    const refresh = () => void load();
    injected.on('accountsChanged', refresh);
    injected.on('chainChanged', refresh);
    return () => {
      injected.removeListener?.('accountsChanged', refresh);
      injected.removeListener?.('chainChanged', refresh);
    };
  }, [load]);

  const selectAccount = useCallback(
    (account: string) => {
      setState((prev) => ({ ...prev, account }));
      void load(account);
    },
    [load],
  );

  const connectWallet = useCallback(async () => {
    setBusy(true);
    setTxMessage('Connecting wallet...');
    try {
      await ensureDeploymentNetwork();
      const accounts = await listBrowserAccounts(true);
      await load(accounts[0]);
      setTxMessage(`Wallet connected to ${NETWORK_LABEL}`);
    } catch (error) {
      setTxMessage(`Connection failed: ${decodeError(error)}`);
    } finally {
      setBusy(false);
    }
  }, [load]);

  const getSigner = useCallback(async () => {
    if (hasInjectedWallet()) {
      await ensureDeploymentNetwork();
      return getBrowserSigner();
    }
    return getLocalSigner(state.account);
  }, [state.account]);

  /** Runs a write against the contract as the currently selected account. */
  const send = useCallback(
    async (label: string, run: (contract: any) => Promise<any>) => {
      if (!state.account) return;
      setBusy(true);
      setTxMessage(`${label}...`);
      try {
        const signer = await getSigner();
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
    [state.account, load, getSigner],
  );

  const sendToken = useCallback(
    async (label: string, run: (token: any) => Promise<any>) => {
      if (!state.account || !state.config) return;
      setBusy(true);
      setTxMessage(`${label}...`);
      try {
        const signer = await getSigner();
        const token = getPaymentToken(state.config.paymentAsset, signer);
        const tx = await run(token);
        await tx.wait();
        setTxMessage(`${label} confirmed`);
        await load(state.account);
      } catch (error) {
        setTxMessage(`${label} failed: ${decodeError(error)}`);
      } finally {
        setBusy(false);
      }
    },
    [state.account, state.config, getSigner, load],
  );

  const activate = useCallback(
    (referrer: string, amount: string) => {
      const units = parseUnits(amount || '0', PAYMENT_ASSET_DECIMALS);
      return (
      send('Activate investment', (contract) =>
        contract.activateInvestor(
          referrer,
          units,
          state.config?.paymentAsset === '0x0000000000000000000000000000000000000000'
            ? { value: units }
            : {},
        ),
      ));
    },
    [send, state.config?.paymentAsset],
  );

  const requestTestUsdt = useCallback(
    () => sendToken('Request test USDT', (token) => token.faucet()),
    [sendToken],
  );

  const approveInvestment = useCallback(
    (amount: string) => {
      const units = parseUnits(amount || '0', PAYMENT_ASSET_DECIMALS);
      return sendToken('Approve investment', (token) => token.approve(CONTRACT_ADDRESS, units));
    },
    [sendToken],
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
    connectWallet,
    selectAccount,
    requestTestUsdt,
    approveInvestment,
    activate,
    claimRoi,
    claimWeekly,
    withdrawPrincipal,
  };
}
