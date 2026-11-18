// Bringing Garmin Connect into the days: daily figures (steps, active calories, sleep, resting
// heart rate, stress, Body Battery, HRV, weight) and the runs recorded with the watch.
//
// Garmin's answers are read loosely (a value is looked for by its known names at any depth),
// so a small change in their format does not break everything.

import { addDays, today } from '../dates';
import type { useStore } from '../store/StoreContext';
import type { DayEntry, GarminDay, ISODate, RunModule } from '../types';
import { GarminError, garminGet, readConfig, setState, writeConfig, type GarminConfig } from './client';

type Store = ReturnType<typeof useStore>;
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Follows a dotted path ("sleepScores.overall.value") from an object. */
function at(o: unknown, path: string): unknown {
  let cur: unknown = o;
  for (const k of path.split('.')) {
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

/** The first number found under one of the names (or dotted paths), searching level by level. */
export function val(o: unknown, names: string[]): number | undefined {
  const queue: unknown[] = [o];
  let seen = 0;
  while (queue.length && seen++ < 400) {
    const cur = queue.shift();
    if (!isObj(cur)) continue;
    for (const n of names) {
      const v = n.includes('.') ? at(cur, n) : cur[n];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    for (const v of Object.values(cur)) {
      if (isObj(v)) queue.push(v);
      else if (Array.isArray(v) && v.length <= 7) v.forEach((x) => isObj(x) && queue.push(x));
    }
  }
  return undefined;
}

const DATE_KEYS = ['calendarDate', 'summaryDate', 'date', 'startDate'];
const dateOf = (o: Obj): ISODate | undefined => {
  for (const k of DATE_KEYS) {
    const v = o[k];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  return undefined;
};

/** Rows of a range answer, by day: the first list of objects that carry a date. */
export function rowsByDate(json: unknown): Map<ISODate, Obj> {
  const out = new Map<ISODate, Obj>();
  const queue: unknown[] = [json];
  let seen = 0;
  while (queue.length && seen++ < 200) {
    const cur = queue.shift();
    if (Array.isArray(cur)) {
      const rows = cur.filter(isObj);
      if (rows.length && rows.some((r) => dateOf(r))) {
        for (const r of rows) {
          const d = dateOf(r);
          if (d && !out.has(d)) out.set(d, r);
        }
        return out;
      }
      rows.forEach((r) => queue.push(r));
    } else if (isObj(cur)) {
      Object.values(cur).forEach((v) => (isObj(v) || Array.isArray(v)) && queue.push(v));
    }
  }
  return out;
}

const round = (v: number | undefined) => (v === undefined ? undefined : Math.round(v));

/** One day's figures from a daily summary (flat or grouped by topic). */
export function fromSummary(s: unknown): Partial<GarminDay> {
  const moderate = val(s, ['moderateIntensityMinutes', 'moderateMinutes', 'intensityMinutes.moderate']);
  const vigorous = val(s, ['vigorousIntensityMinutes', 'vigorousMinutes', 'intensityMinutes.vigorous']);
  return {
    steps: round(val(s, ['totalSteps', 'movement.steps', 'steps'])),
    stepGoal: round(val(s, ['dailyStepGoal', 'stepGoal', 'movement.stepGoal'])),
    distanceM: round(val(s, ['totalDistanceMeters', 'movement.distanceMeters', 'distanceMeters'])),
    floors: round(val(s, ['floorsAscended', 'floorsClimbed', 'movement.floorsAscended'])),
    activeKcal: round(val(s, ['activeKilocalories', 'activeCalories', 'calories.active', 'calories.activeKilocalories', 'energy.activeKilocalories'])),
    bmrKcal: round(val(s, ['bmrKilocalories', 'bmrCalories', 'calories.bmr', 'calories.bmrKilocalories', 'energy.bmrKilocalories'])),
    totalKcal: round(val(s, ['totalKilocalories', 'totalCalories', 'calories.total', 'calories.totalKilocalories', 'energy.totalKilocalories'])),
    // Garmin counts vigorous minutes twice.
    intensityMin: moderate !== undefined || vigorous !== undefined ? Math.round((moderate ?? 0) + 2 * (vigorous ?? 0)) : undefined,
    restingHr: round(val(s, ['restingHeartRate', 'heartRate.restingValue', 'heartRate.resting'])),
    minHr: round(val(s, ['minHeartRate', 'heartRate.minValue'])),
    maxHr: round(val(s, ['maxHeartRate', 'heartRate.maxValue'])),
    stress: round(val(s, ['averageStressLevel', 'avgStressLevel', 'overallStressLevel', 'stress.averageLevel', 'stress.avgLevel', 'stress.average'])),
    bodyBatteryHigh: round(val(s, ['bodyBatteryHighestValue', 'bodyBattery.highestValue', 'bodyBattery.highest', 'bodyBattery.maxValue'])),
    bodyBatteryLow: round(val(s, ['bodyBatteryLowestValue', 'bodyBattery.lowestValue', 'bodyBattery.lowest', 'bodyBattery.minValue'])),
    sleepSec: round(val(s, ['sleepingSeconds'])),
  };
}

export function fromSleep(s: unknown): Partial<GarminDay> {
  return {
    sleepSec: round(val(s, ['sleepTimeSeconds', 'totalSleepSeconds', 'sleepSeconds'])),
    deepSec: round(val(s, ['deepSleepSeconds'])),
    remSec: round(val(s, ['remSleepSeconds'])),
    sleepScore: round(val(s, ['sleepScores.overall.value', 'overallSleepScore.value', 'sleepScore.value', 'overallSleepScore', 'sleepScore'])),
  };
}

/** Only the values that are there (undefined ones would hide those from another answer). */
const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as Partial<T>;

const RUN = /run/i;

/** A run recorded with the watch, as a Corsa card. */
export function runFromActivity(a: Obj): { date: ISODate; m: RunModule } | null {
  const type = String((isObj(a.activityType) ? a.activityType.typeKey : a.activityType) ?? '');
  if (!RUN.test(type)) return null;
  const local = String(a.startTimeLocal ?? '');
  if (!/^\d{4}-\d{2}-\d{2}/.test(local)) return null;
  const id = String(a.activityId ?? '');
  if (!id) return null;
  const startedAt = new Date(local.replace(' ', 'T')).getTime();
  const moving = typeof a.movingDuration === 'number' && a.movingDuration > 0 ? a.movingDuration : 0;
  const duration = typeof a.duration === 'number' ? a.duration : moving;
  const indoor = /treadmill|indoor|virtual/i.test(type);
  const num = (k: string) => (typeof a[k] === 'number' && Number.isFinite(a[k]) ? (a[k] as number) : undefined);
  return {
    date: local.slice(0, 10),
    m: {
      kind: 'run',
      id: `garmin-${id}`,
      garminId: id,
      title: typeof a.activityName === 'string' && a.activityName.trim() ? a.activityName.trim() : undefined,
      mode: indoor ? 'treadmill' : 'continuous',
      distanceM: Math.round(num('distance') ?? 0),
      durationSec: Math.round(duration || moving),
      startedAt: Number.isFinite(startedAt) ? startedAt : undefined,
      ...defined({
        avgHr: round(num('averageHR')),
        maxHr: round(num('maxHR')),
        kcal: round(num('calories')),
        elevationM: round(num('elevationGain')),
        maxSpeedKmh: num('maxSpeed') ? Math.round(num('maxSpeed')! * 36) / 10 : undefined,
      }),
    },
  };
}

/** Adds a Garmin run to a day, or completes the same run already written in the app. */
export function withRun(d: DayEntry, run: RunModule): DayEntry {
  if (d.modules.some((m) => m.kind === 'run' && m.garminId === run.garminId)) return d;
  const twin = d.modules.find((m): m is RunModule => m.kind === 'run' && !m.garminId && !!m.startedAt && !!run.startedAt && Math.abs(m.startedAt - run.startedAt) < 15 * 60e3);
  if (twin) {
    const { id: _id, kind: _k, title: _t, mode: _mode, ...extra } = run;
    void _id, _k, _t, _mode;
    return { ...d, modules: d.modules.map((m) => (m === twin ? { ...twin, ...defined(extra), distanceM: twin.distanceM || run.distanceM, durationSec: twin.durationSec || run.durationSec } : m)) };
  }
  return { ...d, modules: [...d.modules, run] };
}

function daysBetween(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Runs async jobs a few at a time. */
async function pool<T>(items: T[], n: number, job: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) await job(queue.shift()!);
  }));
}

let running: Promise<{ days: number; runs: number }> | null = null;

/**
 * Reads Garmin from the day before the last one read up to today (the first time, the last two
 * weeks; at most four weeks) and writes what changed into the days.
 */
export function syncGarmin(getStore: () => Store, opts: { fromDays?: number } = {}): Promise<{ days: number; runs: number }> {
  if (running) return running;
  const cfg = readConfig();
  if (!cfg) return Promise.resolve({ days: 0, runs: 0 });
  setState({ syncing: true, error: undefined });
  running = doSync(getStore, cfg, opts)
    .then((r) => {
      setState({ syncing: false, error: undefined, lastSync: cfg.lastSync, last: r });
      return r;
    })
    .catch((e: unknown) => {
      const msg = e instanceof GarminError ? e.message : `Sincronizzazione non riuscita: ${e instanceof Error ? e.message : String(e)}`;
      setState({ syncing: false, error: msg });
      throw e;
    })
    .finally(() => {
      running = null;
    });
  return running;
}

async function doSync(getStore: () => Store, cfg: GarminConfig, opts: { fromDays?: number }) {
  const to = today();
  const earliest = addDays(to, -27);
  let from = opts.fromDays ? addDays(to, -(opts.fromDays - 1)) : cfg.lastDay ? addDays(cfg.lastDay, -1) : addDays(to, -13);
  if (from < earliest) from = earliest;
  if (from > to) from = to;
  const days = daysBetween(from, to);
  const figures = new Map<ISODate, Partial<GarminDay>>(days.map((d) => [d, {}]));
  const add = (d: ISODate, p: Partial<GarminDay>, fill = false) => {
    const cur = figures.get(d);
    if (!cur) return;
    const clean = defined(p);
    figures.set(d, fill ? { ...clean, ...cur } : { ...cur, ...clean });
  };
  const soft = async <T>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (e) {
      // A missing permission or an unknown path for one metric does not stop the others;
      // a wrong key or an unreachable bridge does.
      if (e instanceof GarminError && e.fatal) throw e;
      return null;
    }
  };

  // Daily summaries (one call for the whole range).
  const summaries = rowsByDate(await soft(garminGet(cfg, '/usersummary-service/v2/dailysummaries', { startDate: from, endDate: to })));
  for (const [d, row] of summaries) add(d, fromSummary(row));
  // Where the grouped summary does not say the active calories, the classic daily summary does
  // (only for days the watch has data for, unless the grouped one did not answer at all).
  await pool(
    days.filter((d) => figures.get(d)?.activeKcal === undefined && (!summaries.size || summaries.has(d))),
    2,
    async (d) => add(d, fromSummary(await soft(garminGet(cfg, '/usersummary-service/usersummary/daily', { calendarDate: d }))), true),
  );

  // Sleep: range first, then the single days still missing.
  const sleeps = rowsByDate(await soft(garminGet(cfg, '/sleep-service/sleep/dailySleepSummariesByDate', { startDate: from, endDate: to })));
  for (const [d, row] of sleeps) add(d, fromSleep(row));
  const withData = (d: ISODate) => (sleeps.size ? sleeps.has(d) : !summaries.size || summaries.has(d));
  await pool(
    days.filter((d) => figures.get(d)?.sleepScore === undefined && withData(d)),
    2,
    async (d) => add(d, fromSleep(await soft(garminGet(cfg, '/sleep-service/sleep/dailySleep', { date: d })))),
  );

  // HRV of the night.
  for (const [d, row] of rowsByDate(await soft(garminGet(cfg, `/hrv-service/hrv/daily/${from}/${to}`)))) {
    const status = typeof row.status === 'string' ? row.status : undefined;
    add(d, { hrv: round(val(row, ['lastNightAvg', 'lastNight', 'weeklyAvg'])), hrvStatus: status });
  }

  // Body Battery, where the summaries do not have it.
  if (days.some((d) => figures.get(d)?.bodyBatteryHigh === undefined)) {
    const rep = await soft(garminGet<unknown>(cfg, '/wellness-service/wellness/bodyBattery/reports/daily', { startDate: from, endDate: to }));
    for (const [d, row] of rowsByDate(rep)) {
      const values = (Array.isArray(row.bodyBatteryValuesArray) ? row.bodyBatteryValuesArray : [])
        .map((x) => (Array.isArray(x) ? x[x.length - 1] : undefined))
        .filter((x): x is number => typeof x === 'number');
      if (values.length) add(d, { bodyBatteryHigh: Math.max(...values), bodyBatteryLow: Math.min(...values) }, true);
    }
  }

  // Weight (in grams on Garmin).
  const weights = new Map<ISODate, number>();
  for (const [d, row] of rowsByDate(await soft(garminGet(cfg, `/weight-service/weight/range/${from}/${to}`, { includeAll: 'true' })))) {
    const w = val(row, ['latestWeight.weight', 'weight']);
    if (w) weights.set(d, Math.round((w > 1000 ? w / 1000 : w) * 10) / 10);
  }

  // Runs recorded with the watch.
  const acts = await soft(garminGet<unknown>(cfg, '/activitylist-service/activities/search/activities', { start: 0, limit: 100, startDate: from, endDate: to }));
  const list = (Array.isArray(acts) ? acts : isObj(acts) ? (Object.values(acts).find(Array.isArray) ?? []) : []).filter(isObj);
  const seen = new Set(cfg.seen ?? []);
  const runs = list.map(runFromActivity).filter((r): r is NonNullable<typeof r> => !!r && !seen.has(r.m.garminId!));

  // Into the days: only what changed is saved.
  const store = getStore();
  await store.loadRange(from, to);
  let changed = 0;
  let added = 0;
  const now = Date.now();
  for (const d of new Set([...days, ...runs.map((r) => r.date)])) {
    const g = figures.get(d) ?? {};
    const kg = weights.get(d);
    const dayRuns = runs.filter((r) => r.date === d);
    const hasFigures = Object.values(g).some((v) => v !== undefined);
    if (!hasFigures && kg === undefined && !dayRuns.length) continue;
    let did = false;
    await getStore().updateDay(d, (day) => {
      let next: DayEntry = day;
      if (hasFigures) {
        const prev = day.garmin;
        const garmin: GarminDay = { ...g, syncedAt: now };
        const same = prev && JSON.stringify({ ...prev, syncedAt: 0 }) === JSON.stringify({ ...garmin, syncedAt: 0 });
        const body = { ...day.body };
        if (g.steps !== undefined) body.steps = g.steps;
        if (g.sleepSec) body.sleepH = Math.round(g.sleepSec / 36) / 100;
        if (g.restingHr) body.restingHr = g.restingHr;
        next = { ...next, garmin: same ? prev : garmin, body };
      }
      if (kg !== undefined) next = { ...next, body: { ...next.body, weightKg: kg } };
      for (const r of dayRuns) {
        const before = next.modules.length;
        next = withRun(next, r.m);
        if (next.modules.length > before) added++;
      }
      did = JSON.stringify(next) !== JSON.stringify(day);
      return next;
    });
    for (const r of dayRuns) seen.add(r.m.garminId!);
    if (did) changed++;
  }

  // The latest weight also goes with the settings (calories burned on days without Garmin).
  const lastW = [...weights.entries()].sort((a, b) => b[0].localeCompare(a[0]))[0];
  if (lastW) {
    const s = getStore().settings;
    const prof = s.profile ?? {};
    if (lastW[0] >= (prof.weightDate ?? '') && prof.weightKg !== lastW[1]) getStore().saveSettings({ ...s, profile: { ...prof, weightKg: lastW[1], weightDate: lastW[0] } });
  }

  const latest = readConfig() ?? cfg;
  writeConfig({ ...latest, lastDay: to, lastSync: Date.now(), seen: [...seen].slice(-500) });
  cfg.lastSync = Date.now();
  return { days: changed, runs: added };
}
