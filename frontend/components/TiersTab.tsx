import { ChartCard } from './ui/ChartCard';
import { TierLadderChart } from './charts/TierLadderChart';
import { TIER_VARS, toNumber } from '../lib/viz';
import type { LioState } from '../hooks/useLio';

export function TiersTab({ state }: { state: LioState }) {
  const { profile, tier, weeklyTiers, expenseTiers, tourRewards } = state;
  const matched = Math.min(
    toNumber(profile?.leftBusiness),
    toNumber(profile?.rightBusiness),
  ) * 2;
  const fresh = toNumber(profile?.freshBusiness);
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
                <span className="legend-swatch" style={{ background: `var(${TIER_VARS[index]})` }} />
                Tier {row.index + 1}
              </span>
            </td>
            <td className="num">{Number(row.threshold).toLocaleString('en-US')}</td>
            <td className="num">{Number(row.reward).toLocaleString('en-US')}</td>
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
          subtitle="Thresholds require equal qualifying volume from both legs"
          className="span-12"
          table={ladderTable}
        >
          <TierLadderChart tiers={weeklyTiers} combined={matched} achieved={achieved} />
        </ChartCard>
      </div>

      <div className="grid-cards">
        <section className="card span-6">
          <div className="card-head">
            <div>
              <h2 className="card-title">Expense benefit tiers</h2>
              <p className="card-sub">Qualified on fresh business ({fresh.toLocaleString('en-US')})</p>
            </div>
          </div>
          <div className="card-body table-scroll">
            <table className="data">
              <thead>
                <tr><th>#</th><th className="num">Threshold</th><th className="num">Benefit</th><th>Status</th></tr>
              </thead>
              <tbody>
                {expenseTiers.map((row) => (
                  <tr key={row.index} className={fresh >= Number(row.threshold) ? 'is-current' : undefined}>
                    <td>{row.index + 1}</td>
                    <td className="num">{Number(row.threshold).toLocaleString('en-US')}</td>
                    <td className="num">{Number(row.benefit).toLocaleString('en-US')}</td>
                    <td>{fresh >= Number(row.threshold) ? 'Qualified' : 'Not yet'}</td>
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
                    <td className="num">{Number(row.target).toLocaleString('en-US')}</td>
                    <td>{row.enabled ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">
              Qualification uses direct business: Thailand 10k, Bali 25k,
              Russia 50k, and Switzerland 100k.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
