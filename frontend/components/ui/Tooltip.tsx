export interface TooltipRow {
  label: string;
  value: string;
  colorVar?: string;
}

export interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
}

/**
 * Values lead, labels follow. Series are keyed with a short stroke rather than
 * a filled box - at tooltip density a box is data-weight ink doing a label's job.
 */
export function Tooltip({ state }: { state: TooltipState | null }) {
  if (!state) return null;
  return (
    <div className="tooltip" style={{ left: state.x, top: state.y }} role="status">
      <div className="tooltip-title">{state.title}</div>
      {state.rows.map((row) => (
        <div className="tooltip-row" key={row.label}>
          <span className="tooltip-key">
            {row.colorVar && (
              <span
                className="tooltip-stroke"
                style={{ background: `var(${row.colorVar})` }}
              />
            )}
            {row.label}
          </span>
          <span className="tooltip-val">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
