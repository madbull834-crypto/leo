import { ChartCard } from './ui/ChartCard';
import { TierLadderChart } from './charts/TierLadderChart';
import { TIER_COLOR_VAR, toNumber } from '../lib/viz';
import { PAYMENT_ASSET_DECIMALS, PAYMENT_ASSET_SYMBOL } from '../lib/contract';
import type { LioState } from '../hooks/useLio';

export function TiersTab({ state }: { state: LioState }) {
  const { profile, tier, weeklyTiers, expenseTiers, tourRewards } = state;
  const scale = 10 ** PAYMENT_ASSET_DECIMALS;
  const asset = (value: bigint | undefined) => toNumber(value) / scale;
  const matched = Math.min(
    asset(profile?.leftBusiness),
    asset(profile?.rightBusiness),
  ) * 2;
  const fresh = asset(profile?.freshBusiness);
  const achieved = Number(tier ?? 0n);

  const ladderTable = (
    <table className="data">
      <thead>
        <tr>
          <th>Tier</th>
          <th className="num">Threshold</th>
          <th className="num">Weekly reward</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {weeklyTiers.map((row, index) => (
          <tr key={row.index} className={index + 1 === achieved ? 'is-current' : undefined}>
            <td>
              <span className="swatch-cell">
                <span className="legend-swatch" style={{ background: `var(${TIER_COLOR_VAR})`, opacity: index < achieved ? 1 : 0.45 }} />
                Tier {row.index + 1}
              </span>
            </td>
            <td className="num">{asset(row.threshold).toLocaleString('en-US')} {PAYMENT_ASSET_SYMBOL}</td>
            <td className="num">{asset(row.reward).toLocaleString('en-US')} {PAYMENT_ASSET_SYMBOL}</td>
            <td>{index < achieved ? 'Reached' : 'Locked'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <div className="grid-cards">
        <ChartCard
          title="Weekly team tier ladder"
          subtitle="Your left and right teams must contribute equally to unlock each level"
          className="span-12"
          table={ladderTable}
        >
          <TierLadderChart tiers={weeklyTiers.map((row) => ({ ...row, threshold: BigInt(Math.round(asset(row.threshold))) }))} combined={matched} achieved={achieved} />
        </ChartCard>
      </div>

      <div className="grid-cards">
        <section className="card span-6">
          <div className="card-head">
            <div>
              <h2 className="card-title">Business milestone benefits</h2>
              <p className="card-sub">Based on {fresh.toLocaleString('en-US')} {PAYMENT_ASSET_SYMBOL} in new business</p>
            </div>
          </div>
          <div className="card-body table-scroll">
            <table className="data">
              <thead>
                <tr><th>#</th><th className="num">Threshold</th><th className="num">Benefit</th><th>Status</th></tr>
              </thead>
              <tbody>
                {expenseTiers.map((row) => (
                  <tr key={row.index} className={fresh >= asset(row.threshold) ? 'is-current' : undefined}>
                    <td>{row.index + 1}</td>
                    <td className="num">{asset(row.threshold).toLocaleString('en-US')}</td>
                    <td className="num">{asset(row.benefit).toLocaleString('en-US')}</td>
                    <td>{fresh >= asset(row.threshold) ? 'Unlocked' : 'In progress'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card span-6">
          <div className="card-head">
            <div>
              <h2 className="card-title">Tour rewards</h2>
              <p className="card-sub">Destinations configured on deployment</p>
            </div>
          </div>
          <div className="card-body table-scroll">
            <table className="data">
              <thead>
                <tr><th>#</th><th>Destination</th><th className="num">Target</th><th>Enabled</th></tr>
              </thead>
              <tbody>
                {tourRewards.map((row) => (
                  <tr key={row.index}>
                    <td>{row.index + 1}</td>
                    <td>{row.name}</td>
                    <td className="num">{asset(row.target).toLocaleString('en-US')} {PAYMENT_ASSET_SYMBOL}</td>
                    <td>{row.enabled ? 'Available' : 'Unavailable'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">
              Tour milestones are based on your personally referred business volume.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
