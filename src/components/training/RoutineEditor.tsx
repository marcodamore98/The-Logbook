import { useState } from 'react';
import { useStore } from '../../lib/store/StoreContext';
import { exerciseDef, usesReps, usesTime, usesWeight } from '../../lib/training/exercises';
import { REST_OPTIONS, restLabel, supersetLetters } from '../../lib/training/routines';
import type { PlannedSet, Routine, RoutineExercise } from '../../lib/types';
import { GlyphClose, GlyphNext, GlyphPlus, GlyphPrev, GlyphTrash } from '../icons';
import { Field, NumberInput } from '../ui';
import { ExercisePicker } from './ExercisePicker';
import { linkNext, move, SetTypeBadge, unlink } from './WorkoutLogger';

function PlannedBlock({
  ex,
  index,
  count,
  letter,
  onChange,
  onMove,
  onRemove,
  onLink,
  onUnlink,
}: {
  ex: RoutineExercise;
  index: number;
  count: number;
  letter?: string;
  onChange: (e: RoutineExercise) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  onLink: () => void;
  onUnlink: () => void;
}) {
  const { settings } = useStore();
  const def = exerciseDef(ex.exerciseId, settings.exercises);
  const setAt = (k: number, s: PlannedSet) => onChange({ ...ex, sets: ex.sets.map((x, i) => (i === k ? s : x)) });
  let n = 0;
  return (
    <div className={`exercise${ex.supersetId ? ' in-superset' : ''}`}>
      <div className="exercise-head">
        {letter && <span className="superset-tag">{letter}</span>}
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
        <input className="grow" value={ex.notes ?? ''} placeholder="Note (tecnica, regolazioni macchina…)" onChange={(e) => onChange({ ...ex, notes: e.target.value || undefined })} />
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
            {usesWeight(def.kind) && <th>kg</th>}
            {usesReps(def.kind) && <th>Rip (min–max)</th>}
            {usesTime(def.kind) && <th>Sec</th>}
            <th>RPE</th>
            <th aria-label="Rimuovi" />
          </tr>
        </thead>
        <tbody>
          {ex.sets.map((s, k) => {
            if (s.type !== 'warmup') n++;
            return (
              <tr key={k} className={`set-row-${s.type}`}>
                <td>
                  <SetTypeBadge type={s.type} index={n} onChange={(type) => setAt(k, { ...s, type })} />
                </td>
                {usesWeight(def.kind) && (
                  <td>
                    <NumberInput value={s.kg} step={0.5} placeholder="auto" onChange={(kg) => setAt(k, { ...s, kg })} />
                  </td>
                )}
                {usesReps(def.kind) && (
                  <td className="range">
                    <NumberInput value={s.reps} placeholder="8" onChange={(reps) => setAt(k, { ...s, reps })} />
                    <span>–</span>
                    <NumberInput value={s.repsMax} placeholder="12" onChange={(repsMax) => setAt(k, { ...s, repsMax })} />
                  </td>
                )}
                {usesTime(def.kind) && (
                  <td>
                    <NumberInput value={s.seconds} step={5} onChange={(seconds) => setAt(k, { ...s, seconds })} />
                  </td>
                )}
                <td>
                  <NumberInput value={s.rpe} step={0.5} placeholder="–" onChange={(rpe) => setAt(k, { ...s, rpe })} />
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
      <button
        type="button"
        className="btn-ghost small"
        onClick={() => onChange({ ...ex, sets: [...ex.sets, { ...(ex.sets.at(-1) ?? { type: 'normal', reps: 8, repsMax: 12 }), type: ex.sets.at(-1)?.type === 'warmup' ? 'normal' : ex.sets.at(-1)?.type ?? 'normal' }] })}
      >
        <GlyphPlus /> Serie
      </button>
    </div>
  );
}

export function RoutineEditor({ value: r, onChange }: { value: Routine; onChange: (r: Routine) => void }) {
  const [picking, setPicking] = useState(false);
  const set = (p: Partial<Routine>) => onChange({ ...r, ...p, updatedAt: Date.now() });
  const setExercises = (exercises: RoutineExercise[]) => set({ exercises });
  const letters = supersetLetters(r.exercises);
  return (
    <div className="routine-editor">
      <div className="grid">
        <Field label="Nome scheda">
          <input value={r.name} onChange={(e) => set({ name: e.target.value })} placeholder="es. Push A" />
        </Field>
        <Field label="Note" wide>
          <input value={r.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} />
        </Field>
      </div>
      <p className="muted small">Il peso lasciato vuoto viene preso dall'ultima volta.</p>
      {r.exercises.map((ex, i) => (
        <PlannedBlock
          key={i}
          ex={ex}
          index={i}
          count={r.exercises.length}
          letter={ex.supersetId ? letters.get(ex.supersetId) : undefined}
          onChange={(e) => setExercises(r.exercises.map((x, k) => (k === i ? e : x)))}
          onMove={(d) => setExercises(move(r.exercises, i, d))}
          onRemove={() => setExercises(unlink(r.exercises, i).filter((_, k) => k !== i))}
          onLink={() => setExercises(linkNext(r.exercises, i))}
          onUnlink={() => setExercises(unlink(r.exercises, i))}
        />
      ))}
      <button type="button" className="btn-ghost" onClick={() => setPicking(true)}>
        <GlyphPlus /> Aggiungi esercizi
      </button>
      {picking && (
        <ExercisePicker
          multiple
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            setPicking(false);
            setExercises([
              ...r.exercises,
              ...ids.map((exerciseId) => ({
                exerciseId,
                restSec: 90,
                sets: [1, 2, 3].map((): PlannedSet => ({ type: 'normal', reps: 8, repsMax: 12 })),
              })),
            ]);
          }}
        />
      )}
    </div>
  );
}
