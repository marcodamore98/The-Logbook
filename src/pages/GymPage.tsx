import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarList, Columns, fmt } from '../components/charts';
import { GlyphPlus, GlyphTrash, IconStats, IconWorkout } from '../components/icons';
import { RoutineEditor } from '../components/training/RoutineEditor';
import { Empty, uid } from '../components/ui';
import { addDays, fromISO, isoWeek, startOfWeek, today } from '../lib/dates';
import { useStore } from '../lib/store/StoreContext';
import { e1rm, isWorkingSet, setsPerMuscle, setVolume, workingSets, workoutVolume } from '../lib/training/analytics';
import { allExercises, exerciseDef, MUSCLES } from '../lib/training/exercises';
import { parseHevyCsv } from '../lib/hevy';
import { routineFromWorkout, workoutFromRoutine } from '../lib/training/routines';
import type { Routine, WorkoutModule } from '../lib/types';
import { labelOf, WORKOUT_TYPES } from '../lib/vocab';

type Tab = 'routines' | 'history' | 'exercises' | 'progress';

function Routines() {
  const store = useStore();
  const nav = useNavigate();
  const routines = store.settings.routines ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>();
  const hevyFile = useRef<HTMLInputElement>(null);
  const save = (list: Routine[]) => store.saveSettings({ ...store.settings, routines: list });
  async function startEmpty() {
    const date = today();
    const id = uid();
    await store.updateDay(date, (d) => ({
      ...d,
      modules: [...d.modules, { kind: 'workout', id, type: 'strength', durationMin: 0, exercises: [], startedAt: Date.now() }],
    }));
    nav(`/palestra/allenamento/${date}/${id}`);
  }

  async function start(r: Routine) {
    const date = today();
    const w = workoutFromRoutine(r, uid(), date, store.history);
    await store.updateDay(date, (d) => ({ ...d, modules: [...d.modules, { ...w, startedAt: Date.now() }] }));
    nav(`/palestra/allenamento/${date}/${w.id}`);
  }

  // Empty routines left behind by "Nuova routine" are of no use: remove them.
  useEffect(() => {
    if (editing) return;
    const keep = routines.filter((r) => r.exercises.length > 0 || !/^nuova/i.test(r.name));
    if (keep.length !== routines.length) save(keep);
  }, [routines, editing]);

  const current = routines.find((r) => r.id === editing);
  if (current) {
    return (
      <section className="card">
        <div className="card-head">
          <IconWorkout />
          <h2>Modifica scheda</h2>
          <button
            className="btn small"
            onClick={() => {
              if (!current.exercises.length) save(routines.filter((x) => x.id !== current.id));
              setEditing(null);
            }}
          >
            Fatto
          </button>
        </div>
        <RoutineEditor value={current} onChange={(r) => save(routines.map((x) => (x.id === r.id ? r : x)))} />
      </section>
    );
  }

  return (
    <>
      <div className="routine-head">
        <h2 className="routine-title">Routine</h2>
      </div>
      <div className="routine-actions">
        <button
          className="tile-btn"
          onClick={() => {
            const r: Routine = { id: uid(), name: 'Nuova routine', exercises: [], updatedAt: Date.now() };
            save([...routines, r]);
            setEditing(r.id);
          }}
        >
          <GlyphPlus /> Nuova routine
        </button>
        <button className="tile-btn lime" onClick={startEmpty}>
          <GlyphPlus /> Inizia un allenamento vuoto
        </button>
        <input
          ref={hevyFile}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              // Per routine name: the most complete session (most exercises), the most recent on ties.
              const best = new Map<string, WorkoutModule>();
              for (const { module } of parseHevyCsv(await f.text()).sort((a, b) => a.date.localeCompare(b.date))) {
                if (!module.title) continue;
                const cur = best.get(module.title);
                if (!cur || module.exercises.length >= cur.exercises.length) best.set(module.title, module);
              }
              const names = new Set(routines.map((r) => r.name.toLowerCase()));
              const created = [...best.values()]
                .filter((w) => !names.has(w.title!.toLowerCase()))
                .map((w) => {
                  const r = routineFromWorkout(w, uid(), w.title!);
                  // Leave weights empty: each workout proposes the last weight actually used.
                  return { ...r, exercises: r.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, kg: undefined })) })) };
                });
              save([...routines, ...created]);
              setMsg(`Routine create: ${created.length} (dalla sessione più completa di ciascuna). Controllale.`);
            } catch (err) {
              setMsg(String(err instanceof Error ? err.message : err));
            }
          }}
        />
      </div>
      {msg && <p className="muted small">{msg}</p>}
      {routines.length === 0 && (
        <Empty>
          Nessuna routine. Creane una con “Nuova routine”, oppure fai un allenamento e usa “Salva come scheda”.
        </Empty>
      )}
          <div className="routine-grid">
            {routines.map((r) => (
              <article key={r.id} className="card routine-card">
                <div className="routine-top">
                  <h3 className="routine-name">{r.name}</h3>
                  <details className="menu-details more">
                    <summary className="icon-btn small" aria-label="Altre azioni">⋯</summary>
                    <div className="menu">
                      <button className="menu-item" onClick={() => setEditing(r.id)}>Modifica</button>
                      <button className="menu-item" onClick={() => save([...routines, { ...structuredClone(r), id: uid(), name: `${r.name} (copia)`, updatedAt: Date.now() }])}>Duplica</button>
                      <button className="menu-item danger" onClick={() => window.confirm(`Eliminare la routine “${r.name}”?`) && save(routines.filter((x) => x.id !== r.id))}>Elimina</button>
                    </div>
                  </details>
                </div>
                <p className="routine-preview">
                  {r.exercises.length
                    ? r.exercises.map((ex) => exerciseDef(ex.exerciseId, store.settings.exercises).name).join(', ')
                    : 'Nessun esercizio'}
                </p>
                <button className="btn routine-start" disabled={!r.exercises.length} onClick={() => start(r)}>
                  Avvia la routine
                </button>
              </article>
            ))}
          </div>
      <p className="muted small import-note">
        Hai già delle routine? <button className="link-btn" onClick={() => hevyFile.current?.click()}>Importa da Hevy</button> ·{' '}
        <Link className="link-btn" to="/impostazioni#personal-trainer">dal personal trainer</Link>
      </p>
    </>
  );
}

