import { useEffect, useRef, useState } from 'react';
import { today } from '../../lib/dates';
import { useStore } from '../../lib/store/StoreContext';
import { bestsBefore, countsSet, matchingSet, previousSession, prsOf, SET_TYPES, setTypeOf, workingSets, workoutVolume } from '../../lib/training/analytics';
import { exerciseDef, usesDistance, usesReps, usesTime, usesWeight } from '../../lib/training/exercises';
import { REST_OPTIONS, restLabel, routineFromWorkout, supersetLetters, workoutFromRoutine } from '../../lib/training/routines';
import type { ExerciseDef, ISODate, SetType, WorkoutExercise, WorkoutModule, WorkoutSet } from '../../lib/types';
import { WORKOUT_TYPES } from '../../lib/vocab';
import { GlyphCheck, GlyphClose, GlyphPlus, IconBody, IconTimer } from '../icons';
import { Field, NumberInput, uid, VocabSelect } from '../ui';
import { ExAvatar } from './ExAvatar';
import { ExerciseDetail } from './ExerciseDetail';
import { ExercisePicker } from './ExercisePicker';
import { useRestTimer } from './RestTimer';

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Generic list helpers shared by workouts and routines. */
export function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function linkNext<T extends { supersetId?: string }>(list: T[], i: number): T[] {
  if (i >= list.length - 1) return list;
  const id = list[i].supersetId ?? uid();
  return list.map((e, k) => (k === i || k === i + 1 ? { ...e, supersetId: id } : e));
}

export function unlink<T extends { supersetId?: string }>(list: T[], i: number): T[] {
  const id = list[i].supersetId;
  const out = list.map((e, k) => (k === i ? { ...e, supersetId: undefined } : e));
  if (id && out.filter((e) => e.supersetId === id).length === 1) return out.map((e) => (e.supersetId === id ? { ...e, supersetId: undefined } : e));
  return out;
}

export function SetTypeBadge({ type, index, onChange }: { type: SetType; index: number; onChange: (t: SetType) => void }) {
  const meta = SET_TYPES.find((t) => t.id === type)!;
  const next = SET_TYPES[(SET_TYPES.findIndex((t) => t.id === type) + 1) % SET_TYPES.length].id;
  return (
    <button type="button" className={`set-badge set-${type}`} title={`${meta.label} (tocca per cambiare)`} onClick={() => onChange(next)}>
      {meta.short || index}
    </button>
  );
}

function prevLabel(s: WorkoutSet | undefined, def: ExerciseDef) {
  if (!s) return '—';
  if (usesTime(def.kind)) return `${s.kg ? `${s.kg} kg · ` : ''}${s.seconds ?? 0}s`;
  if (usesWeight(def.kind)) return `${s.kg ?? 0} × ${s.reps}`;
  return `${s.reps} rip`;
}

