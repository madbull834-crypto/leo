import { Meter } from './ui/Meter';
import { CONTRACT_ADDRESS, DEPLOYMENT, RPC_URL } from '../lib/contract';
import { formatAddress, formatBps, formatDuration, formatTimestamp, formatUnitsRaw } from '../lib/format';
import { compact, toNumber } from '../lib/viz';
import { ACCOUNT_STATUS, type UserProfile } from '../types/lio';
import type { LioState } from '../hooks/useLio';

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="kv-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ProtocolTab({ state }: { state: LioState }) {
  const { config, profile } = state;
  if (!config) return null;

  return (
    <>
      <div className="grid-cards">
        <section className="card span-8">
          <div className="card-head">
            <div>
              <h2 className="card-title">Protocol configuration</h2>
              <p className="card-sub">Live values read from LioCore</p>
            </div>
            {config.paused ? (
              <span className="pill pill-warn"><span className="pill-icon">⏸</span>Paused</span>
            ) : (
              <span className="pill pill-good"><span className="pill-icon">●</span>Active</span>
            )}
          </div>
          <div className="card-body">
            <dl className="kv">
              <Item label="Treasury" value={<span className="mono">{formatAddress(config.treasury)}</span>} />
              <Item label="Payment asset" value={formatAddress(config.paymentAsset)} />
              <Item label="Minimum investment" value={formatUnitsRaw(config.minimumInvestment)} />
              <Item label="Direct referral" value={formatBps(config.directReferralBps)} />
              <Item label="Claim deduction" value={formatBps(config.claimDeductionBps)} />
              <Item label="Lock duration" value={formatDuration(config.lockDuration)} />
              <Item label="ROI range" value={`${formatBps(config.roiMinBps)} - ${formatBps(config.roiMaxBps)}`} />
              <Item label="ROI strategy" value={config.roiStrategyId.toString()} />
              <Item label="Current week id" value={config.currentWeekId.toString()} />
            </dl>
          </div>
        </section>

        <section className="card span-4">
          <div className="card-head">
            <div>
              <h2 className="card-title">Treasury</h2>
              <p className="card-sub">Liquidity against recorded liabilities</p>
            </div>
          </div>
          <div className="card-body">
            <div className="hero">
              <span className="hero-value">{compact(toNumber(config.availableLiquidity))}</span>
              <span className="hero-unit">available</span>
            </div>
            <Meter
              name="Liabilities vs balance"
              value={toNumber(config.totalLiabilities)}
              limit={Math.max(toNumber(config.treasuryBalance), 1)}
              display={`${compact(toNumber(config.totalLiabilities))} / ${compact(toNumber(config.treasuryBalance))}`}
              foot="releasePayout reverts when a payout exceeds available liquidity"
            />
          </div>
        </section>
      </div>

      <div className="grid-cards">
        <section className="card span-6">
          <div className="card-head">
            <div>
              <h2 className="card-title">Deployment</h2>
              <p className="card-sub">Written by scripts/deploy.ts</p>
            </div>
          </div>
          <div className="card-body">
            <dl className="kv">
              <Item label="Contract" value={<span className="mono">{CONTRACT_ADDRESS}</span>} />
              <Item label="Network" value={`${DEPLOYMENT.network} (${state.chainId})`} />
              <Item label="RPC" value={<span className="mono">{RPC_URL}</span>} />
              <Item label="Deployed" value={new Date(DEPLOYMENT.deployedAt).toLocaleString()} />
            </dl>
          </div>
        </section>

        <section className="card span-6">
          <div className="card-head">
            <div>
              <h2 className="card-title">Raw profile</h2>
              <p className="card-sub">Every UserProfile field for the selected account</p>
            </div>
          </div>
          <div className="card-body table-scroll">
            {profile ? <ProfileTable profile={profile} /> : <p className="empty-state">No account selected.</p>}
          </div>
        </section>
      </div>
    </>
  );
}

function ProfileTable({ profile }: { profile: UserProfile }) {
  const rows: Array<[string, string]> = [
    ['Status', ACCOUNT_STATUS[Number(profile.status)] ?? 'Unknown'],
    ['Active', profile.active ? 'true' : 'false'],
    ['Referrer', formatAddress(profile.referrer)],
    ['Principal', formatUnitsRaw(profile.principal)],
    ['ROI accrued', formatUnitsRaw(profile.roiAccrued)],
    ['ROI claimed', formatUnitsRaw(profile.roiClaimed)],
    ['Direct rewards', formatUnitsRaw(profile.directRewards)],
    ['Team rewards', formatUnitsRaw(profile.teamRewards)],
    ['Left business', formatUnitsRaw(profile.leftBusiness)],
    ['Right business', formatUnitsRaw(profile.rightBusiness)],
    ['Fresh business', formatUnitsRaw(profile.freshBusiness)],
    ['Claimable balance', formatUnitsRaw(profile.claimableBalance)],
    ['Total claimed', formatUnitsRaw(profile.totalClaimed)],
    ['Activated', formatTimestamp(profile.activationTimestamp)],
    ['Unlocks', formatTimestamp(profile.unlockTimestamp)],
  ];

  return (
    <table className="data">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td>{label}</td>
            <td className="num">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