function Exercises() {
  const store = useStore();
  const custom = store.settings.exercises ?? [];
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const list = allExercises(custom).filter(
    (e) => (!muscle || e.muscle === muscle) && (!q || e.name.toLowerCase().includes(q.toLowerCase())),
  );
  const done = (id: string) => store.history.get(id)?.length ?? 0;
  list.sort((a, b) => done(b.id) - done(a.id));

  const def = sel ? exerciseDef(sel, custom) : null;
  const sessions = sel ? store.history.get(sel) ?? [] : [];
  const best = sessions.flatMap((s) => s.sets.filter(isWorkingSet).map((set) => ({ ...set, date: s.date })));
  const top = best.reduce<{ kg: number; e: number; date?: string; reps?: number }>(
    (b, s) => {
      const e = e1rm(s.kg, s.reps);
      return { kg: Math.max(b.kg, s.kg ?? 0), e: e > b.e ? e : b.e, date: e > b.e ? s.date : b.date, reps: e > b.e ? s.reps : b.reps };
    },
    { kg: 0, e: 0 },
  );

  return (
    <div className="two-col gym-ex">
      <section className="card">
        <div className="picker-tools">
          <input type="search" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Gruppo muscolare">
            <option value="">Tutti i muscoli</option>
            {MUSCLES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <ul className="ex-list tall">
          {list.map((e) => (
            <li key={e.id}>
              <button className={`ex-item${sel === e.id ? ' on' : ''}`} onClick={() => setSel(e.id)}>
                <span className="ex-name">{e.name}</span>
                <span className="ex-meta">
                  {e.muscle} · {e.equipment}
                  {done(e.id) ? ` · ${done(e.id)} ${done(e.id) === 1 ? 'sessione' : 'sessioni'}` : ''}
                  {e.custom ? ' · personale' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        {!def ? (
          <Empty>Scegli un esercizio per vedere storico e record.</Empty>
        ) : (
          <>
            <div className="card-head">
              <h2>{def.name}</h2>
              {def.custom && (
                <button
                  className="icon-btn small"
                  aria-label="Elimina esercizio personale"
                  onClick={() => {
                    if (!window.confirm('Eliminare questo esercizio personale? Lo storico resta negli allenamenti.')) return;
                    store.saveSettings({ ...store.settings, exercises: custom.filter((x) => x.id !== def.id) });
                    setSel(null);
                  }}
                >
                  <GlyphTrash />
                </button>
              )}
            </div>
            <p className="muted small">
              {def.muscle}
              {def.secondary?.length ? ` (+ ${def.secondary.join(', ')})` : ''} · {def.equipment}
            </p>
            {sessions.length === 0 ? (
              <Empty>Non ancora eseguito.</Empty>
            ) : (
              <>
                <div className="tiles small-tiles">
                  <div className="tile">
                    <span className="tile-value">{fmt(top.kg, 1)} kg</span>
                    <span className="tile-label">peso massimo</span>
                  </div>
                  <div className="tile">
                    <span className="tile-value">{fmt(top.e)} kg</span>
                    <span className="tile-label">1RM stimato{top.date ? ` · ${fromISO(top.date).toLocaleDateString('it-IT')}` : ''}</span>
                  </div>
                  <div className="tile">
                    <span className="tile-value">{sessions.length}</span>
                    <span className="tile-label">sessioni</span>
                  </div>
                </div>
                <h3 className="sub">1RM stimato per sessione</h3>
                <Columns
                  unit=" kg"
                  buckets={[...sessions]
                    .slice(0, 20)
                    .reverse()
                    .map((s) => ({
                      label: fromISO(s.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' }),
                      full: fromISO(s.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }),
                      value: Math.round(Math.max(0, ...s.sets.filter(isWorkingSet).map((x) => e1rm(x.kg, x.reps)))),
                    }))}
                />
                <h3 className="sub">Ultime sessioni</h3>
                <ul className="history">
                  {sessions.slice(0, 8).map((s) => (
                    <li key={s.workoutId}>
                      <span className="muted small">
                        {fromISO(s.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                        {s.title ? ` · ${s.title}` : ''}
                      </span>
                      <span>{s.sets.map((x) => (x.kg ? `${x.kg}×${x.reps}` : `${x.reps || x.seconds + 's'}`)).join('  ')}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Progress() {
  const store = useStore();
  const days = store.allDays;
  const t = today();
  const weekStart = startOfWeek(t);
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(weekStart, -7 * (11 - i)));
  const buckets = weeks.map((w) => {
    const end = addDays(w, 6);
    const n = days.filter((d) => d.date >= w && d.date <= end).reduce((c, d) => c + d.modules.filter((m) => m.kind === 'workout').length, 0);
    return { label: `S${isoWeek(w)}`, full: `Settimana ${isoWeek(w)} (dal ${fromISO(w).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })})`, value: n };
  });
  const last = (n: number) => days.filter((d) => d.date > addDays(t, -n) && d.date <= t);
  const muscles = (n: number) =>
    [...setsPerMuscle(last(n), store.settings.exercises ?? []).entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const volume7 = last(7).reduce((v, d) => v + d.modules.reduce((m, x) => m + (x.kind === 'workout' ? x.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + setVolume(s), 0), 0) : 0), 0), 0);
  const types = new Map<string, number>();
  for (const d of last(30)) for (const m of d.modules) if (m.kind === 'workout') types.set(m.type, (types.get(m.type) ?? 0) + 1);

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <IconWorkout size={32} />
          <span className="tile-value">{buckets.at(-1)?.value ?? 0}</span>
          <span className="tile-label">allenamenti questa settimana</span>
        </div>
        <div className="tile">
          <IconStats size={32} />
          <span className="tile-value">{fmt(volume7)} kg</span>
          <span className="tile-label">volume ultimi 7 giorni</span>
        </div>
      </div>
      <section className="card">
        <div className="card-head">
          <h2>Allenamenti per settimana</h2>
        </div>
        <Columns buckets={buckets} unit="" />
      </section>
      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <h2>Serie per muscolo · 7 giorni</h2>
          </div>
          <BarList data={muscles(7)} max={12} />
          <p className="muted small">Muscolo principale = 1 serie, secondari = ½. Riscaldamento escluso.</p>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Split · 30 giorni</h2>
          </div>
          <BarList data={[...types.entries()].map(([k, v]) => ({ label: labelOf(WORKOUT_TYPES, k), value: v }))} />
          <h3 className="sub">Serie per muscolo · 30 giorni</h3>
          <BarList data={muscles(30)} max={8} />
        </section>
      </div>
    </>
  );
}

function WorkoutHistory() {
  const store = useStore();
  const list = store.allDays
    .flatMap((d) => d.modules.filter((m): m is WorkoutModule => m.kind === 'workout').map((w) => ({ date: d.date, w })))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return <Empty>Nessun allenamento registrato.</Empty>;
  return (
    <ul className="workout-history">
      {list.slice(0, 60).map(({ date, w }) => (
        <li key={w.id}>
          <Link className="card workout-row" to={`/palestra/allenamento/${date}/${w.id}`}>
            <span className="wr-date">{fromISO(date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <span className="wr-title">
              <strong>{w.title || labelOf(WORKOUT_TYPES, w.type)}</strong>
              <span className="muted small">
                {w.exercises.map((e) => exerciseDef(e.exerciseId, store.settings.exercises).name).slice(0, 4).join(', ')}
                {w.exercises.length > 4 ? '…' : ''}
              </span>
            </span>
            <span className="wr-stats">
              {fmt(workoutVolume(w))} kg · {workingSets(w)} serie{w.durationMin ? ` · ${w.durationMin}′` : ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function GymPage() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('routines');
  useEffect(() => {
    store.ensureAllLoaded();
  }, [store]);
  const tabs = useMemo(
    () => [
      ['routines', 'Schede'],
      ['history', 'Storico'],
      ['exercises', 'Esercizi'],
      ['progress', 'Progressi'],
    ] as const,
    [],
  );
  return (
    <div className="page gym-page">
      <header className="page-head">
        <div className="page-title">
          <h1>Palestra</h1>
        </div>
      </header>
      <div className="segmented" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'routines' && <Routines />}
      {tab === 'history' && <WorkoutHistory />}
      {tab === 'exercises' && <Exercises />}
      {tab === 'progress' && <Progress />}
    </div>
  );
}
