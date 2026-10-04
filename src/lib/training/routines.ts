import type { ISODate, Routine, WorkoutModule, WorkoutSet } from '../types';
import { isWorkingSet, matchingSet, previousSession, setTypeOf, type History } from './analytics';

/** A new workout prefilled from a routine: planned values first, else last time's numbers. */
export function workoutFromRoutine(r: Routine, id: string, date: ISODate, h: History): WorkoutModule {
  return {
    kind: 'workout',
    id,
    routineId: r.id,
    title: r.name,
    type: r.type ?? 'strength',
    durationMin: 0,
    notes: r.notes,
    exercises: r.exercises.map((ex) => {
      const prev = previousSession(h, ex.exerciseId, id, date)?.sets ?? [];
      return {
        exerciseId: ex.exerciseId,
        supersetId: ex.supersetId,
        restSec: ex.restSec,
        notes: ex.notes,
        sets: ex.sets.map((p, i): WorkoutSet => {
          const last = matchingSet(prev, ex.sets, i);
          return {
            type: p.type,
            reps: p.reps ?? last?.reps ?? 0,
            kg: p.kg ?? last?.kg,
            seconds: p.seconds ?? last?.seconds,
            rpe: p.rpe,
            done: false,
          };
        }),
      };
    }),
  };
}

/** Saves a workout's structure as a routine (planned sets = what was done). */
export function routineFromWorkout(w: WorkoutModule, id: string, name: string): Routine {
  return {
    id,
    name,
    type: w.type,
    notes: w.notes,
    updatedAt: Date.now(),
    exercises: w.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      supersetId: ex.supersetId,
      restSec: ex.restSec,
      notes: ex.notes,
      sets: ex.sets.map((s) => ({ type: setTypeOf(s), reps: s.reps || undefined, kg: isWorkingSet(s) ? s.kg : s.kg, seconds: s.seconds })),
    })),
  };
}

export const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
export const restLabel = (s: number) => (s === 0 ? 'Nessun recupero' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

/** Letter for each superset group (A, B, …) in order of appearance. */
/** Each superset has its own colour (A lavender, B lime, C blue, D coral, E green…), used for the link and the label. */
const SUPERSET_COLORS = ['#b9b0f5', '#d6f25f', '#7cc4f0', '#ff9b7a', '#8fe0b0', '#f5b8e0'];
export const supersetColor = (letter?: string) => (letter ? SUPERSET_COLORS[(letter.charCodeAt(0) - 65) % SUPERSET_COLORS.length] : undefined);

export function supersetLetters(exs: { supersetId?: string }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of exs) if (e.supersetId && !m.has(e.supersetId)) m.set(e.supersetId, String.fromCharCode(65 + m.size));
  return m;
}