/** One set row: a grid like Hevy's, with swipe-left to reveal "Elimina". */
function SetRow({
  s,
  n,
  def,
  prevSet,
  prs,
  onChange,
  onDone,
  onRemove,
}: {
  s: WorkoutSet;
  n: number;
  def: ExerciseDef;
  prevSet?: WorkoutSet;
  prs: string[];
  onChange: (s: WorkoutSet) => void;
  onDone: () => void;
  onRemove: () => void;
}) {
  const type = setTypeOf(s);
  const [dx, setDx] = useState(0);
  const touch = useRef<{ x: number; y: number; base: number; lock: boolean | null } | null>(null);
  const REVEAL = 84;
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('input')) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: dx, lock: null };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = touch.current;
    if (!t) return;
    const mx = e.touches[0].clientX - t.x;
    const my = e.touches[0].clientY - t.y;
    if (t.lock === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) t.lock = Math.abs(mx) > Math.abs(my);
    if (t.lock) setDx(Math.max(-REVEAL, Math.min(0, t.base + mx)));
  };
  const onTouchEnd = () => {
    const t = touch.current;
    touch.current = null;
    if (t?.lock) setDx((v) => (v < -REVEAL / 2 ? -REVEAL : 0));
  };
  const cols = [usesWeight(def.kind), usesDistance(def.kind), usesReps(def.kind), usesTime(def.kind)].filter(Boolean).length + 1; // + RPE

  return (
    <div className={`set-wrap${dx ? ' open' : ''}`}>
      <button type="button" className="set-delete" tabIndex={dx ? 0 : -1} onClick={onRemove}>
        Elimina
      </button>
      <div
        className={`set-row${s.done ? ' done' : ''} set-row-${type}`}
        style={{ transform: `translate3d(${dx}px,0,0)`, ['--cols' as string]: cols }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <SetTypeBadge type={type} index={n} onChange={(t) => onChange({ ...s, type: t, warmup: undefined })} />
        <button type="button" className="prev-btn" title="Copia valori precedenti" onClick={() => prevSet && onChange({ ...s, kg: prevSet.kg, reps: prevSet.reps, seconds: prevSet.seconds })}>
          {prevLabel(prevSet, def)}
        </button>
        {usesWeight(def.kind) && <NumberInput value={s.kg} step={0.5} placeholder="kg" onChange={(kg) => onChange({ ...s, kg })} />}
        {usesDistance(def.kind) && <NumberInput value={s.km} step={0.1} placeholder="km" onChange={(km) => onChange({ ...s, km })} />}
        {usesReps(def.kind) && <NumberInput value={s.reps || undefined} placeholder="rip" onChange={(reps) => onChange({ ...s, reps: reps ?? 0 })} />}
        {usesTime(def.kind) && <NumberInput value={s.seconds} step={5} placeholder="sec" onChange={(seconds) => onChange({ ...s, seconds })} />}
        <NumberInput value={s.rpe} step={0.5} placeholder="–" onChange={(rpe) => onChange({ ...s, rpe: rpe === undefined ? undefined : Math.min(10, rpe) })} />
        <span className="check-cell">
          <button type="button" className={`check-btn${s.done ? ' on' : ''}`} aria-label={s.done ? 'Segna come non fatta' : 'Segna come fatta'} aria-pressed={!!s.done} onClick={onDone}>
            <GlyphCheck />
          </button>
          {prs.length > 0 && (
            <span className="pr" title={`Record: ${prs.join(', ')}`}>
              PR
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function ExerciseBlock({
  ex,
  index,
  count,
  workout,
  date,
  letter,
  onChange,
  onMove,
  onRemove,
  onLink,
  onUnlink,
  onSetDone,
}: {
  ex: WorkoutExercise;
  index: number;
  count: number;
  workout: WorkoutModule;
  date: ISODate;
  letter?: string;
  onChange: (e: WorkoutExercise) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  onLink: () => void;
  onUnlink: () => void;
  /** Called instead of onChange when a set gets ticked, so the parent can start timers in the same update. */
  onSetDone: (e: WorkoutExercise) => void;
}) {
  const { settings, history } = useStore();
  const def = exerciseDef(ex.exerciseId, settings.exercises);
  const prev = previousSession(history, ex.exerciseId, workout.id, date);
  const bests = bestsBefore(history, ex.exerciseId, workout.id, date);
  const setAt = (k: number, s: WorkoutSet) => onChange({ ...ex, sets: ex.sets.map((x, i) => (i === k ? s : x)) });
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  const [rest, setRest] = useState(false);
  let n = 0;
  const unit = def.kind === 'assisted_bodyweight' ? '−KG' : def.kind === 'weighted_bodyweight' ? '+KG' : 'KG';
  const cols = [usesWeight(def.kind) && unit, usesDistance(def.kind) && 'KM', usesReps(def.kind) && 'RIP', usesTime(def.kind) && 'SEC', 'RPE'].filter(Boolean) as string[];

  return (
    <div className={`exercise${ex.supersetId ? ' in-superset' : ''}`}>
      <div className="exercise-head">
        <ExAvatar muscle={def.muscle} size={42} />
        <button type="button" className="exercise-title link-title" onClick={() => setInfo(true)}>
          <strong>{def.name}</strong>
          <span className="muted small">
            {def.muscle} · {def.equipment}
          </span>
        </button>
        <div className="menu-wrap">
          <button type="button" className="icon-btn small" aria-label="Altre azioni" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            ⋮
          </button>
          {menu && (
            <>
              <div className="menu-cover" onClick={() => setMenu(false)} />
              <ul className="menu" role="menu">
                {index > 0 && (
                  <li>
                    <button role="menuitem" onClick={() => { onMove(-1); setMenu(false); }}>Sposta su</button>
                  </li>
                )}
                {index < count - 1 && (
                  <li>
                    <button role="menuitem" onClick={() => { onMove(1); setMenu(false); }}>Sposta giù</button>
                  </li>
                )}
                {ex.supersetId ? (
                  <li>
                    <button role="menuitem" onClick={() => { onUnlink(); setMenu(false); }}>Scollega superserie</button>
                  </li>
                ) : (
                  index < count - 1 && (
                    <li>
                      <button role="menuitem" onClick={() => { onLink(); setMenu(false); }}>Superserie con il successivo</button>
                    </li>
                  )
                )}
                <li>
                  <button role="menuitem" className="danger" onClick={() => { setMenu(false); onRemove(); }}>Rimuovi esercizio</button>
                </li>
              </ul>
            </>
          )}
        </div>
      </div>
      {letter && <span className="superset-pill">Superset {letter}</span>}

      <input className="ex-notes" value={ex.notes ?? ''} placeholder="Aggiungi delle note qui…" onChange={(e) => onChange({ ...ex, notes: e.target.value || undefined })} />
      <div className="rest-line">
        <button type="button" className="rest-link" onClick={() => setRest((v) => !v)}>
          <IconTimer size={22} /> Riposo: {restLabel(ex.restSec ?? 90)}
        </button>
        {rest && (
          <select autoFocus value={ex.restSec ?? 90} onChange={(e) => { onChange({ ...ex, restSec: Number(e.target.value) }); setRest(false); }} onBlur={() => setRest(false)} aria-label="Recupero">
            {REST_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {restLabel(r)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="sets" style={{ ['--cols' as string]: cols.length }}>
        <div className="set-head">
          <span>SERIE</span>
          <span>PRECEDENTE</span>
          {cols.map((c) => (
            <span key={c}>{c}</span>
          ))}
          <span aria-hidden="true">✓</span>
        </div>
        {ex.sets.map((s, k) => {
          const type = setTypeOf(s);
          if (type !== 'warmup') n++;
          const p = prev ? matchingSet(prev.sets, ex.sets, k) : undefined;
          return (
            <SetRow
              key={k}
              s={s}
              n={n}
              def={def}
              prevSet={p}
              prs={prsOf(s, bests)}
              onChange={(ns) => setAt(k, ns)}
              onRemove={() => onChange({ ...ex, sets: ex.sets.filter((_, i) => i !== k) })}
              onDone={() => {
                const next = { ...ex, sets: ex.sets.map((x, i) => (i === k ? { ...s, done: !s.done } : x)) };
                if (s.done) onChange(next);
                else onSetDone(next);
              }}
            />
          );
        })}
      </div>
      <button
        type="button"
        className="add-set"
        onClick={() => {
          const last = ex.sets.at(-1);
          onChange({ ...ex, sets: [...ex.sets, { type: last && setTypeOf(last) !== 'warmup' ? setTypeOf(last) : 'normal', reps: last?.reps ?? 0, kg: last?.kg, seconds: last?.seconds, done: false }] });
        }}
      >
        <GlyphPlus /> Aggiungi serie
      </button>
      {bests.e1rm > 0 && <p className="muted small">Record: {bests.kg} kg · 1RM stimato {Math.round(bests.e1rm)} kg</p>}
      {info && <ExerciseDetail id={ex.exerciseId} onClose={() => setInfo(false)} />}
    </div>
  );
}

/** Sets done per muscle in this workout (primary counts 1, secondary ½). */
function MuscleSheet({ w, onClose }: { w: WorkoutModule; onClose: () => void }) {
  const { settings } = useStore();
  const rows = new Map<string, number>();
  for (const ex of w.exercises) {
    const def = exerciseDef(ex.exerciseId, settings.exercises);
    const n = ex.sets.filter(countsSet).length;
    rows.set(def.muscle, (rows.get(def.muscle) ?? 0) + n);
    for (const m of def.secondary ?? []) rows.set(m, (rows.get(m) ?? 0) + n / 2);
  }
  const list = [...rows.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Distribuzione dei muscoli" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>Distribuzione dei muscoli</h2>
          <button className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <GlyphClose />
          </button>
        </div>
        <div className="muscle-table">
          <div className="muscle-head">
            <span>Muscolo</span>
            <span>Serie completate</span>
          </div>
          {list.length === 0 && <p className="muted">Aggiungi degli esercizi per vedere i muscoli allenati.</p>}
          {list.map(([m, n]) => (
            <div key={m} className="muscle-row">
              <span>{m}</span>
              <strong>{Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkoutLogger({ value: w, onChange, date }: { value: WorkoutModule; onChange: (w: WorkoutModule) => void; date: ISODate }) {
  const store = useStore();
  const { settings, history } = store;
  const timer = useRestTimer();
  const [picking, setPicking] = useState(false);
  const [muscles, setMuscles] = useState(false);
  const [details, setDetails] = useState(false);
  const [, tick] = useState(0);
  const set = (p: Partial<WorkoutModule>) => onChange({ ...w, ...p });
  const running = !!w.startedAt && !w.finishedAt;
  const letters = supersetLetters(w.exercises);
  const routines = settings.routines ?? [];
  const cardio = ['run', 'bike', 'swim', 'walk'].includes(w.type);

  useEffect(() => {
    store.ensureAllLoaded();
  }, [store]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const setExercises = (exercises: WorkoutExercise[]) => set({ exercises });
  const volume = workoutVolume(w);
  const sets = workingSets(w);

  return (
    <div className="workout">
      <div className="workout-bar hevy-bar">
        <div className="stat">
          <span className="stat-cap">Durata</span>
          <span className="stat-val accent">{running ? fmtClock(Date.now() - w.startedAt!) : w.durationMin ? `${w.durationMin}′` : '–'}</span>
        </div>
        <div className="stat">
          <span className="stat-cap">Volume</span>
          <span className="stat-val">{Math.round(volume).toLocaleString('it-IT')} kg</span>
        </div>
        <div className="stat">
          <span className="stat-cap">Serie</span>
          <span className="stat-val">{sets}</span>
        </div>
        <button type="button" className="icon-btn muscles-btn" aria-label="Distribuzione dei muscoli" title="Distribuzione dei muscoli" onClick={() => setMuscles(true)}>
          <IconBody />
        </button>
      </div>
      <div className="workout-actions">
        {running ? (
          <button type="button" className="btn" onClick={() => set({ finishedAt: Date.now(), durationMin: Math.max(1, Math.round((Date.now() - w.startedAt!) / 60000)) })}>
            Termina
          </button>
        ) : date === today() ? (
          <button type="button" className="btn" onClick={() => set({ startedAt: Date.now(), finishedAt: undefined })}>
            {w.finishedAt ? 'Riprendi' : 'Inizia allenamento'}
          </button>
        ) : null}
        <button type="button" className="btn-ghost" onClick={() => setDetails((v) => !v)} aria-expanded={details}>
          {details ? 'Nascondi dettagli' : 'Dettagli'}
        </button>
      </div>

      <input className="workout-title" value={w.title ?? ''} placeholder="Nome allenamento (es. Push A)" onChange={(e) => set({ title: e.target.value || undefined })} />

      {details && (
        <div className="grid">
          <Field label="Tipo">
            <VocabSelect items={WORKOUT_TYPES} value={w.type} onChange={(type) => set({ type })} />
          </Field>
          <Field label="Durata (min)">
            <NumberInput value={w.durationMin || undefined} step={5} onChange={(n) => set({ durationMin: n ?? 0 })} />
          </Field>
          {cardio && (
            <Field label="Distanza (km)">
              <NumberInput value={w.distanceKm} step={0.1} onChange={(distanceKm) => set({ distanceKm })} />
            </Field>
          )}
          {w.source === 'hevy' && <p className="field-wide muted small">Importato da Hevy.</p>}
        </div>
      )}

      {w.exercises.length === 0 && routines.length > 0 && (
        <div className="routine-start">
          <span className="muted small">Parti da una scheda:</span>
          <div className="chips">
            {routines.map((r) => (
              <button
                key={r.id}
                type="button"
                className="chip"
                onClick={() => {
                  const filled = workoutFromRoutine(r, w.id, date, history);
                  onChange({ ...filled, startedAt: w.startedAt });
                }}
              >
                {r.folder ? `${r.folder} · ` : ''}
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {w.exercises.map((ex, i) => (
        <ExerciseBlock
          key={i}
          ex={ex}
          index={i}
          count={w.exercises.length}
          workout={w}
          date={date}
          letter={ex.supersetId ? letters.get(ex.supersetId) : undefined}
          onChange={(e) => setExercises(w.exercises.map((x, k) => (k === i ? e : x)))}
          onMove={(d) => setExercises(move(w.exercises, i, d))}
          onRemove={() => setExercises(unlink(w.exercises, i).filter((_, k) => k !== i))}
          onLink={() => setExercises(linkNext(w.exercises, i))}
          onUnlink={() => setExercises(unlink(w.exercises, i))}
          onSetDone={(e) => {
            // One update: the ticked set and, on the first set, the start time.
            onChange({ ...w, startedAt: w.startedAt ?? Date.now(), exercises: w.exercises.map((x, k) => (k === i ? e : x)) });
            // In a superset, rest only after the last exercise of the group.
            const next = w.exercises[i + 1];
            if (ex.supersetId && next?.supersetId === ex.supersetId) return;
            timer.start(ex.restSec ?? 90, exerciseDef(ex.exerciseId, settings.exercises).name);
          }}
        />
      ))}

      <div className="row">
        <button type="button" className="btn-ghost" onClick={() => setPicking(true)}>
          <GlyphPlus /> Aggiungi esercizi
        </button>
        {w.exercises.length > 0 && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const name = window.prompt('Nome della nuova scheda', w.title ?? 'Nuova scheda');
              if (!name) return;
              store.saveSettings({ ...settings, routines: [...routines, routineFromWorkout(w, uid(), name)] });
            }}
          >
            Salva come scheda
          </button>
        )}
      </div>

      <Field label="Note allenamento" wide>
        <textarea rows={2} value={w.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} />
      </Field>

      {muscles && <MuscleSheet w={w} onClose={() => setMuscles(false)} />}
      {picking && (
        <ExercisePicker
          multiple
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            setPicking(false);
            setExercises([
              ...w.exercises,
              ...ids.map((exerciseId) => {
                const prev = previousSession(history, exerciseId, w.id, date);
                const sets: WorkoutSet[] = prev?.sets.length
                  ? prev.sets.map((s) => ({ type: setTypeOf(s), reps: s.reps, kg: s.kg, seconds: s.seconds, done: false }))
                  : [{ type: 'normal', reps: 0, done: false }];
                return { exerciseId, sets, restSec: 90 };
              }),
            ]);
          }}
        />
      )}
    </div>
  );
}

