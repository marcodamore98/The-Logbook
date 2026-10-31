// Calories burned in a day: workouts and runs worked out by the app, an estimate from the
// steps, plus "Altre attività" written by hand. Exercise counts only what it adds to resting
// (net calories), so it can be added to the daily goal without counting the basal part twice.

import type { DayEntry, RunModule, Settings, WorkoutModule } from './types';
import { kmhOf } from './running/treadmill';

/** Used when no weight has ever been written: the figures are marked as estimated. */
export const DEFAULT_KG = 60;

/** Effort of a gym workout by type, in METs (Compendium of Physical Activities). */
const MET: Record<string, number> = {
  push: 5,
  pull: 5,
  legs: 5.5,
  strength: 5,
  hypertrophy: 5,
  functional: 6,
  hiit: 8,
  run: 9,
  bike: 7,
  swim: 7,
  walk: 4,
  yoga: 2.5,
  sport: 7,
  other: 4,
};

/** Net oxygen cost (ml/kg/min) of walking or running at a speed and incline (ACSM equations). */
function netVo2(kmh: number, inclinePct = 0): number {
  const s = (kmh * 1000) / 60; // m/min
  const g = Math.max(0, inclinePct) / 100;
  return kmh < 7 ? 0.1 * s + 1.8 * s * g : 0.2 * s + 0.9 * s * g;
}
/** ml O2/kg/min × kg × minutes → kcal (about 5 kcal per litre of oxygen). */
const kcalOf = (vo2: number, kg: number, minutes: number) => (vo2 * kg * minutes * 5) / 1000;

export function workoutMinutes(m: WorkoutModule, now = Date.now()): number {
  if (m.durationMin) return m.durationMin;
  if (m.startedAt) return Math.min(240, Math.max(0, ((m.finishedAt ?? now) - m.startedAt) / 60000));
  return 0;
}

export function workoutKcal(m: WorkoutModule, kg: number, now = Date.now()): number {
  const met = MET[m.type] ?? 5;
  return Math.round((met - 1) * kg * (workoutMinutes(m, now) / 60));
}

export function runKcal(m: RunModule, kg: number): number {
  const min = m.durationSec / 60;
  if (!min) return 0;
  // Phase by phase when they are known (treadmill: speed and incline of each series).
  const laps = m.laps?.filter((l) => l.seconds > 0) ?? [];
  if (laps.length) {
    let kcal = 0;
    let sec = 0;
    for (const l of laps) {
      const kmh = kmhOf(l) || (l.meters && l.seconds ? (l.meters / l.seconds) * 3.6 : 0);
      if (kmh) kcal += kcalOf(netVo2(kmh, l.incline), kg, l.seconds / 60);
      sec += l.seconds;
    }
    // A run stopped in the middle of a series: the rest at the average speed.
    const left = m.durationSec - sec;
    if (left > 30 && m.distanceM) kcal += kcalOf(netVo2((m.distanceM / m.durationSec) * 3.6), kg, left / 60);
    return Math.round(kcal);
  }
  if (m.distanceM > 100) return Math.round(kcalOf(netVo2((m.distanceM / m.durationSec) * 3.6), kg, min));
  return Math.round(7 * kg * (min / 60)); // no distance: an easy run, about 8 METs
}

/** Steps made during runs and walks, so the day's steps do not count them twice. */
function exerciseSteps(day: DayEntry): number {
  let n = 0;
  for (const m of day.modules) {
    if (m.kind === 'run' && m.distanceM && m.durationSec) n += m.distanceM / ((m.distanceM / m.durationSec) * 3.6 < 7 ? 0.7 : 1);
    if (m.kind === 'workout' && m.distanceKm && (m.type === 'walk' || m.type === 'run')) n += (m.distanceKm * 1000) / (m.type === 'walk' ? 0.7 : 1);
  }
  return n;
}

/** About 0,04 kcal per step every 70 kg of weight. */
export const stepsKcal = (steps: number, kg: number) => Math.round(steps * 0.04 * (kg / 70));

export interface Burned {
  total: number;
  /** One row per workout and run, for the detail. */
  items: { id: string; label: string; kcal: number }[];
  exercise: number;
  steps: number;
  /** Steps counted for calories (the day's steps minus those of runs and walks). */
  stepsCounted: number;
  manual: number;
  kg: number;
  /** No weight written yet: worked out with DEFAULT_KG. */
  guessed: boolean;
}

export function burnedOn(day: DayEntry, kg: number | undefined, now = Date.now()): Burned {
  const w = kg ?? DEFAULT_KG;
  const items: Burned['items'] = [];
  for (const m of day.modules) {
    if (m.kind === 'workout') items.push({ id: m.id, label: m.title || 'Allenamento', kcal: workoutKcal(m, w, now) });
    else if (m.kind === 'run') items.push({ id: m.id, label: m.title || m.planName || (m.mode === 'treadmill' ? 'Tapis roulant' : 'Corsa'), kcal: runKcal(m, w) });
  }
  const exercise = items.reduce((n, i) => n + i.kcal, 0);
  const stepsCounted = Math.max(0, Math.round((day.body?.steps ?? 0) - exerciseSteps(day)));
  const steps = stepsKcal(stepsCounted, w);
  const manual = day.body?.kcalOut ?? 0;
  return { total: exercise + steps + manual, items, exercise, steps, stepsCounted, manual, kg: w, guessed: kg === undefined };
}

/** The weight to use on a day: the latest written on or before it, else the last one known. */
export function weightOn(days: (date: string) => DayEntry, date: string, settings: Settings, lookBack = 60): number | undefined {
  const d0 = new Date(`${date}T12:00:00`);
  for (let i = 0; i <= lookBack; i++) {
    const d = new Date(d0.getTime() - i * 864e5);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const kg = days(iso).body?.weightKg;
    if (kg) return kg;
  }
  return settings.profile?.weightKg;
}
