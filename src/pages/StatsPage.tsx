import { useEffect, useMemo, useState } from 'react';
import { GlyphDownload, GlyphNext, GlyphPrev, IconClinical, IconOuting, IconShift, IconStudy, IconSurgery, IconWorkout } from '../components/icons';
import { Empty } from '../components/ui';
import {
  addDays,
  addMonths,
  endOfMonth,
  formatMonth,
  fromISO,
  isoWeek,
  MONTHS,
  rangeDays,
  startOfMonth,
  startOfWeek,
  today,
  WEEKDAYS_SHORT,
} from '../lib/dates';
import { computeStats, metricOf, surgeryCsv, type Count, type Metric } from '../lib/stats';
import { useStore } from '../lib/store/StoreContext';
import type { DayEntry, ISODate } from '../lib/types';

type Period = 'week' | 'month' | 'year';

function bounds(p: Period, anchor: ISODate): [ISODate, ISODate] {
  if (p === 'week') {
    const s = startOfWeek(anchor);
    return [s, addDays(s, 6)];
  }
  if (p === 'month') return [startOfMonth(anchor), endOfMonth(anchor)];
  const y = anchor.slice(0, 4);
  return [`${y}-01-01`, `${y}-12-31`];
}

function shift(p: Period, anchor: ISODate, n: number): ISODate {
  if (p === 'week') return addDays(anchor, 7 * n);
  if (p === 'month') return addMonths(anchor, n);
  return `${Number(anchor.slice(0, 4)) + n}-01-01`;
}

