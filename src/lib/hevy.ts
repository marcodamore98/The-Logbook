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

// Hevy exercise names (Italian and English app language) → standardized ids
// (training/exercises.ts). Exact names first, then patterns; unmapped names
// are kept as "hevy:<name>" so their history still groups correctly.

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const EXACT: Record<string, string> = {
  // Italiano
  'panca piana bilanciere': 'bench',
  'panca piana manubrio': 'bench-db',
  'panca piana multipower': 'smith-bench',
  'panca inclinata bilanciere': 'incline-bench',
  'panca inclinata manubrio': 'incline-db',
  'panca inclinata multipower': 'smith-incline',
  'chest press convergente macchina': 'chest-press-machine',
  'chest press macchina': 'chest-press-machine',
  'croci macchina': 'pec-deck',
  'croci manubrio': 'db-fly',
  'croci al cavo': 'chest-fly',
  'trazione': 'pull-up',
  'trazioni': 'pull-up',
  'trazione verticale macchina': 'lat-pulldown-machine',
  'trazione verticale cavo': 'lat-pulldown',
  'lat machine cavo': 'lat-pulldown',
  'rematore al cavo da seduto presa larga': 'cable-row-wide',
  'rematore al cavo da seduto': 'cable-row',
  'rematore con bilanciere': 'barbell-row',
  'rematore manubrio': 'db-row',
  'chest supported t bar row': 't-bar-row',
  'squat multipower': 'smith-squat',
  'squat bilanciere': 'squat',
  'leg press macchina': 'leg-press',
  'leg extension macchina': 'leg-extension',
  'leg curl sdraiato macchina': 'leg-curl',
  'leg curl seduto macchina': 'seated-leg-curl',
  'stacco da terra rumeno bilanciere': 'rdl',
  'stacco da terra rumeno manubrio': 'db-rdl',
  'stacco da terra bilanciere': 'deadlift',
  'calf raise seduto': 'seated-calf',
  'calf raise in piedi': 'calf',
  'aperture laterali macchina': 'machine-lateral',
  'aperture laterali manubrio': 'lateral-raise',
  'aperture laterali cavo': 'cable-lateral',
  'lento in avanti seduto macchina': 'shoulder-press-machine',
  'lento in avanti manubrio': 'db-shoulder-press',
  'croci inverse deltoide posteriore macchina': 'rear-delt-fly',
  'skullcrusher bilanciere': 'skullcrusher',
  'pushdown tricipiti con corda': 'rope-pushdown',
  'pushdown tricipiti': 'triceps',
  'preacher curl bilanciere': 'preacher-curl',
  'preacher curl macchina': 'preacher-curl',
  'curl bicipiti cavo': 'cable-curl',
  'curl bicipiti manubrio': 'db-curl',
  'curl bicipiti bilanciere': 'curl',
  'bicipiti martello incrociato': 'cross-hammer-curl',
  'curl a martello manubrio': 'hammer-curl',
  'hip thrust bilanciere': 'hip-thrust',
  'face pull': 'face-pull',
  // English
  'bench press barbell': 'bench',
  'bench press dumbbell': 'bench-db',
  'bench press smith machine': 'smith-bench',
  'incline bench press barbell': 'incline-bench',
  'incline bench press dumbbell': 'incline-db',
  'incline bench press smith machine': 'smith-incline',
  'squat smith machine': 'smith-squat',
  'lat pulldown cable': 'lat-pulldown',
  'lat pulldown machine': 'lat-pulldown-machine',
  'seated cable row v grip cable': 'cable-row',
  'seated calf raise': 'seated-calf',
  'lateral raise machine': 'machine-lateral',
  'lateral raise dumbbell': 'lateral-raise',
  'lateral raise cable': 'cable-lateral',
  'triceps rope pushdown': 'rope-pushdown',
  'preacher curl barbell': 'preacher-curl',
  'bicep curl cable': 'cable-curl',
  'bicep curl dumbbell': 'db-curl',
  'bicep curl barbell': 'curl',
  'skullcrusher barbell': 'skullcrusher',
  'chest fly machine': 'pec-deck',
  'butterfly pec deck': 'pec-deck',
  'rear delt reverse fly machine': 'rear-delt-fly',
  'shoulder press machine': 'shoulder-press-machine',
  'romanian deadlift barbell': 'rdl',
  'leg extension machine': 'leg-extension',
  'lying leg curl machine': 'leg-curl',
  'seated leg curl machine': 'seated-leg-curl',
  'leg press machine': 'leg-press',
  'pull up': 'pull-up',
};

