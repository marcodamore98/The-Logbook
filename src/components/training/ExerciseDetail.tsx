import { useMemo, useState } from 'react';
import { fromISO } from '../../lib/dates';
import { useStore } from '../../lib/store/StoreContext';
import { e1rm, isWorkingSet, setVolume } from '../../lib/training/analytics';
import { exerciseDef } from '../../lib/training/exercises';
import type { WorkoutSet } from '../../lib/types';
import { fmt, Trend } from '../charts';
import { GlyphClose } from '../icons';
import { Empty } from '../ui';
import { ExAvatar } from './ExAvatar';

type Metric = 'kg' | 'e1rm' | 'volume' | 'reps';
const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'kg', label: 'Peso massimo', unit: ' kg' },
  { id: 'e1rm', label: 'Massimale stimato', unit: ' kg' },
  { id: 'volume', label: 'Miglior volume', unit: ' kg' },
  { id: 'reps', label: 'Ripetizioni', unit: '' },
];
const RANGES = [
  { id: 90, label: 'Ultimi 3 mesi' },
  { id: 180, label: 'Ultimi 6 mesi' },
  { id: 365, label: 'Ultimo anno' },
  { id: 0, label: 'Sempre' },
];

const setText = (s: WorkoutSet) => (s.kg ? `${s.kg} kg × ${s.reps}` : s.reps ? `${s.reps} rip` : `${s.seconds ?? 0}s`);

/** Exercise page in the style of Hevy: summary with progress chart and records, and the full history. */
export function ExerciseDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { settings, history } = useStore();
  const def = exerciseDef(id, settings.exercises);
  const sessions = history.get(id) ?? [];
  const [tab, setTab] = useState<'summary' | 'history'>('summary');
  const [metric, setMetric] = useState<Metric>('kg');
  const [range, setRange] = useState(90);

  const value = (sets: WorkoutSet[], m: Metric) => {
    const w = sets.filter(isWorkingSet);
    if (m === 'kg') return Math.max(0, ...w.map((s) => s.kg ?? 0));
    if (m === 'e1rm') return Math.round(Math.max(0, ...w.map((s) => e1rm(s.kg, s.reps))));
    if (m === 'volume') return Math.max(0, ...w.map(setVolume));
    return Math.max(0, ...w.map((s) => s.reps));
  };

  const points = useMemo(() => {
    const from = range ? new Date(Date.now() - range * 864e5).toISOString().slice(0, 10) : '';
    return [...sessions]
      .filter((s) => s.date >= from)
      .reverse()
      .map((s) => ({ label: fromISO(s.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }), value: value(s.sets, metric) }))
      .filter((p) => p.value > 0);
  }, [sessions, metric, range]);

  const records = useMemo(() => {
    const best = (m: Metric) => {
      let top = { v: 0, date: '', set: undefined as WorkoutSet | undefined };
      for (const s of sessions)
        for (const set of s.sets.filter(isWorkingSet)) {
          const v = m === 'kg' ? set.kg ?? 0 : m === 'e1rm' ? e1rm(set.kg, set.reps) : m === 'volume' ? setVolume(set) : set.reps;
          if (v > top.v) top = { v, date: s.date, set };
        }
      return top;
    };
    return METRICS.map((m) => ({ ...m, ...best(m.id) })).filter((r) => r.v > 0);
  }, [sessions]);

  const cur = METRICS.find((m) => m.id === metric)!;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet ex-detail" role="dialog" aria-label={def.name} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <ExAvatar muscle={def.muscle} />
          <h2 className="grow">{def.name}</h2>
          <button className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <GlyphClose />
          </button>
        </div>
        <div className="tabs" role="tablist">
          {(['summary', 'history'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t === 'summary' ? 'Sommario' : 'Cronologia'}
            </button>
          ))}
        </div>

        {tab === 'summary' ? (
          <div className="ex-detail-body">
            <p className="muted">
              Primario: {def.muscle}
              {def.secondary?.length ? <><br />Secondario: {def.secondary.join(', ')}</> : null}
              <br />Attrezzatura: {def.equipment}
            </p>
            {sessions.length === 0 ? (
              <Empty>Non ancora eseguito.</Empty>
            ) : (
              <>
                <div className="ex-detail-top">
                  <strong className="ex-detail-value">
                    {fmt(points.at(-1)?.value ?? 0, 1)}
                    {cur.unit}
                  </strong>
                  <select value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Periodo" className="link-select">
                    {RANGES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Trend noun="sessioni" title={cur.label} better="up" format={(v) => `${fmt(v, 1)}${cur.unit}`} points={points} />
                <div className="chips scroll-x">
                  {METRICS.map((m) => (
                    <button key={m.id} className={`chip${metric === m.id ? ' chip-on' : ''}`} onClick={() => setMetric(m.id)}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <h3 className="sub">★ Record personali</h3>
                <ul className="records">
                  {records.map((r) => (
                    <li key={r.id}>
                      <span>{r.label}</span>
                      <strong>
                        {fmt(r.v, 1)}
                        {r.unit}
                      </strong>
                      <span className="muted small">{r.set ? `${setText(r.set)} · ${fromISO(r.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <div className="ex-detail-body">
            {sessions.length === 0 && <Empty>Nessuna sessione registrata.</Empty>}
            {sessions.map((s) => (
              <section key={s.workoutId} className="hist-session">
                <h3>{s.title || 'Allenamento'}</h3>
                <span className="muted small capitalize">{fromISO(s.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <div className="hist-head">
                  <span>SERIE</span>
                  <span>PESO &amp; RIPETIZIONI</span>
                </div>
                {s.sets.map((set, i) => (
                  <div key={i} className="hist-row">
                    <b>{i + 1}</b>
                    <span>{setText(set)}</span>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
