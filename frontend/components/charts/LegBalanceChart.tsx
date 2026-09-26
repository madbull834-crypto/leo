import { useState } from 'react';
import { Tooltip, type TooltipState } from '../ui/Tooltip';
import { barLeft, barRight, niceMax } from '../../lib/viz';
import { useChartWidth } from '../../hooks/useChartWidth';

const H = 150;
const LABEL_ROOM = 88;  // keeps the end labels inside the plot
const BAR_H = 24;       // mark spec cap
const GAP = 2;          // surface gap either side of the baseline
const BAR_Y = 34;

/**
 * Binary-leg balance as a diverging bar centred on the baseline. Left and
 * right legs are opposite directions on one axis, so a diverging form is the
 * honest one; the poles are blue/orange (cool/warm reads as opposite) with a
 * neutral gap at the midpoint rather than a hue.
 */
export function LegBalanceChart({
  left,
  right,
}: {
  left: number;
  right: number;
}) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const { ref, width: W } = useChartWidth(720);
  const CENTER = W / 2;
  const HALF = Math.max(CENTER - LABEL_ROOM, 40);

  // A centre line with two zero-length bars reads as a broken chart, so an
  // account with no volume gets an explicit empty state instead.
  if (left === 0 && right === 0) {
    return (
      <p className="empty-state">
        No business volume recorded for this account yet. An operator sets leg
        volumes with updateUserBusiness.
      </p>
    );
  }

  const max = niceMax(Math.max(left, right, 1));
  const scale = (value: number) => (value / max) * HALF;

  const leftW = scale(left);
  const rightW = scale(right);
  const weaker = Math.min(left, right);
  const carry = Math.abs(left - right);

  const show = (label: string, value: number, colorVar: string, x: number) =>
    setTip({
      x,
      y: BAR_Y,
      title: label,
      rows: [
        { label: 'Volume', value: value.toLocaleString('en-US'), colorVar },
        { label: 'Share', value: `${Math.round((value / Math.max(left + right, 1)) * 100)}%` },
      ],
    });

  return (
    <div className="chart-wrap" ref={ref} onPointerLeave={() => setTip(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Left leg ${left.toLocaleString()}, right leg ${right.toLocaleString()}`}>
        {/* Baseline at the centre - the axis both legs grow from. */}
        <line className="axis-line" x1={CENTER} y1={20} x2={CENTER} y2={BAR_Y + BAR_H + 12} />

        {/* Left leg */}
        {leftW > 0 && (
          <path
            className="mark"
            d={barLeft(CENTER - GAP - leftW, BAR_Y, leftW, BAR_H)}
            fill="var(--series-1)"
          />
        )}
        <rect
          className="hit"
          x={CENTER - GAP - Math.max(leftW, 8)} y={BAR_Y - 8}
          width={Math.max(leftW, 8)} height={BAR_H + 16}
          onPointerMove={() => show('Left leg', left, '--series-1', CENTER - GAP - leftW / 2)}
        />

        {/* Right leg */}
        {rightW > 0 && (
          <path
            className="mark"
            d={barRight(CENTER + GAP, BAR_Y, rightW, BAR_H)}
            fill="var(--series-2)"
          />
        )}
        <rect
          className="hit"
          x={CENTER + GAP} y={BAR_Y - 8}
          width={Math.max(rightW, 8)} height={BAR_H + 16}
          onPointerMove={() => show('Right leg', right, '--series-2', CENTER + GAP + rightW / 2)}
        />

        {/* Direct labels ride outside the bar ends, so nothing is clipped. */}
        <text className="mark-value" x={CENTER - GAP - leftW - 8} y={BAR_Y + BAR_H / 2 + 4} textAnchor="end">
          {left.toLocaleString('en-US')}
        </text>
        <text className="mark-value" x={CENTER + GAP + rightW + 8} y={BAR_Y + BAR_H / 2 + 4}>
          {right.toLocaleString('en-US')}
        </text>

        {/* Weaker leg is what a binary plan actually pays on. */}
        <text className="axis-text" x={CENTER} y={H - 22} textAnchor="middle">
          Weaker leg {weaker.toLocaleString('en-US')}
        </text>
        <text className="axis-text" x={CENTER} y={H - 6} textAnchor="middle">
          Carry forward {carry.toLocaleString('en-US')}
        </text>
      </svg>

      <div className="legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--series-1)' }} />
          Left leg
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--series-2)' }} />
          Right leg
        </span>
      </div>

      <Tooltip state={tip} />
    </div>
  );
}
