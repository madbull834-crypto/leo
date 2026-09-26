import type { ReactNode } from 'react';

export function StatTile({
  label,
  value,
  foot,
  className = 'span-3',
}: {
  label: string;
  value: string;
  foot?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </section>
  );
}
