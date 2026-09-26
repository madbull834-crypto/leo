import { useState } from 'react';
import { Tooltip, type TooltipState } from '../ui/Tooltip';
import { barRight, compact, labelFits, niceMax } from '../../lib/viz';
import { useChartWidth } from '../../hooks/useChartWidth';

const PAD_L = 118;
const PAD_R = 76;
const PAD_T = 8;
const ROW_H = 38;
const BAR_H = 22;
const GAP = 2;          // surface gap between touching segments

export interface StackRow {
  key: string;
  label: string;
  direct: number;
  team: number;
  roi: number;
  isCurrent?: boolean;
}

const SERIES = [
  { key: 'direct' as const, name: 'Direct referral', colorVar: '--series-1' },
  { key: 'team' as const, name: 'Team / weekly', colorVar: '--series-2' },
  { key: 'roi' as const, name: 'ROI accrued', colorVar: '--series-3' },
];

/**
 * Reward composition per investor - part-to-whole across three components, so
 * a horizontal stacked bar (long labels, few segments). Three categorical
 * slots, validated all-pairs in both modes.
 *
 * Slot 3 sits below 3:1 on the light surface, so the relief rule applies:
 * segment values are direct-labelled where they fit and the card ships a
 * table view, keeping every number reachable without colour or hover.
 */
export function RewardsStackChart({ rows }: { rows: StackRow[] }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const { ref, width: W } = useChartWidth(1100);
  const PLOT_W = Math.max(W - PAD_L - PAD_R, 60);

  const totals = rows.map((row) => row.direct + row.team + row.roi);
  const max = niceMax(Math.max(...totals, 1));
  const height = PAD_T + rows.length * ROW_H + 26;
  const scale = (value: number) => (value / max) * PLOT_W;

  return (
    <div className="chart-wrap" ref={ref} onPointerLeave={() => setTip(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img"
        aria-label="Reward composition by investor">
        {rows.map((row, rowIndex) => {
          const y = PAD_T + rowIndex * ROW_H;
          const total = row.direct + row.team + row.roi;
          let cursor = PAD_L;

          return (
            <g key={row.key}>
              <text
                className="mark-label"
                x={PAD_L - 10}
                y={y + BAR_H / 2 + 4}
                textAnchor="end"
                style={{ fontWeight: row.isCurrent ? 600 : 400 }}
              >
                {row.label}
              </text>

              {SERIES.map((series) => {
                const value = row[series.key];
                if (value <= 0) return null;
                const width = Math.max(scale(value) - GAP, 1);
                const x = cursor;
                cursor += scale(value);

                const text = compact(value);
                const fits = labelFits(text, width);

                return (
                  <g key={series.key}>
                    <path
                      className="mark"
                      d={barRight(x, y, width, BAR_H)}
                      fill={`var(${series.colorVar})`}
                    />
                    {/* Only drawn when it fits with padding - never clipped. */}
                    {fits && (
                      <text
                        className="mark-value-inset"
                        x={x + width / 2}
                        y={y + BAR_H / 2 + 4}
                        textAnchor="middle"
                        fill="var(--on-fill)"
                      >
                        {text}
                      </text>
                    )}
                    <rect
                      className="hit"
                      x={x} y={y - 6} width={width} height={BAR_H + 12}
                      onPointerMove={() =>
                        setTip({
                          x: x + width / 2,
                          y,
                          title: row.label,
                          rows: [
                            { label: series.name, value: value.toLocaleString('en-US'), colorVar: series.colorVar },
                            { label: 'Row total', value: total.toLocaleString('en-US') },
                          ],
                        })
                      }
                    />
                  </g>
                );
              })}

              {/* Row total rides outside the bar end. */}
              <text className="mark-value" x={PAD_L + scale(total) + 9} y={y + BAR_H / 2 + 4}>
                {compact(total)}
              </text>
            </g>
          );
        })}

        <line className="axis-line" x1={PAD_L} y1={PAD_T + rows.length * ROW_H - 8}
          x2={W - PAD_R} y2={PAD_T + rows.length * ROW_H - 8} />
        <text className="axis-text" x={PAD_L} y={PAD_T + rows.length * ROW_H + 10}>
          Rewards accrued (business units)
        </text>
      </svg>

      <div className="legend">
        {SERIES.map((series) => (
          <span className="legend-item" key={series.key}>
            <span className="legend-swatch" style={{ background: `var(${series.colorVar})` }} />
            {series.name}
          </span>
        ))}
      </div>

      <Tooltip state={tip} />
    </div>
  );
}
