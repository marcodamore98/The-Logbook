import { diaryOf } from './diary';
import { shiftMinutes } from './dates';
import { dayFoodTotals, dayIntake } from './nutrition/foods';
import { countsSet, setsPerMuscle, setVolume } from './training/analytics';
import { exerciseDef } from './training/exercises';
import type { DayEntry, ISODate, Settings } from './types';
import {
  APPROACHES,
  CLAVIEN,
  CLINICAL_ACTIVITIES,
  labelOf,
  OUTING_TYPES,
  PROCEDURES,
  SETTINGS_URGENCY,
  STUDY_AREAS,
  STUDY_TYPES,
  SURGICAL_ROLES,
  WORKOUT_TYPES,
  CATEGORIES,
  type VocabItem,
} from './vocab';

export interface Count {
  label: string;
  value: number;
}

export interface Stats {
  days: number;
  work: { shifts: number; hours: number; nights: number; byType: Count[]; colleagues: Count[] };
  surgery: { total: number; byGroup: Count[]; byProcedure: Count[]; byRole: Count[]; byApproach: Count[]; bySetting: Count[]; complications: number; minutes: number };
  clinical: { total: number; byActivity: Count[] };
  study: { minutes: number; byArea: Count[]; byType: Count[] };
  workout: { sessions: number; minutes: number; volumeKg: number; km: number; sets: number; byType: Count[]; byExercise: Count[] };
  outings: { total: number; byType: Count[] };
  photos: number;
  mood?: number;
  categories: { appointments: Count[]; todos: Count[]; todosDone: number; todosTotal: number };
  muscles: Count[];
  body: { weight?: number; kcalIn?: number; steps?: number; sleepH?: number };
  nutrition: { days: number; kcal?: number; protein?: number; carbs?: number; fat?: number; daysOnKcal: number; daysOnProtein: number };
}

class Tally {
  private m = new Map<string, number>();
  add(key: string, n = 1) {
    this.m.set(key, (this.m.get(key) ?? 0) + n);
  }
  list(label: (k: string) => string): Count[] {
    return [...this.m.entries()].map(([k, v]) => ({ label: label(k), value: v })).sort((a, b) => b.value - a.value);
  }
}

const by = (list: VocabItem[]) => (id: string) => labelOf(list, id);

