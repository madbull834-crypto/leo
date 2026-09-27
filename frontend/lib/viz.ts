/** Shared chart helpers: scales, ticks, and compact value formatting. */

/**
 * Step ladder for axis rounding. A coarse 1/2/5 ladder is too blunt for real
 * data - it rounds 235,000 up to 500,000 and squashes every bar into the
 * bottom fifth of the plot - so intermediate steps are included.
 */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const step = NICE_STEPS.find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
}

/** Rounds an axis maximum up to a clean value on the step ladder. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  return niceStep(value);
}

/**
 * An axis maximum plus its ticks, chosen together so the ticks are clean
 * numbers AND the top gridline sits exactly at the plot ceiling.
 */
export function niceScale(dataMax: number, count = 4): { max: number; ticks: number[] } {
  if (dataMax <= 0) return { max: 1, ticks: [0, 1] };
  let step = niceStep(dataMax / count);
  while (step * count < dataMax) {
    step = niceStep(step * 1.05);
  }
  const max = step * count;
  return {
    max,
    ticks: Array.from({ length: count + 1 }, (_, i) => step * i),
  };
}

/** 1,284 / 12.9K / 4.2M - for axis ticks and large stat values. */
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 10_000) return `${trim(value / 1_000)}K`;
  return value.toLocaleString('en-US');
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

export function toNumber(value: bigint | number | undefined): number {
  if (value === undefined) return 0;
  return typeof value === 'bigint' ? Number(value) : value;
}

/** Clamped 0..1 ratio, safe when the denominator is zero. */
export function ratio(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(1, Math.max(0, part / whole));
}

/**
 * Whether a label of `text` fits inside a mark of `width` px with padding.
 * Labels are only drawn inside a mark when they fit - never clipped.
 */
export function labelFits(text: string, width: number, charPx = 6.6, padding = 16): boolean {
  return text.length * charPx + padding <= width;
}

/** Picks ink or white for a label set inside a colored fill. */
export function inkOn(hexLuminanceIsDark: boolean): string {
  return hexLuminanceIsDark ? '#ffffff' : '#0b0b0b';
}

/**
 * Tier bars use a single hue. An ordinal ramp cannot seat six steps: the blue
 * ramp's steps sit ~0.047 apart in lightness against a >= 0.06 gate, so no
 * six-step subset clears it on the light surface. It would also double-encode,
 * since bar length already shows the threshold - reached vs locked is carried
 * by opacity instead.
 */
export const TIER_COLOR_VAR = '--series-1';

/* --------------------------------------------------------------------------
   Bar paths: 4px rounded data-end, square at the baseline. A bar grows from
   one baseline, so only the growing end is rounded.
   -------------------------------------------------------------------------- */

/** Horizontal bar growing right; baseline is the left edge. */
export function barRight(x: number, y: number, w: number, h: number, r = 4): string {
  const radius = Math.max(0, Math.min(r, w, h / 2));
  return [
    `M${x},${y}`,
    `H${x + w - radius}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `V${y + h - radius}`,
    `Q${x + w},${y + h} ${x + w - radius},${y + h}`,
    `H${x}`,
    'Z',
  ].join(' ');
}

/** Horizontal bar growing left; baseline is the right edge at x + w. */
export function barLeft(x: number, y: number, w: number, h: number, r = 4): string {
  const radius = Math.max(0, Math.min(r, w, h / 2));
  return [
    `M${x + w},${y}`,
    `H${x + radius}`,
    `Q${x},${y} ${x},${y + radius}`,
    `V${y + h - radius}`,
    `Q${x},${y + h} ${x + radius},${y + h}`,
    `H${x + w}`,
    'Z',
  ].join(' ');
}

/** Vertical column growing up; baseline is the bottom edge at y + h. */
export function barUp(x: number, y: number, w: number, h: number, r = 4): string {
  const radius = Math.max(0, Math.min(r, h, w / 2));
  return [
    `M${x},${y + h}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + w - radius}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
}
