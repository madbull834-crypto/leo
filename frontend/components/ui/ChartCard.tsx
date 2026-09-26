import { useState, type ReactNode } from 'react';

/**
 * Wraps a chart with its title and a chart/table switch. The table view is the
 * accessibility fallback required whenever a series colour sits below 3:1 on
 * the surface, and it keeps every value reachable without hovering.
 */
export function ChartCard({
  title,
  subtitle,
  className = 'span-6',
  table,
  children,
  aside,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  table?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <div>
          <h2 className="card-title">{title}</h2>
          {subtitle && <p className="card-sub">{subtitle}</p>}
        </div>
        {table ? (
          <div className="seg" role="group" aria-label={`${title} view`}>
            <button
              type="button"
              aria-pressed={view === 'chart'}
              onClick={() => setView('chart')}
            >
              Chart
            </button>
            <button
              type="button"
              aria-pressed={view === 'table'}
              onClick={() => setView('table')}
            >
              Table
            </button>
          </div>
        ) : (
          aside
        )}
      </div>
      <div className="card-body">
        {view === 'chart' ? children : <div className="table-scroll">{table}</div>}
      </div>
    </section>
  );
}
