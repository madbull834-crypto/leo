/**
 * THE LIOX lion mark.
 *
 * Brand chrome, not data: it uses the LIOX teal/cyan and the house gold rather
 * than the chart palette, so it never impersonates a series colour.
 *
 * Built to survive at 42px: the mane is a rosette of overlapping circles
 * (reads as fur, where a star polygon reads as spikes), the face is a simple
 * silhouette, and the eyes and muzzle are the only interior detail.
 */
const MANE = [
  [16.0, 8.1], [21.08, 9.95], [23.78, 14.63], [22.84, 19.95], [18.7, 23.42],
  [13.3, 23.42], [9.16, 19.95], [8.22, 14.63], [10.92, 9.95],
] as const;

export function LioxMark({ size = 42 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="THE LIOX"
      className="liox-mark"
    >
      <defs>
        <linearGradient id="liox-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#083a34" />
          <stop offset="100%" stopColor="#041f2e" />
        </linearGradient>
        <linearGradient id="liox-mane" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="55%" stopColor="#16dcc5" />
          <stop offset="100%" stopColor="#12b8b0" />
        </linearGradient>
      </defs>

      <rect width="32" height="32" rx="10" fill="url(#liox-tile)" />

      {/* Mane: overlapping circles visually union into a rosette. */}
      <g fill="url(#liox-mane)">
        {MANE.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={5} />
        ))}
        <circle cx="16" cy="16" r="8.6" />
      </g>

      {/* Ears sit on top of the mane, behind the face. */}
      <circle cx="10.9" cy="11.2" r="2.35" fill="#041f2e" />
      <circle cx="21.1" cy="11.2" r="2.35" fill="#041f2e" />

      {/* Face */}
      <circle cx="16" cy="16.3" r="6.9" fill="#041f2e" />

      {/* Eyes and muzzle - the only interior detail that reads at 42px. */}
      <circle cx="13.5" cy="14.9" r="1.3" fill="#f4c141" />
      <circle cx="18.5" cy="14.9" r="1.3" fill="#f4c141" />
      <path d="M16 18.1 l2.15 1.75 a2.15 2.15 0 0 1 -4.3 0 Z" fill="#f4c141" />
    </svg>
  );
}
