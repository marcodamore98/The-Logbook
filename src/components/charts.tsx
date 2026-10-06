import { useState } from 'react';
import type { Count } from '../lib/stats';
import { Empty } from './ui';

export const fmt = (n: number, d = 0) => n.toLocaleString('it-IT', { maximumFractionDigits: d });

/** Horizontal bar list: magnitude by category, single hue, value labels in ink. */
export function BarList({ data, unit = '', max = 8, plain = false }: { data: Count[]; unit?: string; max?: number; /** Rows "name … value" without bars (long names, rankings read as a list). */ plain?: boolean }) {
  if (!data.length) return <Empty>Nessun dato nel periodo.</Empty>;
  const shown = data.slice(0, max);
  const rest = data.slice(max).reduce((n, c) => n + c.value, 0);
  const rows = rest ? [...shown, { label: 'Altro', value: rest }] : shown;
  const top = Math.max(...rows.map((r) => r.value));
  return (
    <ul className={`barlist${plain ? ' plain' : ''}`}>
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${fmt(r.value, 1)}${unit}`}>
          <span className="barlist-label">{r.label}</span>
          {!plain && (
            <span className="barlist-track">
              <span className="barlist-bar" style={{ width: `${(r.value / top) * 100}%` }} />
            </span>
          )}
          <span className="barlist-value">
            {fmt(r.value, 1)}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}


export interface Bucket {
  label: string;
  full: string;
  value: number;
}

/** Columns over time (days of the week/month, months of the year). Hover or tap a column for its value. */
export function Columns({ buckets, unit, title = 'Andamento nel periodo', digits = 1 }: { buckets: Bucket[]; unit: string; title?: string; digits?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!buckets.some((b) => b.value > 0)) return <Empty>Nessun dato nel periodo.</Empty>;
  const W = 360, H = 150, pad = { l: 30, r: 4, t: 16, b: 20 };
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const niceMax = max <= 5 ? (digits === 0 ? Math.ceil(max / 2) * 2 : Math.ceil(max)) : max <= 20 ? Math.ceil(max / 2) * 2 : Math.ceil(max / 10) * 10;
  const bw = (W - pad.l - pad.r) / buckets.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const step = buckets.length > 14 ? Math.ceil(buckets.length / 7) : 1;
  // thin columns: never wider than 24px
  const w = Math.min(24, Math.max(2, bw - 2));
  return (
    <div className="columns-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="columns" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {[niceMax / 2, niceMax].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} className="grid-line" />
            <text x={pad.l - 6} y={y(g) + 3} className="axis-label" textAnchor="end">
              {fmt(g, 1)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const x = pad.l + i * bw + (bw - w) / 2;
          const h = y(0) - y(b.value);
          const r = Math.min(4, w / 2, h);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {b.value > 0 && buckets.length <= 12 && (
                <text x={x + w / 2} y={y(b.value) - 4} className="col-value" textAnchor="middle">
                  {fmt(b.value, digits)}
                </text>
              )}
              {b.value > 0 && (
                <path
                  className={`col${hover === i ? ' col-hover' : ''}`}
                  d={`M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                />
              )}
              {i % step === 0 && (
                <text x={pad.l + (i + 0.5) * bw} y={H - 6} className="axis-label" textAnchor="middle">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="base-line" />
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${Math.min(85, Math.max(15, ((pad.l + (hover + 0.5) * bw) / W) * 100))}%` }}>
          <strong>{buckets[hover].full}</strong>
          <span>
            {fmt(buckets[hover].value, digits)}
            {unit}
          </span>
        </div>
      )}
      <details className="table-view">
        <summary>Vedi come tabella</summary>
        <table>
          <tbody>
            {buckets
              .filter((b) => b.value > 0)
              .map((b, i) => (
                <tr key={i}>
                  <td>{b.full}</td>
                  <td className="num">
                    {fmt(b.value, digits)}
                    {unit}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/**
 * Line with dots (pace per run, weight per day, % per month…).
 * `better` says which direction is an improvement ('none': no verdict); improvement is drawn upwards.
 */
export function Trend({
  points,
  format,
  better = 'down',
  title,
  noun = 'corse',
  worseWord,
  minSpan = 0,
  target,
}: {
  points: { label: string; value: number }[];
  format: (v: number) => string;
  better?: 'up' | 'down' | 'none';
  title: string;
  noun?: string;
  worseWord?: string;
  /** Smallest vertical range (in value units), so small wobbles (±0.2 kg) don't look like big swings. */
  minSpan?: number;
  /** Goal drawn as a dashed reference line (e.g. target weight). */
  target?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <Empty>Servono almeno due {noun} per vedere l’andamento.</Empty>;
  const W = 360, H = 150, pad = { l: 44, r: 10, t: 10, b: 24 };
  const vals = points.map((p) => p.value);
  const vMin = Math.min(...vals, target ?? Infinity), vMax = Math.max(...vals, target ?? -Infinity);
  const pad2 = Math.max(0, minSpan - (vMax - vMin)) / 2;
  const lo = vMin - pad2, hi = vMax + pad2;
  const span = hi - lo || 1;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => {
    const t = (v - lo) / span;
    return pad.t + (H - pad.t - pad.b) * (better === 'down' ? t : 1 - t);
  };
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const first = vals[0], lastV = vals[vals.length - 1];
  const improved = better === 'down' ? lastV < first : lastV > first;
  const step = points.length > 6 ? Math.ceil(points.length / 5) : 1;
  const many = points.length > 20;
  return (
    <div className="columns-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="columns" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {(lo === hi ? [lo] : [lo, hi]).map((g, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} className="grid-line" />
            <text x={pad.l - 6} y={y(g) + 3} className="axis-label" textAnchor="end">
              {format(g)}
            </text>
          </g>
        ))}
        {target !== undefined && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} className="target-line" />
            <text x={W - pad.r} y={y(target) - 4} className="axis-label" textAnchor="end">
              obiettivo {format(target)}
            </text>
          </g>
        )}
        <path d={d} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
            <rect x={x(i) - (W - pad.l - pad.r) / points.length / 2} y={pad.t} width={(W - pad.l - pad.r) / points.length} height={H - pad.t - pad.b} fill="transparent" />
            {(!many || i === points.length - 1 || hover === i) && (
              <circle cx={x(i)} cy={y(p.value)} r={hover === i || i === points.length - 1 ? 5 : 4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
            )}
            {i % step === 0 && (
              <text x={x(i)} y={H - 6} className="axis-label" textAnchor={i === 0 ? 'start' : i === points.length - 1 || x(i) > W - 30 ? 'end' : 'middle'}>
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${Math.min(85, Math.max(15, (x(hover) / W) * 100))}%` }}>
          <strong>{points[hover].label}</strong>
          <span>{format(points[hover].value)}</span>
        </div>
      )}
      {better !== 'none' && (
        <p className={`trend-note ${improved ? 'better' : 'worse'}`}>
          {improved ? '▲ In miglioramento' : `▼ ${worseWord ?? (better === 'up' ? 'In calo' : 'Più lento')}`}: da {format(first)} a {format(lastV)}
        </p>
      )}
    </div>
  );
}

