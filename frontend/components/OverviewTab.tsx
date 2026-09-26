import { ChartCard } from './ui/ChartCard';
import { Meter } from './ui/Meter';
import { StatTile } from './ui/StatTile';
import { LegBalanceChart } from './charts/LegBalanceChart';
import { RewardsStackChart, type StackRow } from './charts/RewardsStackChart';
import { RoiProjectionChart } from './charts/RoiProjectionChart';
import { compact, ratio, toNumber } from '../lib/viz';
import { formatUnitsRaw } from '../lib/format';
import { PAYMENT_ASSET_DECIMALS, PAYMENT_ASSET_SYMBOL } from '../lib/contract';
import type { Investor, LioState } from '../hooks/useLio';

const DAY = 86_400;

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function OverviewTab({ state }: { state: LioState }) {
  const { config, profile, tier, investors } = state;
  if (!config) return null;

  const scale = 10 ** PAYMENT_ASSET_DECIMALS;
  const asset = (value: bigint | undefined) => toNumber(value) / scale;
  const principal = asset(profile?.principal);
  const roiAccrued = asset(profile?.roiAccrued);
  const directRewards = asset(profile?.directRewards);
  const teamRewards = asset(profile?.teamRewards);
  const left = asset(profile?.leftBusiness);
  const right = asset(profile?.rightBusiness);
  const combined = left + right;
  const matched = Math.min(left, right) * 2;
  const tierNumber = Number(tier ?? 0n);

  const lockDays = Math.round(toNumber(config.lockDuration) / DAY);
  const activation = toNumber(profile?.activationTimestamp);
  // Chain time, not wall-clock: the seed script advances the local chain, so
  // Date.now() would report a position as 0 days old when it is 95 days in.
  const nowSeconds = state.chainTime;
  const elapsedDays = activation > 0 ? Math.max(0, Math.round((nowSeconds - activation) / DAY)) : 0;

  // Next weekly tier threshold the reader has not yet cleared.
  const nextTier = state.weeklyTiers.find(
    (candidate) => candidate.enabled && matched < asset(candidate.threshold),
  );

  const rows: StackRow[] = investors.map((investor: Investor) => ({
    key: investor.address,
    label: shortAddress(investor.address),
    direct: asset(investor.profile.directRewards),
    team: asset(investor.profile.teamRewards),
    roi: asset(investor.profile.roiAccrued),
    isCurrent: investor.address === state.account,
  }));

  const stackTable = (
    <table className="data">
      <thead>
        <tr>
          <th>Investor</th>
          <th className="num">Direct referral</th>
          <th className="num">Team / weekly</th>
          <th className="num">ROI accrued</th>
          <th className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className={row.isCurrent ? 'is-current' : undefined}>
            <td className="mono">{row.label}</td>
            <td className="num">{row.direct.toLocaleString('en-US')}</td>
            <td className="num">{row.team.toLocaleString('en-US')}</td>
            <td className="num">{row.roi.toLocaleString('en-US')}</td>
            <td className="num">{(row.direct + row.team + row.roi).toLocaleString('en-US')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const legTable = (
    <table className="data">
      <thead>
        <tr><th>Leg</th><th className="num">Volume</th><th className="num">Share</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><span className="swatch-cell"><span className="legend-swatch" style={{ background: 'var(--series-1)' }} />Left</span></td>
          <td className="num">{left.toLocaleString('en-US')}</td>
          <td className="num">{combined ? Math.round((left / combined) * 100) : 0}%</td>
        </tr>
        <tr>
          <td><span className="swatch-cell"><span className="legend-swatch" style={{ background: 'var(--series-2)' }} />Right</span></td>
          <td className="num">{right.toLocaleString('en-US')}</td>
          <td className="num">{combined ? Math.round((right / combined) * 100) : 0}%</td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <>
      <div className="grid-cards">
        <StatTile label="Your investment" value={`${compact(principal)} ${PAYMENT_ASSET_SYMBOL}`}
          foot={<span>{profile?.active ? `Unlocks after ${lockDays} days` : 'No active position'}</span>} />
        <StatTile label="Monthly ROI earned" value={`${compact(roiAccrued)} ${PAYMENT_ASSET_SYMBOL}`}
          foot={<span>{formatUnitsRaw(profile?.roiClaimed)} claimed</span>} />
        <StatTile label="Referral rewards" value={`${compact(directRewards)} ${PAYMENT_ASSET_SYMBOL}`}
          foot={<span>{Number(config.directReferralBps) / 100}% of referred volume</span>} />
        <StatTile label="Team rewards" value={`${compact(teamRewards)} ${PAYMENT_ASSET_SYMBOL}`}
          foot={<span>Weekly tier {tierNumber || '-'}</span>} />
      </div>

      <div className="grid-cards">
        <section className="card span-4">
          <div className="card-head">
            <div>
              <h2 className="card-title">Current weekly tier</h2>
              <p className="card-sub">From matched left/right volume</p>
            </div>
          </div>
          <div className="card-body">
            <div className="hero">
              <span className="hero-value">{tierNumber}</span>
              <span className="hero-unit">of {state.weeklyTiers.length}</span>
            </div>
            <div style={{ marginTop: 14 }}>
              {profile?.active ? (
                <span className="pill pill-good"><span className="pill-icon">●</span>Active position</span>
              ) : (
                <span className="pill"><span className="pill-icon">○</span>No position</span>
              )}
            </div>
            <Meter
              name={nextTier ? `Progress to tier ${nextTier.index + 1}` : 'Top tier reached'}
              value={matched}
              limit={nextTier ? asset(nextTier.threshold) : Math.max(matched, 1)}
              display={`${compact(matched)} / ${nextTier ? compact(asset(nextTier.threshold)) : compact(matched)}`}
              foot={nextTier
                ? `${compact(asset(nextTier.threshold) - matched)} ${PAYMENT_ASSET_SYMBOL} more matched volume needed`
                : 'All configured thresholds cleared'}
            />
          </div>
        </section>

        <ChartCard
          title="Binary leg balance"
          subtitle="Left against right volume; payouts follow the weaker leg"
          className="span-8"
          table={legTable}
        >
          <LegBalanceChart left={left} right={right} />
        </ChartCard>
      </div>

      <div className="grid-cards">
        <ChartCard
          title="How your monthly ROI grows"
          subtitle={
            principal > 0
              ? `ROI is added after each complete 30-day period at ${Number(config.roiMinBps) / 100}% per month`
              : `Example based on the ${formatUnitsRaw(config.minimumInvestment)} minimum investment`
          }
          className="span-7"
        >
          <RoiProjectionChart
            principal={principal || asset(config.minimumInvestment)}
            monthlyBps={Number(config.roiMinBps)}
            lockDays={lockDays}
            elapsedDays={elapsedDays}
          />
        </ChartCard>

        <section className="card span-5">
          <div className="card-head">
            <div>
              <h2 className="card-title">Position timers</h2>
              <p className="card-sub">Lock and claim state for this account</p>
            </div>
          </div>
          <div className="card-body">
            <Meter
              name="Lock elapsed"
              value={elapsedDays}
              limit={lockDays}
              display={`${elapsedDays} / ${lockDays} days`}
              foot={elapsedDays >= lockDays
                ? 'Principal is withdrawable'
                : `${lockDays - elapsedDays} days until principal unlocks`}
              colorVar={elapsedDays >= lockDays ? '--status-good' : '--series-1'}
            />
            <Meter
              name="ROI claimed"
              value={asset(profile?.roiClaimed)}
              limit={Math.max(roiAccrued, 1)}
              display={`${Math.round(ratio(asset(profile?.roiClaimed), Math.max(roiAccrued, 1)) * 100)}%`}
              foot={`${formatUnitsRaw(profile?.roiAccrued)} accrued, ${formatUnitsRaw(profile?.roiClaimed)} claimed`}
            />
            <Meter
              name="Treasury liquidity used"
              value={asset(config.totalLiabilities)}
              limit={Math.max(asset(config.treasuryBalance), 1)}
              display={`${compact(asset(config.totalLiabilities))} / ${compact(asset(config.treasuryBalance))}`}
              foot={`${formatUnitsRaw(config.availableLiquidity)} available`}
            />
          </div>
        </section>
      </div>

      <div className="grid-cards">
        <ChartCard
          title="Your reward mix"
          subtitle="Monthly ROI, referral rewards and team rewards by connected account"
          className="span-12"
          table={stackTable}
        >
          {rows.length > 0 ? (
            <RewardsStackChart rows={rows} />
          ) : (
            <p className="empty-state">No active position yet. Open Get started to fund your wallet and invest.</p>
          )}
        </ChartCard>
      </div>
    </>
  );
}
