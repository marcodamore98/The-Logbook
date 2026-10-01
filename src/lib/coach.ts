// Bridge with an external coach (e.g. a Claude Project acting as personal
// trainer): the coach writes a JSON "program" that the app imports, and the app
// exports recent data as JSON for the coach to review. Format: docs/personal-trainer-claude.md

import { addDays, today } from './dates';
import { mapExercise } from './hevy';
import { allFoods, entryFor, MEALS, totalsOf } from './nutrition/foods';
import { countsSet, setTypeOf, workoutVolume } from './training/analytics';
import { BUILTIN_EXERCISES, EQUIPMENT, exerciseDef, MUSCLES } from './training/exercises';
import type { DayEntry, ExerciseDef, ExerciseKind, MealId, MealPlan, MealPlanItem, PlannedSet, Routine, Settings, SetType } from './types';
import { WORKOUT_TYPES } from './vocab';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const MEAL_KEYS: Record<string, MealId> = {
  colazione: 'breakfast', breakfast: 'breakfast',
  pranzo: 'lunch', lunch: 'lunch',
  cena: 'dinner', dinner: 'dinner',
  spuntini: 'snack', spuntino: 'snack', merenda: 'snack', snack: 'snack', snacks: 'snack',
};

const SET_TYPES: Record<string, SetType> = {
  normal: 'normal', normale: 'normal', warmup: 'warmup', riscaldamento: 'warmup', w: 'warmup',
  drop: 'drop', dropset: 'drop', d: 'drop', failure: 'failure', cedimento: 'failure', f: 'failure',
};

interface InSet {
  type?: string;
  reps?: number | string;
  kg?: number;
  rpe?: number;
  seconds?: number;
}

interface InExercise {
  exercise: string;
  muscle?: string;
  equipment?: string;
  kind?: ExerciseKind;
  rest?: number;
  superset?: string;
  notes?: string;
  sets?: InSet[] | number;
  reps?: number | string;
  kg?: number;
}

interface InRoutine {
  name: string;
  folder?: string;
  type?: string;
  notes?: string;
  exercises: InExercise[];
}

interface InFood {
  food: string;
  grams?: number;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface InPlan {
  name: string;
  notes?: string;
  targets?: MealPlan['targets'];
  meals: Record<string, InFood[]>;
}

export interface CoachProgram {
  logbook?: number;
  routines?: InRoutine[];
  mealPlans?: InPlan[];
  goals?: { kcal?: number; protein?: number; carbs?: number; fat?: number; weightKg?: number; steps?: number; sleepH?: number; waterL?: number };
}

export interface ImportResult {
  settings: Settings;
  summary: string[];
  warnings: string[];
}

/**
 * Text copied from chat apps on phones often carries characters JSON rejects:
 * non-breaking/zero-width spaces, typographic quotes, comments, trailing commas.
 */
export function sanitizeJson(raw: string): string {
  let t = raw
    .replace(/[\u00a0\u2007\u202f\u2000-\u200a\u3000]/g, ' ')
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
    // Typographic quotes: delimiters if no straight quotes are present, otherwise text inside strings.
    .replace(/[\u201c\u201d\u201e\u201f\u00ab\u00bb]/g, raw.includes('"') ? "'" : '"');
  // Outside strings: drop // and /* */ comments, then trailing commas.
  let out = '';
  let inStr = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      out += c;
      if (c === '\\') {
        out += t[++i] ?? '';
      } else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
    } else if (c === '/' && t[i + 1] === '/') {
      while (i < t.length && t[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && t[i + 1] === '*') {
      i = t.indexOf('*/', i + 2);
      if (i < 0) break;
      i++;
    } else out += c;
  }
  t = out.replace(/,\s*([}\]])/g, '$1');
  return t;
}

