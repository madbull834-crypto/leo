import { ChartCard } from './ui/ChartCard';
import { Meter } from './ui/Meter';
import { StatTile } from './ui/StatTile';
import { LegBalanceChart } from './charts/LegBalanceChart';
import { RewardsStackChart, type StackRow } from './charts/RewardsStackChart';
import { RoiProjectionChart } from './charts/RoiProjectionChart';
import { ReferralCard } from './ReferralCard';
import { compact, ratio, toNumber } from '../lib/viz';
import { formatUnitsPrecise, formatUnitsRaw } from '../lib/format';
import { PAYMENT_ASSET_DECIMALS, PAYMENT_ASSET_SYMBOL } from '../lib/contract';
import type { Investor, LioState } from '../hooks/useLio';

const DAY = 86_400;

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function OverviewTab({ state, roiGenerated, roiAvailable }: {
  state: LioState;
  roiGenerated: bigint;
  roiAvailable: bigint;
}) {
  const { config, profile, tier, investors } = state;
  if (!config) return null;

  const scale = 10 ** PAYMENT_ASSET_DECIMALS;
  const asset = (value: bigint | undefined) => toNumber(value) / scale;
  const principal = asset(profile?.principal);
  const roiGeneratedAmount = asset(roiGenerated);
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
    roi: investor.address === state.account ? roiGeneratedAmount : asset(investor.profile.roiAccrued),
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
          foot={<span>{profile?.active ? `Unlocks after ${lockDays} days` : 'No active investment'}</span>} />
        <StatTile label="ROI generated" value={formatUnitsPrecise(roiGenerated)}
          foot={<span>{formatUnitsPrecise(roiAvailable)} available to claim</span>} />
        <StatTile label="Referral rewards" value={`${compact(directRewards)} ${PAYMENT_ASSET_SYMBOL}`}
          foot={<span>{Number(config.directReferralBps) / 100}% of referred volume</span>} />
        <StatTile label="Team rewards" value={`${compact(teamRewards)} ${PAYMENT_ASSET_SYMBOL}`}
          foot={<span>Weekly level {tierNumber || '-'}</span>} />
      </div>

      <div className="grid-cards">
        <ReferralCard
          account={state.account}
          active={Boolean(profile?.active)}
          rewardPercent={Number(config.directReferralBps) / 100}
        />
      </div>

      <div className="grid-cards">
        <section className="card span-4">
          <div className="card-head">
            <div>
              <h2 className="card-title">Your weekly reward level</h2>
              <p className="card-sub">Based on the balance between your left and right teams</p>
            </div>
          </div>
          <div className="card-body">
            <div className="hero">
              <span className="hero-value">{tierNumber}</span>
              <span className="hero-unit">of {state.weeklyTiers.length}</span>
            </div>
            <div style={{ marginTop: 14 }}>
              {profile?.active ? (
                <span className="pill pill-good"><span className="pill-icon">●</span>Investment active</span>
              ) : (
                <span className="pill"><span className="pill-icon">○</span>Not invested</span>
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
          title="Your left and right teams"
          subtitle="Weekly rewards are based on the smaller team"
          className="span-8"
          table={legTable}
        >
          <LegBalanceChart left={left} right={right} />
        </ChartCard>
      </div>

      <div className="grid-cards">
        <ChartCard
          title="How your ROI grows"
          subtitle={
            principal > 0
              ? `ROI accrues every second at ${Number(state.selectedMonthlyRoiBps) / 100}% per 30-day month`
              : `Example based on the ${formatUnitsRaw(config.minimumInvestment)} minimum investment`
          }
          className="span-7"
        >
          <RoiProjectionChart
            principal={principal || asset(config.minimumInvestment)}
            monthlyBps={Number(state.selectedMonthlyRoiBps || config.roiMinBps)}
            lockDays={lockDays}
            elapsedDays={elapsedDays}
          />
        </ChartCard>

        <section className="card span-5">
          <div className="card-head">
            <div>
              <h2 className="card-title">Important dates</h2>
              <p className="card-sub">See when your investment unlocks and how much ROI you have claimed</p>
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
              limit={Math.max(roiGeneratedAmount, 1)}
              display={`${Math.round(ratio(asset(profile?.roiClaimed), Math.max(roiGeneratedAmount, 1)) * 100)}%`}
              foot={`${formatUnitsPrecise(roiGenerated)} generated, ${formatUnitsRaw(profile?.roiClaimed)} claimed`}
            />
            <Meter
              name="Amount owed vs contract balance"
              value={asset(config.totalLiabilities)}
              limit={Math.max(asset(config.treasuryBalance), 1)}
              display={`${compact(asset(config.totalLiabilities))} / ${compact(asset(config.treasuryBalance))}`}
              foot={`${formatUnitsRaw(config.treasuryBalance)} currently held by the contract`}
            />
          </div>
        </section>
      </div>

      <div className="grid-cards">
        <ChartCard
          title="Where your earnings come from"
          subtitle="A simple breakdown of ROI, referral earnings and weekly team rewards"
          className="span-12"
          table={stackTable}
        >
          {rows.length > 0 ? (
            <RewardsStackChart rows={rows} />
          ) : (
            <p className="empty-state">No investment yet. Open Invest &amp; claim when you are ready to begin.</p>
          )}
        </ChartCard>
      </div>
    </>
  );
}
