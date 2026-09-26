import { useEffect, useRef, useState } from 'react';

/**
 * Measures the chart container so the SVG viewBox can match its rendered
 * width 1:1.
 *
 * A fixed viewBox scales all its text with the container: the same 11px label
 * renders at ~21px inside a full-width card and ~7px on a phone. Sizing the
 * viewBox to the real width keeps every label at its intended size at any
 * breakpoint.
 */
export function useChartWidth(fallback = 560) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => {
      const next = node.clientWidth;
      if (next > 0) setWidth(next);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