/** Balanced {...} substrings, outermost first, ignoring braces inside strings. */
function objectCandidates(text: string): string[] {
  const out: string[] = [];
  for (let start = text.indexOf('{'); start >= 0; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inStr = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        out.push(text.slice(start, i + 1));
        start = i;
        break;
      }
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

const isProgram = (v: unknown): v is CoachProgram =>
  !!v && typeof v === 'object' && ('routines' in v || 'mealPlans' in v || 'goals' in v);

/** Accepts the JSON alone or a whole chat answer containing one or more ```json blocks. */
export function extractJson(text: string): CoachProgram {
  const clean = sanitizeJson(text);
  const fenced = [...clean.matchAll(/```[a-zA-Z]*\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const candidates = [...fenced, ...objectCandidates(clean)];
  let firstError: string | undefined;
  for (const c of candidates) {
    try {
      const v = JSON.parse(c);
      if (isProgram(v)) return v;
    } catch (e) {
      if (!firstError && c.trim().startsWith('{')) {
        const msg = e instanceof Error ? e.message : String(e);
        const pos = Number(msg.match(/position (\d+)/)?.[1]);
        firstError = isNaN(pos) ? msg : `${msg} — vicino a: “${c.slice(Math.max(0, pos - 40), pos + 40).replace(/\s+/g, ' ')}”`;
      }
    }
  }
  if (firstError) throw new Error(`Il programma non è leggibile (${firstError}). Chiedi a Claude di riscrivere solo il blocco JSON, senza commenti.`);
  throw new Error('Non trovo un programma nel testo incollato: deve contenere "routines", "mealPlans" o "goals".');
}

function parseReps(r: number | string | undefined): { reps?: number; repsMax?: number } {
  if (r === undefined || r === '') return {};
  if (typeof r === 'number') return { reps: r };
  const m = String(r).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return { reps: +m[1], repsMax: +m[2] };
  const n = parseInt(String(r), 10);
  return isNaN(n) ? {} : { reps: n };
}

export function applyProgram(program: CoachProgram, settings: Settings, newId: () => string): ImportResult {
  const summary: string[] = [];
  const warnings: string[] = [];
  const custom: ExerciseDef[] = [...(settings.exercises ?? [])];
  const routines = [...(settings.routines ?? [])];
  const plans = [...(settings.mealPlans ?? [])];

  const findExercise = (ex: InExercise): string => {
    const n = norm(ex.exercise);
    const all = [...BUILTIN_EXERCISES, ...custom];
    const hit = all.find((e) => norm(e.name) === n) ?? all.find((e) => norm(e.name).includes(n) || n.includes(norm(e.name)));
    if (hit) return hit.id;
    const mapped = mapExercise(ex.exercise);
    if (!mapped.startsWith('hevy:')) return mapped;
    const def: ExerciseDef = {
      id: `custom-${newId()}`,
      name: ex.exercise.trim(),
      muscle: (MUSCLES as readonly string[]).includes(ex.muscle ?? '') ? ex.muscle! : 'Corpo intero',
      equipment: (EQUIPMENT as readonly string[]).includes(ex.equipment ?? '') ? ex.equipment! : 'Altro',
      kind: ex.kind ?? 'weight_reps',
      custom: true,
    };
    custom.push(def);
    warnings.push(`Esercizio nuovo creato: “${def.name}” (${def.muscle}, ${def.equipment}).`);
    return def.id;
  };

  for (const r of program.routines ?? []) {
    if (!r?.name || !Array.isArray(r.exercises)) continue;
    const groups = new Map<string, string>();
    const routine: Routine = {
      id: newId(),
      name: r.name,
      folder: r.folder,
      type: WORKOUT_TYPES.some((t) => t.id === r.type) ? r.type : 'strength',
      notes: r.notes,
      updatedAt: Date.now(),
      exercises: r.exercises.map((ex) => {
        const sets: PlannedSet[] = Array.isArray(ex.sets)
          ? ex.sets.map((s) => ({ type: SET_TYPES[norm(s.type ?? 'normal')] ?? 'normal', ...parseReps(s.reps), kg: s.kg, rpe: s.rpe, seconds: s.seconds }))
          : Array.from({ length: typeof ex.sets === 'number' ? ex.sets : 3 }, () => ({ type: 'normal' as const, ...parseReps(ex.reps), kg: ex.kg }));
        if (ex.superset && !groups.has(ex.superset)) groups.set(ex.superset, newId());
        return {
          exerciseId: findExercise(ex),
          sets,
          restSec: ex.rest ?? 90,
          supersetId: ex.superset ? groups.get(ex.superset) : undefined,
          notes: ex.notes,
        };
      }),
    };
    const existing = routines.findIndex((x) => norm(x.name) === norm(r.name) && (x.folder ?? '') === (r.folder ?? ''));
    if (existing >= 0) routines[existing] = { ...routine, id: routines[existing].id };
    else routines.push(routine);
    summary.push(`Scheda “${r.name}”${r.folder ? ` (${r.folder})` : ''}: ${routine.exercises.length} esercizi${existing >= 0 ? ' — aggiornata' : ''}`);
  }

  const foods = allFoods(settings.foods ?? []);
  for (const p of program.mealPlans ?? []) {
    if (!p?.name || !p.meals) continue;
    const meals: MealPlan['meals'] = {};
    for (const [key, items] of Object.entries(p.meals)) {
      const meal = MEAL_KEYS[norm(key)];
      if (!meal) {
        warnings.push(`Pasto “${key}” non riconosciuto (usa colazione, pranzo, cena, spuntini).`);
        continue;
      }
      meals[meal] = (items ?? []).map((it): MealPlanItem => {
        const grams = it.grams ?? 0;
        if (it.kcal !== undefined) {
          return { name: it.food, grams, kcal: it.kcal, protein: it.protein ?? 0, carbs: it.carbs ?? 0, fat: it.fat ?? 0 };
        }
        const n = norm(it.food);
        const f = foods.find((x) => norm(x.name) === n) ?? foods.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name)));
        if (!f) {
          warnings.push(`“${it.food}” non è nel database e non ha calorie: aggiunto con 0 kcal, correggilo nel diario.`);
          return { name: it.food, grams, kcal: 0, protein: 0, carbs: 0, fat: 0 };
        }
        const e = entryFor(f, grams || f.portionG || 100, 'x');
        return { foodId: f.id, name: f.name, grams: e.grams, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat };
      });
    }
    const plan: MealPlan = { id: newId(), name: p.name, notes: p.notes, targets: p.targets, meals, updatedAt: Date.now() };
    const existing = plans.findIndex((x) => norm(x.name) === norm(p.name));
    if (existing >= 0) plans[existing] = { ...plan, id: plans[existing].id };
    else plans.push(plan);
    const t = totalsOf(Object.values(meals).flat().map((x, i) => ({ ...x, id: String(i) })));
    summary.push(`Piano alimentare “${p.name}”: ${fmtN(t.kcal)} kcal, ${fmtN(t.protein)} g proteine${existing >= 0 ? ' — aggiornato' : ''}`);
  }

  let goals = settings.goals ?? {};
  if (program.goals) {
    const g = program.goals;
    goals = {
      ...goals,
      ...(g.kcal !== undefined && { kcalIn: g.kcal }),
      ...(g.protein !== undefined && { proteinG: g.protein }),
      ...(g.carbs !== undefined && { carbsG: g.carbs }),
      ...(g.fat !== undefined && { fatG: g.fat }),
      ...(g.weightKg !== undefined && { weightKg: g.weightKg }),
      ...(g.steps !== undefined && { steps: g.steps }),
      ...(g.sleepH !== undefined && { sleepH: g.sleepH }),
      ...(g.waterL !== undefined && { waterL: g.waterL }),
    };
    summary.push('Obiettivi aggiornati');
  }

  if (!summary.length) throw new Error('Il programma non contiene schede, piani alimentari od obiettivi.');
  return { settings: { ...settings, exercises: custom, routines, mealPlans: plans, goals }, summary, warnings };
}

const fmtN = (n: number) => Math.round(n).toLocaleString('it-IT');

/** Recent data for the coach: workouts, nutrition and body, plus current routines and goals. */
export function exportForCoach(days: DayEntry[], settings: Settings, weeks = 4) {
  const from = addDays(today(), -7 * weeks);
  const recent = days.filter((d) => d.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  const ex = settings.exercises ?? [];
  return {
    logbookExport: 1,
    exportedAt: new Date().toISOString(),
    period: { from, to: today() },
    goals: settings.goals ?? {},
    routines: (settings.routines ?? []).map((r) => ({
      name: r.name,
      folder: r.folder,
      type: r.type,
      exercises: r.exercises.map((e) => ({
        exercise: exerciseDef(e.exerciseId, ex).name,
        rest: e.restSec,
        sets: e.sets.map((s) => ({ type: s.type, reps: s.repsMax ? `${s.reps}-${s.repsMax}` : s.reps, kg: s.kg, rpe: s.rpe })),
      })),
    })),
    days: recent.map((d) => {
      const food = d.food ? Object.fromEntries(MEALS.filter((m) => d.food!.meals[m.id]?.length).map((m) => [m.label.toLowerCase(), d.food!.meals[m.id]!.map((e) => ({ food: e.name, grams: e.grams, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat }))])) : undefined;
      const all = d.food ? Object.values(d.food.meals).flat().filter(Boolean) : [];
      return {
        date: d.date,
        shift: d.shift ? settings.shiftTypes.find((t) => t.id === d.shift!.shiftTypeId)?.name : undefined,
        body: d.body,
        nutritionTotals: all.length ? totalsOf(all as never) : undefined,
        meals: food,
        workouts: d.modules
          .filter((m) => m.kind === 'workout')
          .map((m) =>
            m.kind === 'workout'
              ? {
                  title: m.title,
                  type: m.type,
                  durationMin: m.durationMin,
                  volumeKg: Math.round(workoutVolume(m)),
                  exercises: m.exercises.map((e) => ({
                    exercise: exerciseDef(e.exerciseId, ex).name,
                    sets: e.sets.filter((s) => countsSet(s) || setTypeOf(s) === 'warmup').map((s) => ({ type: setTypeOf(s), kg: s.kg, reps: s.reps, rpe: s.rpe })),
                  })),
                }
              : null,
          ),
        mood: d.mood,
      };
    }),
  };
}