export function computeStats(days: DayEntry[], settings: Settings): Stats {
  const shiftT = new Tally(), colleagues = new Tally();
  const sGroup = new Tally(), sProc = new Tally(), sRole = new Tally(), sAppr = new Tally(), sSet = new Tally();
  const clin = new Tally(), stArea = new Tally(), stType = new Tally(), wType = new Tally(), wEx = new Tally(), oType = new Tally();
  const s: Stats = {
    days: days.length,
    work: { shifts: 0, hours: 0, nights: 0, byType: [], colleagues: [] },
    surgery: { total: 0, byGroup: [], byProcedure: [], byRole: [], byApproach: [], bySetting: [], complications: 0, minutes: 0 },
    clinical: { total: 0, byActivity: [] },
    study: { minutes: 0, byArea: [], byType: [] },
    workout: { sessions: 0, minutes: 0, volumeKg: 0, km: 0, sets: 0, byType: [], byExercise: [] },
    outings: { total: 0, byType: [] },
    photos: 0,
    categories: { appointments: [], todos: [], todosDone: 0, todosTotal: 0 },
    muscles: [],
    body: {},
    nutrition: { days: 0, daysOnKcal: 0, daysOnProtein: 0 },
  };
  let moodSum = 0, moodN = 0;
  const apCat = new Tally(), tdCat = new Tally();
  const nutri: Record<'protein' | 'carbs' | 'fat', number[]> = { protein: [], carbs: [], fat: [] };
  const bodyVals: Record<'weight' | 'kcalIn' | 'steps' | 'sleepH', number[]> = { weight: [], kcalIn: [], steps: [], sleepH: [] };

  for (const d of days) {
    s.photos += diaryOf(d).photos.length;
    for (const sh of [d.shift, d.guardia]) {
      if (!sh) continue;
      const t = settings.shiftTypes.find((x) => x.id === sh.shiftTypeId);
      shiftT.add(t?.name ?? sh.shiftTypeId);
      if (t?.countsAsWork !== false) {
        s.work.shifts++;
        s.work.hours += shiftMinutes(sh.start, sh.end) / 60;
        if (sh.end <= sh.start && sh.start >= '18:00') s.work.nights++;
      }
      for (const id of sh.colleagueIds) {
        const c = settings.colleagues.find((x) => x.id === id);
        if (c) colleagues.add(c.name);
      }
    }
    for (const a of d.appointments) apCat.add(a.category ?? 'altro');
    for (const t of d.todos) {
      tdCat.add(t.category ?? 'altro');
      s.categories.todosTotal++;
      if (t.done) s.categories.todosDone++;
    }
    if (d.body?.weightKg) bodyVals.weight.push(d.body.weightKg);
    const intake = dayIntake(d);
    if (intake.kcal) {
      bodyVals.kcalIn.push(intake.kcal);
      s.nutrition.days++;
      const g = settings.goals ?? {};
      if (g.kcalIn && Math.abs(intake.kcal - g.kcalIn) <= g.kcalIn * 0.1) s.nutrition.daysOnKcal++;
      if (g.proteinG && (intake.protein ?? 0) >= g.proteinG * 0.9) s.nutrition.daysOnProtein++;
      if (intake.protein) nutri.protein.push(intake.protein);
      const t = dayFoodTotals(d.food);
      if (t) {
        nutri.carbs.push(t.carbs);
        nutri.fat.push(t.fat);
      }
    }
    if (d.body?.steps) bodyVals.steps.push(d.body.steps);
    if (d.body?.sleepH) bodyVals.sleepH.push(d.body.sleepH);
    if (d.mood) {
      moodSum += d.mood;
      moodN++;
    }
    for (const m of d.modules) {
      switch (m.kind) {
        case 'surgery': {
          if (!m.procedureId) break;
          s.surgery.total++;
          sGroup.add(PROCEDURES.find((p) => p.id === m.procedureId)?.group ?? 'Altro');
          sProc.add(m.procedureId);
          sRole.add(m.role);
          sAppr.add(m.approach);
          sSet.add(m.setting);
          if (m.clavien && m.clavien !== 'none') s.surgery.complications++;
          s.surgery.minutes += m.durationMin ?? 0;
          break;
        }
        case 'clinical':
          s.clinical.total += m.count;
          clin.add(m.activityId, m.count);
          break;
        case 'study':
          s.study.minutes += m.durationMin;
          stArea.add(m.area, m.durationMin);
          stType.add(m.type, m.durationMin);
          break;
        case 'workout':
          s.workout.sessions++;
          s.workout.minutes += m.durationMin;
          s.workout.km += m.distanceKm ?? 0;
          wType.add(m.type);
          for (const ex of m.exercises) {
            for (const set of ex.sets) {
              if (!countsSet(set)) continue;
              const v = setVolume(set);
              s.workout.volumeKg += v;
              s.workout.sets++;
              wEx.add(ex.exerciseId, v);
            }
          }
          break;
        case 'outing':
          s.outings.total++;
          oType.add(m.type);
          break;
        default:
          break;
      }
    }
  }

  s.work.hours = Math.round(s.work.hours * 10) / 10;
  s.work.byType = shiftT.list((k) => k);
  s.work.colleagues = colleagues.list((k) => k);
  s.surgery.byGroup = sGroup.list((k) => k);
  s.surgery.byProcedure = sProc.list(by(PROCEDURES));
  s.surgery.byRole = sRole.list(by(SURGICAL_ROLES));
  s.surgery.byApproach = sAppr.list(by(APPROACHES));
  s.surgery.bySetting = sSet.list(by(SETTINGS_URGENCY));
  s.clinical.byActivity = clin.list(by(CLINICAL_ACTIVITIES));
  s.study.byArea = stArea.list(by(STUDY_AREAS));
  s.study.byType = stType.list(by(STUDY_TYPES));
  s.workout.byType = wType.list(by(WORKOUT_TYPES));
  s.workout.byExercise = wEx.list((id) => exerciseDef(id, settings.exercises ?? []).name).filter((c) => c.value > 0);
  s.workout.volumeKg = Math.round(s.workout.volumeKg);
  s.workout.km = Math.round(s.workout.km * 10) / 10;
  s.outings.byType = oType.list(by(OUTING_TYPES));
  s.categories.appointments = apCat.list(by(CATEGORIES));
  s.categories.todos = tdCat.list(by(CATEGORIES));
  s.muscles = [...setsPerMuscle(days, settings.exercises ?? []).entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const mean = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : undefined);
  s.nutrition = { ...s.nutrition, kcal: mean(bodyVals.kcalIn), protein: mean(nutri.protein), carbs: mean(nutri.carbs), fat: mean(nutri.fat) };
  s.body = { weight: mean(bodyVals.weight), kcalIn: mean(bodyVals.kcalIn), steps: mean(bodyVals.steps), sleepH: mean(bodyVals.sleepH) };
  s.mood = moodN ? Math.round((moodSum / moodN) * 10) / 10 : undefined;
  return s;
}

