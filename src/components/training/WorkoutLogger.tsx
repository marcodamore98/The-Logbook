import { useEffect, useState } from 'react';
import { today } from '../../lib/dates';
import { useStore } from '../../lib/store/StoreContext';
import { bestsBefore, matchingSet, previousSession, prsOf, SET_TYPES, setTypeOf, workingSets, workoutVolume } from '../../lib/training/analytics';
import { exerciseDef, usesDistance, usesReps, usesTime, usesWeight } from '../../lib/training/exercises';
import { REST_OPTIONS, restLabel, routineFromWorkout, supersetLetters, workoutFromRoutine } from '../../lib/training/routines';
import type { ExerciseDef, ISODate, SetType, WorkoutExercise, WorkoutModule, WorkoutSet } from '../../lib/types';
import { WORKOUT_TYPES } from '../../lib/vocab';
import { GlyphCheck, GlyphClose, GlyphNext, GlyphPlus, GlyphPrev, GlyphTrash, IconTimer } from '../icons';
import { Field, NumberInput, uid, VocabSelect } from '../ui';
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
  let n = 0;

  return (
    <div className={`exercise${ex.supersetId ? ' in-superset' : ''}`}>
      <div className="exercise-head">
        {letter && <span className="superset-tag" title="Superserie">{letter}</span>}
        <div className="exercise-title">
          <strong>{def.name}</strong>
          <span className="muted small">
            {def.muscle} · {def.equipment}
          </span>
        </div>
        <button type="button" className="icon-btn small" aria-label="Sposta su" disabled={index === 0} onClick={() => onMove(-1)}>
          <GlyphPrev />
        </button>
        <button type="button" className="icon-btn small" aria-label="Sposta giù" disabled={index === count - 1} onClick={() => onMove(1)}>
          <GlyphNext />
        </button>
        <button type="button" className="icon-btn small" aria-label="Rimuovi esercizio" onClick={onRemove}>
          <GlyphTrash />
        </button>
      </div>

      <div className="exercise-opts">
        <input className="grow" value={ex.notes ?? ''} placeholder="Note esercizio (sella, presa, sensazioni…)" onChange={(e) => onChange({ ...ex, notes: e.target.value || undefined })} />
        <select value={ex.restSec ?? 90} onChange={(e) => onChange({ ...ex, restSec: Number(e.target.value) })} aria-label="Recupero">
          {REST_OPTIONS.map((r) => (
            <option key={r} value={r}>
              ⏱ {restLabel(r)}
            </option>
          ))}
        </select>
        {ex.supersetId ? (
          <button type="button" className="btn-ghost small" onClick={onUnlink}>
            Scollega superserie
          </button>
        ) : (
          index < count - 1 && (
            <button type="button" className="btn-ghost small" onClick={onLink}>
              ⛓ Superserie con il successivo
            </button>
          )
        )}
      </div>

      <table className="sets-table">
        <thead>
          <tr>
            <th>Serie</th>
            <th>Precedente</th>
            {usesWeight(def.kind) && <th>{def.kind === 'assisted_bodyweight' ? '−kg' : def.kind === 'weighted_bodyweight' ? '+kg' : 'kg'}</th>}
            {usesDistance(def.kind) && <th>km</th>}
            {usesReps(def.kind) && <th>Rip</th>}
            {usesTime(def.kind) && <th>Sec</th>}
            <th>RPE</th>
            <th aria-label="Fatta" />
            <th aria-label="Rimuovi" />
          </tr>
        </thead>
        <tbody>
          {ex.sets.map((s, k) => {
            const type = setTypeOf(s);
            if (type !== 'warmup') n++;
            const prs = prsOf(s, bests);
            const p = prev ? matchingSet(prev.sets, ex.sets, k) : undefined;
            return (
              <tr key={k} className={`${s.done ? 'done' : ''} set-row-${type}`}>
                <td>
                  <SetTypeBadge type={type} index={n} onChange={(t) => setAt(k, { ...s, type: t, warmup: undefined })} />
                </td>
                <td className="prev">
                  <button type="button" className="link-btn" title="Copia valori precedenti" onClick={() => p && setAt(k, { ...s, kg: p.kg, reps: p.reps, seconds: p.seconds })}>
                    {prevLabel(p, def)}
                  </button>
                </td>
                {usesWeight(def.kind) && (
                  <td>
                    <NumberInput value={s.kg} step={0.5} placeholder="kg" onChange={(kg) => setAt(k, { ...s, kg })} />
                  </td>
                )}
                {usesDistance(def.kind) && (
                  <td>
                    <NumberInput value={s.km} step={0.1} placeholder="km" onChange={(km) => setAt(k, { ...s, km })} />
                  </td>
                )}
                {usesReps(def.kind) && (
                  <td>
                    <NumberInput value={s.reps || undefined} placeholder="rip" onChange={(reps) => setAt(k, { ...s, reps: reps ?? 0 })} />
                  </td>
                )}
                {usesTime(def.kind) && (
                  <td>
                    <NumberInput value={s.seconds} step={5} placeholder="sec" onChange={(seconds) => setAt(k, { ...s, seconds })} />
                  </td>
                )}
                <td>
                  <NumberInput value={s.rpe} step={0.5} placeholder="–" onChange={(rpe) => setAt(k, { ...s, rpe: rpe === undefined ? undefined : Math.min(10, rpe) })} />
                </td>
                <td>
                  <button
                    type="button"
                    className={`check-btn${s.done ? ' on' : ''}`}
                    aria-label={s.done ? 'Segna come non fatta' : 'Segna come fatta'}
                    aria-pressed={!!s.done}
                    onClick={() => {
                      const next = { ...ex, sets: ex.sets.map((x, i) => (i === k ? { ...s, done: !s.done } : x)) };
                      if (s.done) onChange(next);
                      else onSetDone(next);
                    }}
                  >
                    <GlyphCheck />
                  </button>
                  {prs.length > 0 && (
                    <span className="pr" title={`Record: ${prs.join(', ')}`}>
                      PR
                    </span>
                  )}
                </td>
                <td>
                  <button type="button" className="icon-btn small" aria-label="Rimuovi serie" onClick={() => onChange({ ...ex, sets: ex.sets.filter((_, i) => i !== k) })}>
                    <GlyphClose />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row">
        <button
          type="button"
          className="btn-ghost small"
          onClick={() => {
            const last = ex.sets.at(-1);
            onChange({ ...ex, sets: [...ex.sets, { type: last && setTypeOf(last) !== 'warmup' ? setTypeOf(last) : 'normal', reps: last?.reps ?? 0, kg: last?.kg, seconds: last?.seconds, done: false }] });
          }}
        >
          <GlyphPlus /> Serie
        </button>
        {bests.e1rm > 0 && <span className="muted small">Record: {bests.kg} kg · 1RM stimato {Math.round(bests.e1rm)} kg</span>}
      </div>
    </div>
  );
}

export function WorkoutLogger({ value: w, onChange, date }: { value: WorkoutModule; onChange: (w: WorkoutModule) => void; date: ISODate }) {
  const store = useStore();
  const { settings, history } = store;
  const timer = useRestTimer();
  const [picking, setPicking] = useState(false);
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
      <div className="workout-bar">
        <IconTimer size={30} />
        {running ? (
          <>
            <span className="workout-clock" aria-label="Durata">
              {fmtClock(Date.now() - w.startedAt!)}
            </span>
            <button
              type="button"
              className="btn small"
              onClick={() => set({ finishedAt: Date.now(), durationMin: Math.max(1, Math.round((Date.now() - w.startedAt!) / 60000)) })}
            >
              Termina allenamento
            </button>
          </>
        ) : date === today() ? (
          <button type="button" className="btn small" onClick={() => set({ startedAt: Date.now(), finishedAt: undefined })}>
            {w.finishedAt ? 'Riprendi' : 'Inizia allenamento'}
          </button>
        ) : null}
        <span className="muted small">
          {Math.round(volume).toLocaleString('it-IT')} kg · {sets} serie{w.durationMin ? ` · ${w.durationMin}′` : ''}
        </span>
      </div>

      <div className="grid">
        <Field label="Nome">
          <input value={w.title ?? ''} placeholder="es. Push A" onChange={(e) => set({ title: e.target.value || undefined })} />
        </Field>
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