const EXERCISE_RULES: [RegExp, string][] = [
  [/front squat/, 'front-squat'],
  [/hack squat/, 'hack-squat'],
  [/(squat|accosciata).*(multipower|smith)/, 'smith-squat'],
  [/^(squat|goblet squat|pendulum squat)/, 'squat'],
  [/leg press/, 'leg-press'],
  [/lunge|affond|split squat/, 'lunge'],
  [/(romanian deadlift|stacco.*rumeno|stiff leg)/, 'rdl'],
  [/leg curl.*(seduto|seated)/, 'seated-leg-curl'],
  [/leg curl/, 'leg-curl'],
  [/leg extension/, 'leg-extension'],
  [/hip thrust|glute bridge|ponte glutei/, 'hip-thrust'],
  [/calf.*(seduto|seated)/, 'seated-calf'],
  [/calf/, 'calf'],
  [/^(deadlift|stacco da terra)/, 'deadlift'],
  [/^(pull up|chin up|trazion[ei]$)/, 'pull-up'],
  [/(lat pulldown|pulldown|trazione verticale|lat machine)/, 'lat-pulldown'],
  [/t bar row/, 't-bar-row'],
  [/(bent over row|pendlay row|rematore.*bilanciere)/, 'barbell-row'],
  [/(dumbbell row|rematore.*manubri)/, 'db-row'],
  [/(seated cable row|seated row|cable row|rematore al cavo|pulley)/, 'cable-row'],
  [/(iso lateral row|low row|rematore.*macchina)/, 'machine-row'],
  [/(incline|inclinata).*(smith|multipower)/, 'smith-incline'],
  [/(incline|inclinata).*(dumbbell|manubri)/, 'incline-db'],
  [/(incline|inclinata).*(bench|panca|press)/, 'incline-bench'],
  [/(bench press|panca piana).*(smith|multipower)/, 'smith-bench'],
  [/(bench press|panca piana).*(dumbbell|manubri)/, 'bench-db'],
  [/(chest press)/, 'chest-press-machine'],
  [/(^bench press|panca piana|decline bench)/, 'bench'],
  [/dip/, 'dips'],
  [/(push up|piegament)/, 'push-up'],
  [/(reverse fly|rear delt|croci inverse|deltoide posteriore)/, 'rear-delt-fly'],
  [/(butterfly|pec deck|croci.*macchina|chest fly.*machine)/, 'pec-deck'],
  [/(fly|croci|crossover)/, 'chest-fly'],
  [/(overhead press|shoulder press|military press|lento avanti|lento in avanti|arnold)/, 'ohp'],
  [/(lateral raise|alzate laterali|aperture laterali).*(machine|macchina)/, 'machine-lateral'],
  [/(lateral raise|alzate laterali|aperture laterali).*(cable|cavo)/, 'cable-lateral'],
  [/(lateral raise|alzate laterali|aperture laterali)/, 'lateral-raise'],
  [/face pull/, 'face-pull'],
  [/(preacher|scott)/, 'preacher-curl'],
  [/(hammer|martello)/, 'hammer-curl'],
  [/(curl).*(cable|cavo)/, 'cable-curl'],
  [/(curl).*(dumbbell|manubri)/, 'db-curl'],
  [/(skullcrusher|french press)/, 'skullcrusher'],
  [/(rope|corda).*(pushdown|tricipiti)|(pushdown|push down).*(rope|corda)/, 'rope-pushdown'],
  [/(triceps|tricipiti|pushdown|push down)/, 'triceps'],
  [/curl/, 'curl'],
  [/^plank/, 'plank'],
  [/(crunch|sit up)/, 'crunch'],
  [/(leg raise|knee raise)/, 'hanging-leg'],
];

export function mapExercise(title: string): string {
  const t = norm(title);
  if (EXACT[t]) return EXACT[t];
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
    const st = get(r, 'set_type').toLowerCase();
    const type = st === 'warmup' ? 'warmup' : st === 'dropset' || st === 'drop' ? 'drop' : st === 'failure' ? 'failure' : 'normal';
    const seconds = num(get(r, 'duration_seconds'));
    w.exercises.get(exTitle)!.sets.push({ reps, kg, type, done: true, ...(seconds ? { seconds } : {}) });
    const ss = get(r, 'superset_id');
    if (ss !== '') w.exercises.get(exTitle)!.supersetId = `hevy-${ss}`;
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
