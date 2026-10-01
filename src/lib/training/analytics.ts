import type { DayEntry, ExerciseDef, ISODate, SetType, WorkoutModule, WorkoutSet } from '../types';
import { exerciseDef } from './exercises';

export const setTypeOf = (s: WorkoutSet): SetType => s.type ?? (s.warmup ? 'warmup' : 'normal');
export const isWorkingSet = (s: WorkoutSet) => setTypeOf(s) !== 'warmup';
/** Counts toward volume/statistics: working set not explicitly left undone (imported sets have no flag). */
export const countsSet = (s: WorkoutSet) => isWorkingSet(s) && s.done !== false;

/** Matching set from an earlier session: warm-ups pair with warm-ups, working sets with working sets, in order. */
export function matchingSet<T extends { type?: SetType; warmup?: boolean }>(prev: WorkoutSet[], current: T[], k: number): WorkoutSet | undefined {
  const warm = (x: { type?: SetType; warmup?: boolean }) => (x.type ?? (x.warmup ? 'warmup' : 'normal')) === 'warmup';
  const isWarm = warm(current[k]);
  const pos = current.slice(0, k).filter((x) => warm(x) === isWarm).length;
  return prev.filter((x) => warm(x) === isWarm)[pos];
}

export const SET_TYPES: { id: SetType; short: string; label: string }[] = [
  { id: 'normal', short: '', label: 'Serie normale' },
  { id: 'warmup', short: 'W', label: 'Riscaldamento' },
  { id: 'drop', short: 'D', label: 'Dropset' },
  { id: 'failure', short: 'F', label: 'A cedimento' },
];

/** Estimated one-rep max (Epley), meaningful up to ~12 reps. */
export function e1rm(kg?: number, reps?: number): number {
  if (!kg || !reps || reps > 12) return kg && reps === 1 ? kg : 0;
  return kg * (1 + reps / 30);
}

export const setVolume = (s: WorkoutSet) => (countsSet(s) ? s.reps * (s.kg ?? 0) : 0);

export interface Session {
  date: ISODate;
  workoutId: string;
  title?: string;
  sets: WorkoutSet[];
}

/** exerciseId → sessions, newest first. */
export type History = Map<string, Session[]>;

export function buildHistory(days: DayEntry[]): History {
  const h: History = new Map();
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
  for (const d of sorted) {
    for (const m of d.modules) {
      if (m.kind !== 'workout') continue;
      for (const ex of m.exercises) {
        const sets = ex.sets.filter((s) => s.done !== false || s.reps || s.kg);
        if (!sets.length) continue;
        if (!h.has(ex.exerciseId)) h.set(ex.exerciseId, []);
        h.get(ex.exerciseId)!.push({ date: d.date, workoutId: m.id, title: m.title, sets });
      }
    }
  }
  return h;
}

/** Sets of the most recent earlier session of this exercise (for the "precedente" column). */
export function previousSession(h: History, exerciseId: string, workoutId: string, date: ISODate): Session | undefined {
  return h.get(exerciseId)?.find((s) => s.workoutId !== workoutId && s.date <= date);
}

export interface Bests {
  kg: number;
  e1rm: number;
  setVolume: number;
  reps: number;
}

export function bestsBefore(h: History, exerciseId: string, workoutId: string, date: ISODate): Bests {
  const b: Bests = { kg: 0, e1rm: 0, setVolume: 0, reps: 0 };
  for (const s of h.get(exerciseId) ?? []) {
    if (s.workoutId === workoutId || s.date > date) continue;
    for (const set of s.sets) {
      if (!isWorkingSet(set)) continue;
      b.kg = Math.max(b.kg, set.kg ?? 0);
      b.e1rm = Math.max(b.e1rm, e1rm(set.kg, set.reps));
      b.setVolume = Math.max(b.setVolume, setVolume(set));
      b.reps = Math.max(b.reps, set.reps);
    }
  }
  return b;
}

/** Which records a completed set beats (only when there is earlier history to beat). */
export function prsOf(set: WorkoutSet, b: Bests): string[] {
  if (!set.done || !isWorkingSet(set) || (!b.kg && !b.reps)) return [];
  const out: string[] = [];
  if ((set.kg ?? 0) > b.kg && b.kg > 0) out.push('Peso massimo');
  if (e1rm(set.kg, set.reps) > b.e1rm && b.e1rm > 0) out.push('1RM stimato');
  if (setVolume(set) > b.setVolume && b.setVolume > 0) out.push('Volume serie');
  if (!set.kg && set.reps > b.reps && b.reps > 0) out.push('Ripetizioni');
  return out;
}

export function workoutVolume(w: WorkoutModule): number {
  return w.exercises.reduce((n, ex) => n + ex.sets.reduce((m, s) => m + setVolume(s), 0), 0);
}

export function workingSets(w: WorkoutModule): number {
  return w.exercises.reduce((n, ex) => n + ex.sets.filter(countsSet).length, 0);
}

/** Working sets per muscle group: primary muscle counts 1, secondary 0.5. */
export function setsPerMuscle(days: DayEntry[], custom: ExerciseDef[]): Map<string, number> {
  const out = new Map<string, number>();
  const add = (k: string, n: number) => out.set(k, (out.get(k) ?? 0) + n);
  for (const d of days) {
    for (const m of d.modules) {
      if (m.kind !== 'workout') continue;
      for (const ex of m.exercises) {
        const def = exerciseDef(ex.exerciseId, custom);
        const n = ex.sets.filter(countsSet).length;
        if (!n) continue;
        add(def.muscle, n);
        for (const s of def.secondary ?? []) add(s, n / 2);
      }
    }
  }
  return out;
}
