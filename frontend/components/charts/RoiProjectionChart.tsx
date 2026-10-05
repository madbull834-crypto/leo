import { useMemo, useRef, useState } from 'react';
import { Tooltip, type TooltipState } from '../ui/Tooltip';
import { compact, niceScale } from '../../lib/viz';
import { useChartWidth } from '../../hooks/useChartWidth';

const H = 250;
const PAD_L = 50;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 40;
const PLOT_H = H - PAD_T - PAD_B;
const MONTH_DAYS = 30;

export interface RoiPoint {
  day: number;
  value: number;
  month: number;
}

/**
 * Cumulative ROI across the lock period. The contract prorates the monthly
 * rate per second, so the projection is continuous.
 *
 * One series, so no legend box: the card title names what is plotted.
 */
export function RoiProjectionChart({
  principal,
  monthlyBps,
  lockDays,
  elapsedDays,
}: {
  principal: number;
  monthlyBps: number;
  lockDays: number;
  elapsedDays: number;
}) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref, width: W } = useChartWidth(620);
  const PLOT_W = Math.max(W - PAD_L - PAD_R, 60);

  const { points, scale } = useMemo(() => {
    const perMonth = (principal * monthlyBps) / 10_000;
    const points: RoiPoint[] = [];
    for (let day = 0; day <= lockDays; day += MONTH_DAYS) {
      points.push({ day, value: perMonth * (day / MONTH_DAYS), month: day / MONTH_DAYS });
    }
    if (points[points.length - 1]?.day !== lockDays) {
      points.push({ day: lockDays, value: perMonth * (lockDays / MONTH_DAYS), month: lockDays / MONTH_DAYS });
    }
    return { points, scale: niceScale(Math.max(perMonth * (lockDays / MONTH_DAYS), 1)) };
  }, [principal, monthlyBps, lockDays]);

  const { max, ticks: axisTicks } = scale;
  const x = (day: number) => PAD_L + (day / lockDays) * PLOT_W;
  const y = (value: number) => PAD_T + PLOT_H - (value / max) * PLOT_H;

  const path = useMemo(() => {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.day)},${y(point.value)}`).join(' ');
  }, [points, max, lockDays, PLOT_W, W]);

  const areaPath = `${path} L${x(lockDays)},${y(0)} L${x(0)},${y(0)} Z`;

  const valueAt = (day: number) => {
    const month = Math.min(day / MONTH_DAYS, lockDays / MONTH_DAYS);
    return { month, value: ((principal * monthlyBps) / 10_000) * month };
  };

  const handleMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const day = Math.round(((px - PAD_L) / PLOT_W) * lockDays);
    if (day < 0 || day > lockDays) {
      setTip(null);
      setCursor(null);
      return;
    }
    const { month, value } = valueAt(day);
    setCursor(day);
    setTip({
      x: x(day),
      y: y(value),
      title: `Day ${day}`,
      rows: [
        { label: 'Accrued ROI', value: value.toLocaleString('en-US'), colorVar: '--series-1' },
        { label: 'Months prorated', value: `${month.toFixed(2)} of ${(lockDays / MONTH_DAYS).toFixed(2)}` },
      ],
    });
  };

  const elapsedClamped = Math.min(elapsedDays, lockDays);

  return (
    <div className="chart-wrap" ref={ref} onPointerLeave={() => { setTip(null); setCursor(null); }}>
      <svg
        ref={svgRef}
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        onPointerMove={handleMove}
        role="img"
        aria-label="Cumulative ROI accrual across the lock period"
      >
        {axisTicks.map((tick) => (
          <g key={tick}>
            <line className="grid-line" x1={PAD_L} y1={y(tick)} x2={W - PAD_R} y2={y(tick)} />
            <text className="axis-text" x={PAD_L - 8} y={y(tick) + 4} textAnchor="end">
              {compact(tick)}
            </text>
          </g>
        ))}

        {/* Area fill is a ~10% wash, never a saturated block. */}
        <path d={areaPath} fill="var(--series-1)" opacity={0.10} />
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Where the reader actually is today. */}
        {elapsedClamped > 0 && (
          <g>
            <line className="axis-line" x1={x(elapsedClamped)} y1={PAD_T}
              x2={x(elapsedClamped)} y2={PAD_T + PLOT_H} />
            <circle cx={x(elapsedClamped)} cy={y(valueAt(elapsedClamped).value)} r={5}
              fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
            <text className="mark-value" x={x(elapsedClamped) + 8} y={PAD_T + 12}>
              Today
            </text>
          </g>
        )}

        {cursor !== null && (
          <line className="crosshair" x1={x(cursor)} y1={PAD_T} x2={x(cursor)} y2={PAD_T + PLOT_H} />
        )}

        <line className="axis-line" x1={PAD_L} y1={PAD_T + PLOT_H} x2={W - PAD_R} y2={PAD_T + PLOT_H} />

        {[0, 60, 120, lockDays].map((day) => (
          <text key={day} className="axis-text" x={x(day)} y={H - PAD_B + 18} textAnchor="middle">
            {day === 0 ? 'Day 0' : `${day}d`}
          </text>
        ))}
        <text className="axis-text" x={PAD_L} y={H - 4}>Lock period</text>
      </svg>

      <Tooltip state={tip} />
    </div>
  );
}
