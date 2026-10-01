import { useEffect, useMemo, useState } from 'react';
import { GlyphDownload, GlyphNext, GlyphPrev, IconClinical, IconMood, IconOuting, IconTodo, IconShift, IconStudy, IconSurgery, IconWorkout } from '../components/icons';
import { BarList, Columns, fmt } from '../components/charts';
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
import { computeStats, metricOf, surgeryCsv, type Metric } from '../lib/stats';
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

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'surgery', label: 'Interventi', unit: '' },
  { id: 'hours', label: 'Ore di turno', unit: ' h' },
  { id: 'study', label: 'Ore di studio', unit: ' h' },
  { id: 'workout', label: 'Allenamenti', unit: '' },
  { id: 'volume', label: 'Volume sollevato', unit: ' kg' },
  { id: 'kcal', label: 'Calorie attive', unit: ' kcal' },
];

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
          {stats.muscles.length > 0 && (
            <>
              <h3 className="sub">Serie per muscolo</h3>
              <BarList data={stats.muscles} max={10} />
            </>
          )}
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
        <section className="card">
          <div className="card-head">
            <IconTodo />
            <h2>Impegni e promemoria</h2>
          </div>
          <h3 className="sub">Impegni per categoria</h3>
          <BarList data={stats.categories.appointments} />
          <h3 className="sub">Promemoria per categoria</h3>
          <BarList data={stats.categories.todos} />
          {stats.categories.todosTotal > 0 && (
            <p className="muted small">
              Completati {stats.categories.todosDone} su {stats.categories.todosTotal}
            </p>
          )}
        </section>
        <section className="card">
          <div className="card-head">
            <IconMood />
            <h2>Corpo (medie)</h2>
          </div>
          <dl className="side-stats">
            <div>
              <dt>Peso</dt>
              <dd>{stats.body.weight ? `${fmt(stats.body.weight, 1)} kg` : '—'}</dd>
            </div>
            <div>
              <dt>Calorie</dt>
              <dd>{stats.body.kcalIn ? fmt(stats.body.kcalIn) : '—'}</dd>
            </div>
            <div>
              <dt>Passi</dt>
              <dd>{stats.body.steps ? fmt(stats.body.steps) : '—'}</dd>
            </div>
            <div>
              <dt>Sonno</dt>
              <dd>{stats.body.sleepH ? `${fmt(stats.body.sleepH, 1)} h` : '—'}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
