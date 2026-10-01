import { useState } from 'react';
import type { Count } from '../lib/stats';
import { Empty } from './ui';

export const fmt = (n: number, d = 0) => n.toLocaleString('it-IT', { maximumFractionDigits: d });

/** Horizontal bar list: magnitude by category, single hue, value labels in ink. */
export function BarList({ data, unit = '', max = 8 }: { data: Count[]; unit?: string; max?: number }) {
  if (!data.length) return <Empty>Nessun dato nel periodo.</Empty>;
  const shown = data.slice(0, max);
  const rest = data.slice(max).reduce((n, c) => n + c.value, 0);
  const rows = rest ? [...shown, { label: 'Altro', value: rest }] : shown;
  const top = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${fmt(r.value, 1)}${unit}`}>
          <span className="barlist-label">{r.label}</span>
          <span className="barlist-track">
            <span className="barlist-bar" style={{ width: `${(r.value / top) * 100}%` }} />
          </span>
          <span className="barlist-value">
            {fmt(r.value, 1)}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}


export function Columns({ buckets, unit }: { buckets: { label: string; full: string; value: number }[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 180, pad = { l: 42, r: 8, t: 12, b: 22 };
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const niceMax = max <= 5 ? Math.ceil(max) : Math.ceil(max / 5) * 5;
  const bw = (W - pad.l - pad.r) / buckets.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const step = buckets.length > 14 ? Math.ceil(buckets.length / 10) : 1;
  return (
    <div className="columns-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="columns" role="img" aria-label="Andamento nel periodo" onMouseLeave={() => setHover(null)}>
        {[0, niceMax / 2, niceMax].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} className="grid-line" />
            <text x={pad.l - 6} y={y(g) + 3} className="axis-label" textAnchor="end">
              {fmt(g, 1)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const x = pad.l + i * bw;
          const h = y(0) - y(b.value);
          const w = Math.max(2, bw - 2);
          const r = Math.min(4, w / 2, h);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {b.value > 0 && (
                <path
                  className={`col${hover === i ? ' col-hover' : ''}`}
                  d={`M${x + 1},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                />
              )}
              {i % step === 0 && (
                <text x={x + bw / 2} y={H - 6} className="axis-label" textAnchor="middle">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="base-line" />
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${((pad.l + (hover + 0.5) * bw) / W) * 100}%` }}>
          <strong>{buckets[hover].full}</strong>
          <span>
            {fmt(buckets[hover].value, 1)}
            {unit}
          </span>
        </div>
      )}
      <details className="table-view">
        <summary>Vedi come tabella</summary>
        <table>
          <tbody>
            {buckets.map((b, i) => (
              <tr key={i}>
                <td>{b.full}</td>
                <td className="num">
                  {fmt(b.value, 1)}
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


/** Categorical palette: the brand lime/violet first, then distinct hues readable on light and dark. */
export const PALETTE = ['#7b6ae6', '#d6f25f', '#f4845f', '#3fb8af', '#f2b134', '#e06c9f', '#5b8def', '#9aa0a6'];

/** Donut chart with a centre total and a legend; small slices are merged into "Altro". */
export function Donut({ data, unit = '', center, max = 6 }: { data: Count[]; unit?: string; center?: string; max?: number }) {
  const clean = data.filter((d) => d.value > 0);
  if (!clean.length) return <Empty>Nessun dato nel periodo.</Empty>;
  const shown = clean.slice(0, max);
  const rest = clean.slice(max).reduce((n, c) => n + c.value, 0);
  const rows = rest ? [...shown, { label: 'Altro', value: rest }] : shown;
  const total = rows.reduce((n, r) => n + r.value, 0);
  const R = 42, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" className="donut-svg" role="img" aria-label="Distribuzione">
        <circle cx="60" cy="60" r={R} className="donut-track" />
        {rows.map((r, i) => {
          const len = (r.value / total) * C;
          const el = (
            <circle
              key={r.label}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="16"
              strokeDasharray={`${Math.max(0, len - (rows.length > 1 ? 1.5 : 0))} ${C}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 60 60)"
            >
              <title>{`${r.label}: ${fmt(r.value, 1)}${unit}`}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
        <text x="60" y="58" textAnchor="middle" className="donut-total">
          {center ?? fmt(total, 1)}
        </text>
        <text x="60" y="73" textAnchor="middle" className="donut-unit">
          {center ? '' : unit.trim()}
        </text>
      </svg>
      <ul className="donut-legend">
        {rows.map((r, i) => (
          <li key={r.label}>
            <span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="donut-name">{r.label}</span>
            <span className="donut-val">
              {fmt(r.value, 1)}
              {unit} <small>{fmt((r.value / total) * 100)}%</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Circular progress ring with a big value in the middle. */
export function Ring({ value, of, label, display, color = PALETTE[0] }: { value: number; of: number; label: string; display?: string; color?: string }) {
  const R = 38, C = 2 * Math.PI * R;
  const pct = of > 0 ? Math.min(1, value / of) : 0;
  return (
    <figure className="ring">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${label}: ${fmt(pct * 100)}%`}>
        <circle cx="50" cy="50" r={R} className="donut-track" strokeWidth="11" />
        <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${pct * C} ${C}`} transform="rotate(-90 50 50)" />
        <text x="50" y="55" textAnchor="middle" className="ring-text">
          {display ?? `${fmt(pct * 100)}%`}
        </text>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}
