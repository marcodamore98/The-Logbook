import { createStore, del, entries, get, set } from 'idb-keyval';
import { bodyOf, plainOf } from '../notes';
import type { DayEntry, ISODate } from '../types';

/**
 * Earlier versions of each day, kept on this device (not on the cloud) for 60 days: whatever
 * removes something — a mistake, Google Calendar, another device — the day as it was can be seen
 * and its items put back. Edits close together become one version; a removal always starts a new one.
 */

const db = createStore('the-logbook-history', 'versions');
const KEEP_DAYS = 60;
const PER_DAY = 40;
const MERGE_MS = 5 * 60_000;

export interface Version {
  date: ISODate;
  /** When this version was saved. */
  at: number;
  day: DayEntry;
  /** What disappeared compared with the version before (filled when it is a removal). */
  lost?: string[];
  /** Where it came from. */
  source?: 'app' | 'cloud' | 'google';
}

const key = (date: ISODate, at: number) => `${date}|${String(at).padStart(14, '0')}`;

/** Everything in a day that can be lost, by id, with a readable name. */
export function itemsOf(d: DayEntry): Map<string, string> {
  const out = new Map<string, string>();
  if (d.shift) out.set('shift', 'Turno');
  if (d.guardia) out.set('guardia', 'Guardia medica');
  for (const m of d.modules) out.set(m.id, labelOfModule(m));
  for (const a of d.appointments) out.set(a.id, `Impegno “${a.title || 'senza titolo'}”`);
  for (const t of d.todos) out.set(t.id, `Promemoria “${t.text || '…'}”`);
  for (const n of d.looseNotes ?? []) out.set(n.id, `Nota “${n.title || 'senza titolo'}”`);
  for (const list of Object.values(d.food?.meals ?? {})) for (const e of list ?? []) out.set(e.id, `Alimento “${e.name}”`);
  if (d.diary?.text?.trim() || d.diary?.photos?.length) out.set('diary', 'Diario del giorno');
  return out;
}

const KIND: Record<string, string> = { surgery: 'Attività chirurgica', clinical: 'Attività clinica', study: 'Studio', workout: 'Allenamento', run: 'Corsa', course: 'Corso', travel: 'Viaggio', outing: 'Uscita', photos: 'Foto', note: 'Nota' };
function labelOfModule(m: DayEntry['modules'][number]): string {
  const title = 'title' in m && m.title ? ` “${m.title}”` : '';
  return `${KIND[m.kind] ?? 'Scheda'}${title}`;
}

/** Length of the written text of a day: notes, study notes, diary. */
function textOf(d: DayEntry): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of [...d.modules, ...(d.looseNotes ?? [])]) {
    if (m.kind === 'study') out.set(m.id, plainOf(bodyOf(m)).length);
    else if (m.kind === 'note') out.set(m.id, m.text.length);
  }
  if (d.diary) out.set('diary', d.diary.text.length);
  return out;
}

/** What `next` lost compared with `prev`: removed items, and texts cut by a lot. */
export function lostBetween(prev: DayEntry, next: DayEntry): string[] {
  const now = itemsOf(next);
  const lost = [...itemsOf(prev)].filter(([id]) => !now.has(id)).map(([, label]) => label);
  const before = textOf(prev);
  const after = textOf(next);
  const names = itemsOf(prev);
  for (const [id, n] of before) {
    const m = after.get(id);
    if (m !== undefined && n - m > 120 && m < n * 0.6) lost.push(`Testo accorciato: ${names.get(id) ?? 'nota'}`);
  }
  return lost;
}

const latest = new Map<ISODate, Version>();
let primed: Promise<void> | null = null;

/** The newest version of every day, read once. */
async function lastOf(date: ISODate): Promise<Version | undefined> {
  primed ??= entries<string, Version>(db)
    .then((all) => {
      for (const [, v] of all) if (!latest.has(v.date) || latest.get(v.date)!.at < v.at) latest.set(v.date, v);
    })
    .catch(() => undefined);
  await primed;
  return latest.get(date);
}

/** Called for every day saved here or received from the cloud. */
export async function record(day: DayEntry, source: 'app' | 'cloud' | 'google' = 'app'): Promise<string[]> {
  try {
    const last = await lastOf(day.date);
    if (last && JSON.stringify(last.day) === JSON.stringify(day)) return [];
    const empty = !day.modules.length && !day.appointments.length && !day.todos.length && !day.looseNotes?.length && !day.shift && !day.guardia && !day.diary && !day.food;
    if (!last && empty) return [];
    const now = Date.now();
    const lost = last ? lostBetween(last.day, day) : [];
    const v: Version = { date: day.date, at: now, day: structuredClone(day), source, ...(lost.length ? { lost } : {}) };
    // Small edits a few minutes apart become one version; a removal never overwrites the one before it.
    if (last && !lost.length && !last.lost && now - last.at < MERGE_MS && last.source === source) {
      v.at = last.at;
    }
    await set(key(v.date, v.at), v, db);
    latest.set(day.date, v);
    return lost;
  } catch {
    /* history is a safety net: never block saving */
    return [];
  }
}

export async function versionsOf(date: ISODate): Promise<Version[]> {
  const all = await entries<string, Version>(db).catch(() => [] as [string, Version][]);
  return all
    .filter(([k]) => k.startsWith(`${date}|`))
    .map(([, v]) => v)
    .sort((a, b) => b.at - a.at);
}

/** Days with earlier versions, most recently changed first. */
export async function changedDays(): Promise<{ date: ISODate; versions: number; last: number; losses: number }[]> {
  const all = await entries<string, Version>(db).catch(() => [] as [string, Version][]);
  const by = new Map<ISODate, { date: ISODate; versions: number; last: number; losses: number }>();
  for (const [, v] of all) {
    const e = by.get(v.date) ?? { date: v.date, versions: 0, last: 0, losses: 0 };
    e.versions++;
    e.last = Math.max(e.last, v.at);
    if (v.lost?.length) e.losses++;
    by.set(v.date, e);
  }
  return [...by.values()].sort((a, b) => b.last - a.last);
}

/** Drops versions older than 60 days and keeps at most 40 per day. */
export async function pruneHistory(): Promise<void> {
  const all = await entries<string, Version>(db).catch(() => [] as [string, Version][]);
  const limit = Date.now() - KEEP_DAYS * 86_400_000;
  const by = new Map<ISODate, [string, Version][]>();
  for (const e of all) by.set(e[1].date, [...(by.get(e[1].date) ?? []), e]);
  for (const list of by.values()) {
    list.sort((a, b) => b[1].at - a[1].at);
    // The newest version of a day always stays, even if old.
    for (const [i, [k, v]] of list.entries()) if (i > 0 && (i >= PER_DAY || v.at < limit)) await del(k, db);
  }
}

export async function getVersion(date: ISODate, at: number): Promise<Version | undefined> {
  return get<Version>(key(date, at), db);
}
