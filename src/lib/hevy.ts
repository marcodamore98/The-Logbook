// Import from Hevy's CSV export (Profilo → Impostazioni → Esporta e importa dati → Esporta allenamenti).
// One row per set; rows sharing title + start_time + end_time form one workout.
// Columns: title, start_time, end_time, description, exercise_title, superset_id,
// exercise_notes, set_index, set_type, weight_kg (or weight_lbs), reps,
// distance_km (or distance_miles), duration_seconds, rpe.

import { toISO } from './dates';
import type { ISODate, WorkoutExercise, WorkoutModule } from './types';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  gen: 0, mag: 4, giu: 5, lug: 6, ago: 7, set: 8, ott: 9, dic: 11,
};

/** Hevy writes "14 Oct 2026, 18:05"; ISO and dd/mm/yyyy are accepted too. Returns local time. */
export function parseHevyDate(s: string): Date | null {
  s = s.trim();
  let m = s.match(/^(\d{1,2})\s+([A-Za-zÀ-ú]{3})[a-zà-ú.]*\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon !== undefined) return new Date(+m[3], mon, +m[1], +m[4], +m[5]);
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Hevy exercise names → standardized ids (vocab EXERCISES). Unmapped names are kept as "hevy:<name>".
const EXERCISE_RULES: [RegExp, string][] = [
  [/^front squat/, 'front-squat'],
  [/^(squat|hack squat|smith machine squat|goblet squat|pendulum squat)/, 'squat'],
  [/^leg press/, 'leg-press'],
  [/lunge|split squat/, 'lunge'],
  [/^romanian deadlift|^stiff leg/, 'rdl'],
  [/leg curl/, 'leg-curl'],
  [/^leg extension/, 'leg-extension'],
  [/^hip thrust|glute bridge/, 'hip-thrust'],
  [/calf/, 'calf'],
  [/^deadlift|^sumo deadlift|^trap bar deadlift/, 'deadlift'],
  [/^(pull up|chin up)/, 'pull-up'],
  [/^lat pulldown|^pulldown/, 'lat-pulldown'],
  [/^(bent over row|pendlay row|t bar row|dumbbell row|seal row)/, 'barbell-row'],
  [/^(seated cable row|seated row|cable row|chest supported|iso-lateral row|low row)/, 'cable-row'],
  [/^incline (bench|chest) press/, 'incline-bench'],
  [/^(bench press|chest press|decline bench press)/, 'bench'],
  [/dip/, 'dips'],
  [/^push up/, 'push-up'],
  [/fly|butterfly|pec deck|crossover/, 'chest-fly'],
  [/^(overhead press|shoulder press|seated overhead press|arnold press|military press)/, 'ohp'],
  [/lateral raise/, 'lateral-raise'],
  [/^face pull|rear delt/, 'face-pull'],
  [/curl/, 'curl'],
  [/triceps|tricep|skullcrusher|pushdown/, 'triceps'],
  [/^plank/, 'plank'],
  [/crunch|sit up/, 'crunch'],
  [/leg raise|knee raise/, 'hanging-leg'],
];

export function mapExercise(title: string): string {
  const t = title.toLowerCase().trim();
  for (const [re, id] of EXERCISE_RULES) if (re.test(t)) return id;
  return `hevy:${title.trim()}`;
}

/** Push / pull / legs from the workout title (Hevy routine names), else generic strength. */
export function workoutType(title: string): string {
  const t = title.toLowerCase();
  if (/push|spinta|petto/.test(t)) return 'push';
  if (/pull|tirata|schiena|dorso/.test(t)) return 'pull';
  if (/leg|gamb|lower/.test(t)) return 'legs';
  return 'strength';
}

export interface ImportedWorkout {
  date: ISODate;
  module: WorkoutModule;
}

export function parseHevyCsv(text: string): ImportedWorkout[] {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const need = ['title', 'start_time', 'exercise_title'];
  for (const n of need) if (col(n) < 0) throw new Error(`Il file non sembra un'esportazione di Hevy (manca la colonna "${n}").`);
  const lbs = col('weight_kg') < 0 && col('weight_lbs') >= 0;
  const miles = col('distance_km') < 0 && col('distance_miles') >= 0;
  const get = (r: string[], n: string) => (col(n) >= 0 ? (r[col(n)] ?? '').trim() : '');
  const num = (s: string) => (s === '' ? undefined : Number(s.replace(',', '.')));

  const workouts = new Map<string, { title: string; start: Date; end: Date | null; notes: string; exercises: Map<string, WorkoutExercise>; rpe: number[]; km: number }>();
  for (const r of rows.slice(1)) {
    const title = get(r, 'title');
    const startS = get(r, 'start_time');
    const start = parseHevyDate(startS);
    if (!start) continue;
    const key = `${title}|${startS}|${get(r, 'end_time')}`;
    if (!workouts.has(key)) {
      workouts.set(key, { title, start, end: parseHevyDate(get(r, 'end_time')), notes: get(r, 'description'), exercises: new Map(), rpe: [], km: 0 });
    }
    const w = workouts.get(key)!;
    const exTitle = get(r, 'exercise_title');
    if (!exTitle) continue;
    if (!w.exercises.has(exTitle)) w.exercises.set(exTitle, { exerciseId: mapExercise(exTitle), sets: [] });
    let kg = num(get(r, lbs ? 'weight_lbs' : 'weight_kg'));
    if (kg !== undefined && lbs) kg = Math.round(kg * 0.4536 * 10) / 10;
    const reps = num(get(r, 'reps')) ?? 0;
    const warmup = get(r, 'set_type').toLowerCase() === 'warmup';
    w.exercises.get(exTitle)!.sets.push({ reps, kg, ...(warmup ? { warmup: true } : {}) });
    const rpe = num(get(r, 'rpe'));
    if (rpe) w.rpe.push(rpe);
    const dist = num(get(r, miles ? 'distance_miles' : 'distance_km'));
    if (dist) w.km += miles ? dist * 1.609 : dist;
  }

  return [...workouts.values()].map((w) => {
    const minutes = w.end ? Math.max(1, Math.round((w.end.getTime() - w.start.getTime()) / 60000)) : 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${toISO(w.start)}T${pad(w.start.getHours())}${pad(w.start.getMinutes())}`;
    return {
      date: toISO(w.start),
      module: {
        kind: 'workout',
        id: `hevy-${stamp}`,
        source: 'hevy',
        title: w.title || undefined,
        type: workoutType(w.title),
        durationMin: minutes,
        rpe: w.rpe.length ? Math.round((w.rpe.reduce((a, b) => a + b, 0) / w.rpe.length) * 10) / 10 : undefined,
        distanceKm: w.km ? Math.round(w.km * 10) / 10 : undefined,
        exercises: [...w.exercises.values()],
        notes: w.notes || undefined,
      },
    };
  });
}