/** ▲/▼ against the previous period; `better` 'none' when neither direction is good or bad (e.g. hours on shift). */
export function Delta({ cur, prev, better = 'up', fmtv }: { cur?: number; prev?: number; better?: 'up' | 'down' | 'none'; fmtv?: (v: number) => string }) {
  if (cur === undefined || prev === undefined || prev === 0 || Math.abs(cur - prev) < 1e-9) return null;
  const d = cur - prev;
  const tone = better === 'none' ? 'neutral' : (better === 'up' ? d > 0 : d < 0) ? 'better' : 'worse';
  return (
    <span className={`delta ${tone}`} title="Rispetto al periodo precedente">
      {d > 0 ? '▲' : '▼'} {fmtv ? fmtv(Math.abs(d)) : fmt(Math.abs(d), 1)}
    </span>
  );
}

export interface KpiItem {
  label: string;
  value: string;
  unit?: string;
  /** Line under the number (e.g. "di cui 4 da solo"). */
  note?: string;
  delta?: { cur?: number; prev?: number; better?: 'up' | 'down' | 'none'; fmtv?: (v: number) => string };
  hi?: boolean;
}

/** The section's headline numbers: big figure, unit, change against the previous period. */
export function Kpis({ items }: { items: KpiItem[] }) {
  return (
    <div className={`kpis${items.length === 3 ? ' three' : ''}`}>
      {items.map((k) => (
        <div key={k.label} className="kpi">
          <span className="stat-label">{k.label}</span>
          <strong className={k.hi ? 'hi' : undefined}>
            {k.value}
            {k.unit && <small> {k.unit}</small>}
          </strong>
          {k.delta && <Delta {...k.delta} />}
          {k.note && <span className="kpi-note">{k.note}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Parts of a whole as one bar with 2px gaps and a legend with values.
 * `ordinal`: ordered categories (roles from most to least autonomous) drawn as one hue from dark to light;
 * otherwise up to three validated categorical colours.
 */
export function Stack({ data, unit = '', ordinal = false, label }: { data: Count[]; unit?: string; ordinal?: boolean; label: string }) {
  const rows = data.filter((d) => d.value > 0);
  const total = rows.reduce((n, x) => n + x.value, 0);
  if (!total) return <Empty>Nessun dato nel periodo.</Empty>;
  // ordinal: spread the steps of the ramp over the categories (3 roles → darkest, middle, lightest)
  const colour = (i: number) => (ordinal ? `var(--ord-${Math.round((i * 4) / Math.max(1, data.length - 1)) + 1})` : `var(--cat-${(i % 3) + 1})`);
  return (
    <figure className="stack" aria-label={label}>
      <div className="stack-bar" role="img" aria-label={rows.map((r) => `${r.label} ${fmt((r.value / total) * 100)}%`).join(', ')}>
        {rows.map((x) => (
          <span key={x.label} style={{ flexGrow: x.value, background: colour(data.indexOf(x)) }} title={`${x.label}: ${fmt(x.value, 1)}${unit} (${fmt((x.value / total) * 100)}%)`} />
        ))}
      </div>
      <ul className="stack-legend">
        {rows.map((x) => (
          <li key={x.label}>
            <i style={{ background: colour(data.indexOf(x)) }} />
            <span className="sl-name">{x.label}</span>
            <span className="sl-val">
              {fmt(x.value, 1)}
              {unit} <small>{fmt((x.value / total) * 100)}%</small>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** "12 of 20 days": a thin meter with the fraction in words. */
export function Progress({ label, value, of }: { label: string; value: number; of: number }) {
  const pct = of > 0 ? Math.min(1, value / of) : 0;
  return (
    <div className="progress-row">
      <span className="pr-label">{label}</span>
      <span className="pr-val">
        {value} <small>su {of}</small>
      </span>
      <span className="meter">
        <span className="meter-fill" style={{ width: `${pct * 100}%` }} />
      </span>
    </div>
  );
}
