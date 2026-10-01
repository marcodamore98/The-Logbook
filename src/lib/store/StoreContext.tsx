import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { rangeDays } from '../dates';
import { authorize, disconnect, gcalConfigured, hasToken, listEvents, eventLocal, type GEvent } from '../google/calendar';
import { linkedIds, pushDay, reconcile, trashRemoved } from '../google/sync';
import { emptyDay, type DayEntry, type ISODate, type Settings } from '../types';
import type { ImportedWorkout } from '../hevy';
import { buildHistory, type History } from '../training/analytics';
import { myRosterDays, shiftFromCodes } from '../roster';
import { defaultSettings, migrateSettings } from '../vocab';
import type { Repo } from './repo';

interface Store {
  repo: Repo;
  settings: Settings;
  saveSettings(s: Settings): void;
  day(date: ISODate): DayEntry;
  saveDay(d: DayEntry): void;
  /** Loads days (and Google events) for a range; safe to call repeatedly. */
  loadRange(from: ISODate, to: ISODate): Promise<void>;
  /** Google events for a date that are not already logbook items. */
  eventsOn(date: ISODate): GEvent[];
  gcal: { configured: boolean; connected: boolean; syncing: boolean; error?: string };
  connectGoogle(): Promise<void>;
  disconnectGoogle(): void;
  /** Pushes every stored day to Google Calendar (items not yet linked, pending deletions). */
  syncAll(): Promise<number>;
  loadAll(): Promise<DayEntry[]>;
  /** Fills the user's shift from the department roster on days that have none. */
  importRoster(): Promise<{ added: number; kept: number }>;
  /** Adds Hevy workouts to their days; a workout imported again replaces its earlier copy. */
  importWorkouts(list: ImportedWorkout[]): Promise<{ added: number; updated: number }>;
  /** Every loaded day (call ensureAllLoaded for the full archive). */
  allDays: DayEntry[];
  /** Training history per exercise, from allDays. */
  history: History;
  ensureAllLoaded(): void;
  /** Applies fn to the latest version of a day (loading it first if needed) and saves it. */
  updateDay(date: ISODate, fn: (d: DayEntry) => DayEntry): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

function persist(repo: Repo, p: Promise<void>) {
  // Firestore resolves writes only on server ack; offline writes are already cached, so never block UI.
  p.catch((e) => console.error(`[${repo.mode}] salvataggio fallito`, e));
}

/** Copies Google ids from a pushed snapshot onto the latest local version of the same day. */
function mergeIds(latest: DayEntry, pushed: DayEntry, trashed: string[]): DayEntry {
  const out = structuredClone(latest);
  for (const k of ['shift', 'guardia'] as const) {
    if (out[k] && pushed[k] && !out[k]!.gcalEventId) out[k]!.gcalEventId = pushed[k]!.gcalEventId;
  }
  for (const a of out.appointments) a.gcalEventId ??= pushed.appointments.find((x) => x.id === a.id)?.gcalEventId;
  for (const t of out.todos) {
    const p = pushed.todos.find((x) => x.id === t.id);
    if (p && t.time) t.gcalEventId ??= p.gcalEventId;
    if (p && !p.time && !t.time) t.gcalEventId = undefined;
  }
  out.gcalTrash = (out.gcalTrash ?? []).filter((id) => !trashed.includes(id));
  return out;
}

export function StoreProvider({ repo, children }: { repo: Repo; children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [days, setDays] = useState<Record<ISODate, DayEntry>>({});
  const [events, setEvents] = useState<Record<ISODate, GEvent[]>>({});
  const [connected, setConnected] = useState(hasToken());
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string>();

  const daysRef = useRef(days);
  daysRef.current = days;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const pushedBase = useRef<Record<ISODate, DayEntry>>({});
  const timers = useRef<Record<string, number>>({});
  const pending = useRef<Record<ISODate, DayEntry>>({});

  useEffect(() => {
    // Flush debounced writes when the app is hidden or closed.
    const flush = () => {
      for (const d of Object.values(pending.current)) persist(repo, repo.saveDay(d));
      pending.current = {};
    };
    const onVis = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, [repo]);

  useEffect(() => {
    repo.getSettings().then((s) => {
      if (!s) return;
      const migrated = migrateSettings(s);
      const next = { ...defaultSettings(), ...migrated, gcal: { ...defaultSettings().gcal, ...migrated.gcal } };
      setSettings(next);
      if (migrated !== s) persist(repo, repo.saveSettings(next));
    });
  }, [repo]);

  const saveSettings = useCallback(
    (s: Settings) => {
      const next = { ...s, updatedAt: Date.now() };
      setSettings(next);
      window.clearTimeout(timers.current.settings);
      timers.current.settings = window.setTimeout(() => persist(repo, repo.saveSettings(next)), 400);
    },
    [repo],
  );

  const writeDay = useCallback(
    (d: DayEntry) => {
      daysRef.current = { ...daysRef.current, [d.date]: d };
      setDays(daysRef.current);
      // Debounced so typing in a note does not write on every keystroke.
      pending.current[d.date] = d;
      window.clearTimeout(timers.current[`w:${d.date}`]);
      timers.current[`w:${d.date}`] = window.setTimeout(() => {
        delete pending.current[d.date];
        persist(repo, repo.saveDay(d));
      }, 400);
    },
    [repo],
  );

  const push = useCallback(
    async (date: ISODate, force = false) => {
      const s = settingsRef.current;
      const snapshot = daysRef.current[date];
      if (!snapshot || !s.gcal.enabled || !hasToken()) return;
      setSyncing(true);
      try {
        const trashed = snapshot.gcalTrash ?? [];
        const pushed = await pushDay(pushedBase.current[date], snapshot, s, force);
        pushedBase.current[date] = pushed;
        const merged = mergeIds(daysRef.current[date], pushed, trashed);
        if (JSON.stringify(merged) !== JSON.stringify(daysRef.current[date])) writeDay(merged);
        setError(undefined);
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
        setConnected(hasToken());
      } finally {
        setSyncing(false);
      }
    },
    [writeDay],
  );

  const saveDay = useCallback(
    (d: DayEntry) => {
      const prev = daysRef.current[d.date];
      const next = trashRemoved(prev, { ...d, updatedAt: Date.now() });
      writeDay(next);
      window.clearTimeout(timers.current[d.date]);
      timers.current[d.date] = window.setTimeout(() => push(d.date), 1200);
    },
    [writeDay, push],
  );

  const loadRange = useCallback(
    async (from: ISODate, to: ISODate) => {
      const loaded = await repo.getRange(from, to);
      const merged = { ...daysRef.current };
      for (const d of loaded) {
        const cached = merged[d.date];
        if (cached && cached.updatedAt > d.updatedAt) continue; // newer local edit not yet persisted
        merged[d.date] = d;
        pushedBase.current[d.date] ??= d;
      }
      daysRef.current = merged;
      setDays(merged);

      const s = settingsRef.current;
      if (!s.gcal.enabled || !hasToken()) return;
      try {
        const cals = [...new Set([s.gcal.calendarId, ...s.gcal.readCalendarIds])];
        const all = (await Promise.all(cals.map((c) => listEvents(c, from, to)))).flat();
        const byDate: Record<ISODate, GEvent[]> = {};
        for (const e of all) {
          const { date } = eventLocal(e.start);
          (byDate[date] ??= []).push(e);
        }
        setEvents((prev) => {
          const out = { ...prev };
          for (const d of rangeDays(from, to)) out[d] = byDate[d] ?? [];
          return out;
        });
        for (const d of loaded) {
          const r = reconcile(d, byDate[d.date] ?? []);
          if (r) {
            pushedBase.current[d.date] = r;
            writeDay(r);
          }
        }
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
        setConnected(hasToken());
      }
    },
    [repo, writeDay],
  );

  const connectGoogle = useCallback(async () => {
    const ok = await authorize(true);
    setConnected(ok);
    if (ok && !settingsRef.current.gcal.enabled) saveSettings({ ...settingsRef.current, gcal: { ...settingsRef.current.gcal, enabled: true } });
    if (!ok) setError('Autorizzazione Google non concessa');
    else setError(undefined);
  }, [saveSettings]);

  const disconnectGoogle = useCallback(() => {
    disconnect();
    setConnected(false);
    setEvents({});
  }, []);

  const syncAll = useCallback(async () => {
    const all = await repo.getAll();
    let n = 0;
    for (const d of all) {
      daysRef.current = { ...daysRef.current, [d.date]: daysRef.current[d.date] ?? d };
      const needs =
        (d.gcalTrash?.length ?? 0) > 0 ||
        (d.shift && !d.shift.gcalEventId) ||
        (d.guardia && !d.guardia.gcalEventId) ||
        d.appointments.some((a) => !a.gcalEventId) ||
        d.todos.some((t) => t.time && !t.gcalEventId);
      if (needs) {
        await push(d.date);
        n++;
      }
    }
    return n;
  }, [repo, push]);

  const importRoster = useCallback(async () => {
    const mine = myRosterDays();
    if (!mine.length) return { added: 0, kept: 0 };
    await loadRange(mine[0].date, mine[mine.length - 1].date);
    let added = 0;
    let kept = 0;
    for (const { date, codes } of mine) {
      const cur = daysRef.current[date] ?? emptyDay(date);
      const shift = shiftFromCodes(codes, date, settingsRef.current.colleagues);
      if (cur.shift || !shift) {
        kept++;
        continue;
      }
      saveDay({ ...cur, shift });
      added++;
    }
    return { added, kept };
  }, [loadRange, saveDay]);

  const importWorkouts = useCallback(
    async (list: ImportedWorkout[]) => {
      if (!list.length) return { added: 0, updated: 0 };
      const dates = list.map((w) => w.date).sort();
      await loadRange(dates[0], dates[dates.length - 1]);
      let added = 0;
      let updated = 0;
      const byDate = new Map<ISODate, ImportedWorkout[]>();
      for (const w of list) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
      for (const [date, ws] of byDate) {
        const cur = daysRef.current[date] ?? emptyDay(date);
        const modules = [...cur.modules];
        for (const { module } of ws) {
          const i = modules.findIndex((m) => m.id === module.id);
          if (i >= 0) {
            modules[i] = module;
            updated++;
          } else {
            modules.push(module);
            added++;
          }
        }
        saveDay({ ...cur, modules });
      }
      return { added, updated };
    },
    [loadRange, saveDay],
  );

  const allLoaded = useRef(false);
  const ensureAllLoaded = useCallback(() => {
    if (allLoaded.current) return;
    allLoaded.current = true;
    repo.getAll().then((loaded) => {
      const merged = { ...daysRef.current };
      for (const d of loaded) {
        const cached = merged[d.date];
        if (cached && cached.updatedAt > d.updatedAt) continue;
        merged[d.date] = d;
        pushedBase.current[d.date] ??= d;
      }
      daysRef.current = merged;
      setDays(merged);
    });
  }, [repo]);

  const updateDay = useCallback(
    async (date: ISODate, fn: (d: DayEntry) => DayEntry) => {
      if (!daysRef.current[date]) await loadRange(date, date);
      saveDay(fn(structuredClone(daysRef.current[date] ?? emptyDay(date))));
    },
    [loadRange, saveDay],
  );

  const allDays = useMemo(() => Object.values(days), [days]);
  const history = useMemo(() => buildHistory(allDays), [allDays]);

  const linked = useMemo(() => linkedIds(Object.values(days)), [days]);

  const store: Store = {
    repo,
    settings,
    saveSettings,
    day: (date) => days[date] ?? emptyDay(date),
    saveDay,
    loadRange,
    eventsOn: (date) =>
      (events[date] ?? []).filter((e) => !linked.has(e.id) && e.extendedProperties?.private?.logbook !== '1'),
    gcal: { configured: gcalConfigured, connected, syncing, error },
    connectGoogle,
    disconnectGoogle,
    syncAll,
    loadAll: () => repo.getAll(),
    importRoster,
    importWorkouts,
    allDays,
    history,
    ensureAllLoaded,
    updateDay,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
