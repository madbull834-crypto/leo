import { ratio } from '../../lib/viz';

/**
 * A single ratio against a limit. The fill carries severity; the track is a
 * lighter step of the same ramp so the state reads without a legend.
 */
export function Meter({
  name,
  value,
  limit,
  display,
  foot,
  colorVar = '--series-1',
}: {
  name: string;
  value: number;
  limit: number;
  display: string;
  foot?: string;
  colorVar?: string;
}) {
  const filled = ratio(value, limit);
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="meter-name">{name}</span>
        <span className="meter-val">{display}</span>
      </div>
      <div
        className="meter-track"
        role="meter"
        aria-valuenow={Math.round(filled * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={name}
      >
        <div
          className="meter-fill"
          style={{ width: `${filled * 100}%`, background: `var(${colorVar})` }}
        />
      </div>
      {foot && <div className="meter-foot">{foot}</div>}
    </div>
  );
}
