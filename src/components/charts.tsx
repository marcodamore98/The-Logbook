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
  const W = 640, H = 180, pad = { l: 28, r: 8, t: 12, b: 22 };
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