function title(p: Period, anchor: ISODate) {
  if (p === 'week') {
    const s = startOfWeek(anchor);
    return `Settimana ${isoWeek(s)} · dal ${fromISO(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
  }
  if (p === 'month') return formatMonth(anchor);
  return anchor.slice(0, 4);
}

const fmt = (n: number, d = 0) => n.toLocaleString('it-IT', { maximumFractionDigits: d });

/** Horizontal bar list: magnitude by category, single hue, value labels in ink. */
function BarList({ data, unit = '', max = 8 }: { data: Count[]; unit?: string; max?: number }) {
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

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'surgery', label: 'Interventi', unit: '' },
  { id: 'hours', label: 'Ore di turno', unit: ' h' },
  { id: 'study', label: 'Ore di studio', unit: ' h' },
  { id: 'workout', label: 'Allenamenti', unit: '' },
];

function Columns({ buckets, unit }: { buckets: { label: string; full: string; value: number }[]; unit: string }) {
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

export default function StatsPage() {
  const store = useStore();
  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState(today());
  const [metric, setMetric] = useState<Metric>('surgery');
  const [days, setDays] = useState<DayEntry[]>([]);
  const [from, to] = bounds(period, anchor);

  useEffect(() => {
    let alive = true;
    store.repo.getRange(from, to).then((d) => alive && setDays(d));
    return () => {
      alive = false;
    };
  }, [store.repo, from, to]);

  const stats = useMemo(() => computeStats(days, store.settings), [days, store.settings]);

  const buckets = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d]));
    if (period === 'year') {
      return MONTHS.map((m, i) => {
        const mStart = `${from.slice(0, 4)}-${String(i + 1).padStart(2, '0')}-01`;
        const value = rangeDays(mStart, endOfMonth(mStart)).reduce((n, d) => n + metricOf(byDate.get(d), metric, store.settings), 0);
        return { label: m.slice(0, 3), full: `${m} ${from.slice(0, 4)}`, value };
      });
    }
    return rangeDays(from, to).map((d) => {
      const dt = fromISO(d);
      return {
        label: period === 'week' ? WEEKDAYS_SHORT[(dt.getDay() + 6) % 7] : String(dt.getDate()),
        full: dt.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }),
        value: metricOf(byDate.get(d), metric, store.settings),
      };
    });
  }, [days, period, from, to, metric, store.settings]);

  function exportCsv() {
    const blob = new Blob([surgeryCsv(days, store.settings)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `logbook-chirurgico_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const m = METRICS.find((x) => x.id === metric)!;

  return (
    <div className="page stats-page">
      <div className="segmented" role="tablist">
        {(['week', 'month', 'year'] as Period[]).map((p) => (
          <button key={p} role="tab" aria-selected={period === p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>
            {p === 'week' ? 'Settimana' : p === 'month' ? 'Mese' : 'Anno'}
          </button>
        ))}
      </div>
      <header className="page-head">
        <button className="icon-btn" aria-label="Periodo precedente" onClick={() => setAnchor(shift(period, anchor, -1))}>
          <GlyphPrev />
        </button>
        <div className="page-title">
          <h1 className="capitalize">{title(period, anchor)}</h1>
        </div>
        <button className="icon-btn" aria-label="Periodo successivo" onClick={() => setAnchor(shift(period, anchor, 1))}>
          <GlyphNext />
        </button>
      </header>

      <div className="tiles">
        <div className="tile">
          <IconShift size={32} />
          <span className="tile-value">{fmt(stats.work.hours, 1)} h</span>
          <span className="tile-label">{stats.work.shifts} turni · {stats.work.nights} notti</span>
        </div>
        <div className="tile">
          <IconSurgery size={32} />
          <span className="tile-value">{stats.surgery.total}</span>
          <span className="tile-label">interventi · {stats.surgery.byRole.find((r) => r.label === 'Primo operatore')?.value ?? 0} da primo</span>
        </div>
        <div className="tile">
          <IconClinical size={32} />
          <span className="tile-value">{stats.clinical.total}</span>
          <span className="tile-label">prestazioni cliniche</span>
        </div>
        <div className="tile">
          <IconStudy size={32} />
          <span className="tile-value">{fmt(stats.study.minutes / 60, 1)} h</span>
          <span className="tile-label">di studio</span>
        </div>
        <div className="tile">
          <IconWorkout size={32} />
          <span className="tile-value">{stats.workout.sessions}</span>
          <span className="tile-label">allenamenti · {fmt(stats.workout.minutes / 60, 1)} h</span>
        </div>
        <div className="tile">
          <IconOuting size={32} />
          <span className="tile-value">{stats.outings.total}</span>
          <span className="tile-label">gite e uscite{stats.mood ? ` · umore ${stats.mood}/5` : ''}</span>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Andamento</h2>
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} aria-label="Metrica">
            {METRICS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <Columns buckets={buckets} unit={m.unit} />
      </section>

      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <IconSurgery />
            <h2>Chirurgia</h2>
            <button className="btn-ghost small" onClick={exportCsv} disabled={!stats.surgery.total}>
              <GlyphDownload /> CSV
            </button>
          </div>
          <h3 className="sub">Per area</h3>
          <BarList data={stats.surgery.byGroup} />
          <h3 className="sub">Interventi più frequenti</h3>
          <BarList data={stats.surgery.byProcedure} />
          <h3 className="sub">Ruolo</h3>
          <BarList data={stats.surgery.byRole} />
          <h3 className="sub">Via d’accesso</h3>
          <BarList data={stats.surgery.byApproach} />
          {stats.surgery.total > 0 && (
            <p className="muted small">
              Complicanze: {stats.surgery.complications} ({fmt((stats.surgery.complications / stats.surgery.total) * 100, 1)}%) · tempo operatorio{' '}
              {fmt(stats.surgery.minutes / 60, 1)} h
            </p>
          )}
        </section>
        <section className="card">
          <div className="card-head">
            <IconShift />
            <h2>Turni</h2>
          </div>
          <h3 className="sub">Per tipo</h3>
          <BarList data={stats.work.byType} />
          <h3 className="sub">Colleghi in turno</h3>
          <BarList data={stats.work.colleagues} />
        </section>
        <section className="card">
          <div className="card-head">
            <IconClinical />
            <h2>Attività clinica</h2>
          </div>
          <BarList data={stats.clinical.byActivity} />
        </section>
        <section className="card">
          <div className="card-head">
            <IconStudy />
            <h2>Studio (minuti)</h2>
          </div>
          <h3 className="sub">Per area</h3>
          <BarList data={stats.study.byArea} unit="′" />
          <h3 className="sub">Per tipo</h3>
          <BarList data={stats.study.byType} unit="′" />
        </section>
        <section className="card">
          <div className="card-head">
            <IconWorkout />
            <h2>Allenamento</h2>
          </div>
          <h3 className="sub">Sessioni per tipo</h3>
          <BarList data={stats.workout.byType} />
          {stats.workout.byExercise.length > 0 && (
            <>
              <h3 className="sub">Volume per esercizio (kg)</h3>
              <BarList data={stats.workout.byExercise} />
            </>
          )}
          {(stats.workout.volumeKg > 0 || stats.workout.km > 0) && (
            <p className="muted small">
              Volume sollevato {fmt(stats.workout.volumeKg)} kg in {stats.workout.sets} serie
              {stats.workout.km > 0 ? ` · distanza ${fmt(stats.workout.km, 1)} km` : ''}
            </p>
          )}
        </section>
        <section className="card">
          <div className="card-head">
            <IconOuting />
            <h2>Vita privata</h2>
          </div>
          <BarList data={stats.outings.byType} />
          {stats.photos > 0 && <p className="muted small">{stats.photos} foto salvate</p>}
        </section>
      </div>
    </div>
  );
}