export type Metric = 'surgery' | 'hours' | 'study' | 'workout' | 'volume' | 'kcal';

export function metricOf(day: DayEntry | undefined, metric: Metric, settings: Settings): number {
  if (!day) return 0;
  switch (metric) {
    case 'surgery':
      return day.modules.filter((m) => m.kind === 'surgery' && m.procedureId).length;
    case 'hours': {
      return [day.shift, day.guardia].reduce((n, sh) => {
        if (!sh) return n;
        const t = settings.shiftTypes.find((x) => x.id === sh.shiftTypeId);
        return t?.countsAsWork === false ? n : n + shiftMinutes(sh.start, sh.end) / 60;
      }, 0);
    }
    case 'study':
      return day.modules.reduce((n, m) => n + (m.kind === 'study' ? m.durationMin / 60 : 0), 0);
    case 'workout':
      return day.modules.filter((m) => m.kind === 'workout').length;
    case 'volume':
      return day.modules.reduce((n, m) => n + (m.kind === 'workout' ? m.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + setVolume(s), 0), 0) : 0), 0);
    case 'kcal':
      return day.body?.kcalOut ?? 0;
  }
}

/** Surgical logbook as CSV (one row per procedure), for the specialty school's records. */
export function surgeryCsv(days: DayEntry[], settings: Settings): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Data', 'Gruppo', 'Intervento', 'Ruolo', 'Via d’accesso', 'Regime', 'Durata (min)', 'Complicanze', 'Tutor', 'Note']];
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const m of d.modules) {
      if (m.kind !== 'surgery' || !m.procedureId) continue;
      rows.push([
        d.date,
        PROCEDURES.find((p) => p.id === m.procedureId)?.group ?? '',
        labelOf(PROCEDURES, m.procedureId),
        labelOf(SURGICAL_ROLES, m.role),
        labelOf(APPROACHES, m.approach),
        labelOf(SETTINGS_URGENCY, m.setting),
        String(m.durationMin ?? ''),
        labelOf(CLAVIEN, m.clavien),
        settings.colleagues.find((c) => c.id === m.tutorId)?.name ?? '',
        m.notes ?? '',
      ]);
    }
  }
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n');
}

export function inRange(days: DayEntry[], from: ISODate, to: ISODate) {
  return days.filter((d) => d.date >= from && d.date <= to);
}
