import { useState } from 'react';
import { Tooltip, type TooltipState } from '../ui/Tooltip';
import { barUp, compact, niceScale, TIER_COLOR_VAR } from '../../lib/viz';
import { useChartWidth } from '../../hooks/useChartWidth';
import type { WeeklyTier } from '../../types/lio';

const H = 300;
const PAD_L = 62;
const PAD_R = 24;
const PAD_T = 26;
const PAD_B = 46;
const PLOT_H = H - PAD_T - PAD_B;
const BAR_MAX = 24;

/**
 * Weekly tier thresholds as an ordered ladder. Tiers are an ordinal scale, so
 * the bars use a single-hue ordinal ramp (light -> dark with rank) rather than
 * categorical hues - the categories have a natural order and no identity.
 * The reader's own volume rides as a reference line.
 */
export function TierLadderChart({
  tiers,
  combined,
  achieved,
}: {
  tiers: WeeklyTier[];
  combined: number;
  achieved: number;
}) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const { ref, width: W } = useChartWidth(1100);
  const PLOT_W = Math.max(W - PAD_L - PAD_R, 60);

  const values = tiers.map((t) => Number(t.threshold));
  const { max, ticks: axisTicks } = niceScale(Math.max(...values, combined, 1));
  const y = (value: number) => PAD_T + PLOT_H - (value / max) * PLOT_H;

  const band = PLOT_W / tiers.length;
  const barW = Math.min(BAR_MAX, band - 18);
  const refY = y(combined);

  return (
    <div className="chart-wrap" ref={ref} onPointerLeave={() => setTip(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Weekly tier thresholds with your current matched business volume">
        {axisTicks.map((tick) => (
          <g key={tick}>
            <line className="grid-line" x1={PAD_L} y1={y(tick)} x2={W - PAD_R} y2={y(tick)} />
            <text className="axis-text" x={PAD_L - 8} y={y(tick) + 4} textAnchor="end">
              {compact(tick)}
            </text>
          </g>
        ))}

        {tiers.map((tier, index) => {
          const value = Number(tier.threshold);
          const cx = PAD_L + band * index + band / 2;
          const top = y(value);
          const height = PAD_T + PLOT_H - top;
          const isAchieved = index < achieved;

          return (
            <g key={tier.index}>
              <path
                className={`mark${achieved > 0 && !isAchieved ? ' mark-dim' : ''}`}
                d={barUp(cx - barW / 2, top, barW, height)}
                fill={`var(${TIER_COLOR_VAR})`}
              />
              <rect
                className="hit"
                x={cx - band / 2} y={PAD_T} width={band} height={PLOT_H}
                onPointerMove={() =>
                  setTip({
                    x: cx, y: top,
                    title: `Tier ${tier.index + 1}`,
                    rows: [
                      { label: 'Threshold', value: value.toLocaleString('en-US'), colorVar: TIER_COLOR_VAR },
                      { label: 'Weekly reward', value: Number(tier.reward).toLocaleString('en-US') },
                      { label: 'Status', value: isAchieved ? 'Reached' : 'Locked' },
                    ],
                  })
                }
              />
              {/* Thresholds span 40x, so the low tiers are only a few pixels
                  tall. The value rides on the cap - outside the mark, never
                  clipped inside it - so every bar stays readable. */}
              <text className="mark-value" x={cx} y={top - 8} textAnchor="middle">
                {compact(value)}
              </text>
              <text className="axis-text" x={cx} y={H - PAD_B + 18} textAnchor="middle">
                T{tier.index + 1}
              </text>
            </g>
          );
        })}

        {/* Reference line: the reader's own volume, direct-labelled once. */}
        {combined > 0 && refY > PAD_T && (
          <g>
            <line className="axis-line" x1={PAD_L} y1={refY} x2={W - PAD_R} y2={refY} />
            <text className="mark-value" x={W - PAD_R} y={refY - 7} textAnchor="end">
              You {compact(combined)}
            </text>
          </g>
        )}

        <line className="axis-line" x1={PAD_L} y1={PAD_T + PLOT_H} x2={W - PAD_R} y2={PAD_T + PLOT_H} />
        <text className="axis-text" x={PAD_L} y={H - 6}>Weekly team tier</text>
      </svg>

      <Tooltip state={tip} />
    </div>
  );
}
