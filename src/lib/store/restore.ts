import type { DayEntry, FoodEntry, MealId } from '../types';
import { itemsOf } from './history';

/** An item of an earlier version that today is missing or different. */
export interface DiffItem {
  id: string;
  label: string;
  kind: 'missing' | 'changed';
}

type Listed = { id: string };
const LISTS = ['modules', 'appointments', 'todos', 'looseNotes'] as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function find(d: DayEntry, id: string): unknown {
  if (id === 'shift' || id === 'guardia') return d[id];
  if (id === 'diary') return d.diary;
  for (const k of LISTS) {
    const x = (d[k] as Listed[] | undefined)?.find((i) => i.id === id);
    if (x) return x;
  }
  for (const list of Object.values(d.food?.meals ?? {})) {
    const x = list?.find((e) => e.id === id);
    if (x) return x;
  }
  return undefined;
}

const FIELD: Record<string, string> = {
  title: 'titolo', text: 'testo', start: 'orario', end: 'orario', startTime: 'orario', endTime: 'orario', startDate: 'date', endDate: 'date',
  place: 'luogo', location: 'luogo', destination: 'destinazione', notes: 'note', body: 'testo', cases: 'pazienti', durationMin: 'durata',
  exercises: 'esercizi', items: 'elementi', people: 'persone', ecm: 'ECM', type: 'tipo', area: 'area', tags: 'tag', attachments: 'allegati',
  colleagueIds: 'colleghi', shiftTypeId: 'tipo di turno', note: 'nota', done: 'spunta', grams: 'quantità', category: 'categoria',
  distanceM: 'distanza', durationSec: 'durata', photos: 'foto', certificate: 'attestato', program: 'programma', link: 'link', folderId: 'cartella',
};
const IGNORE = new Set(['gcalEventId', 'gcalSkip', 'editedAt', 'updatedAt', 'createdAt']);

/** In words, what is different today from the earlier version of an item: "prima 14:00–15:00, ora 15:30–16:30", or the fields that changed. */
export function describeChange(version: DayEntry, current: DayEntry, id: string): string {
  const a = find(version, id) as Record<string, unknown> | undefined;
  const b = find(current, id) as Record<string, unknown> | undefined;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return '';
  const span = (x: Record<string, unknown>) => (typeof x.start === 'string' && typeof x.end === 'string' ? `${x.start}–${x.end}` : typeof x.startTime === 'string' ? String(x.startTime) : '');
  const parts: string[] = [];
  if (span(a) && span(a) !== span(b)) parts.push(`orario di prima ${span(a)} (ora ${span(b) || '—'})`);
  if (typeof a.title === 'string' && a.title !== b.title) parts.push(`titolo di prima “${a.title || 'senza titolo'}”`);
  if (a.startDate !== b.startDate || a.endDate !== b.endDate) if (typeof a.startDate === 'string') parts.push(`date di prima ${a.startDate.split('-').reverse().slice(0, 2).join('/')}${a.endDate && a.endDate !== a.startDate ? `–${String(a.endDate).split('-').reverse().slice(0, 2).join('/')}` : ''}`);
  const shown = new Set(['start', 'end', 'startTime', 'title', 'startDate', 'endDate']);
  const other = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => !shown.has(k) && !IGNORE.has(k) && !same(a[k], b[k]))
    .map((k) => FIELD[k] ?? 'altri dettagli');
  const names = [...new Set(other)];
  if (names.length) parts.push(`cambiati: ${names.join(', ')}`);
  return parts.join(' · ');
}

export function diffWith(version: DayEntry, current: DayEntry): DiffItem[] {
  const now = itemsOf(current);
  const out: DiffItem[] = [];
  for (const [id, label] of itemsOf(version)) {
    if (!now.has(id)) out.push({ id, label, kind: 'missing' });
    else if (!same(find(version, id), find(current, id))) out.push({ id, label, kind: 'changed' });
  }
  return out;
}

/** Puts one item of an earlier version back into the day (in its place, or over today's copy). */
export function restoreItem(current: DayEntry, version: DayEntry, id: string): DayEntry {
  const d = structuredClone(current);
  // An item put back that is not in the day any more gets a new Google event (its old one was deleted);
  // one that replaces today's copy keeps today's event.
  const relink = <T extends { gcalEventId?: string }>(item: T, now?: { gcalEventId?: string }): T => {
    const out = { ...item };
    if (now) out.gcalEventId = now.gcalEventId;
    else delete out.gcalEventId;
    return out;
  };
  if (id === 'shift' || id === 'guardia') return { ...d, [id]: version[id] && relink(structuredClone(version[id]!), d[id]) };
  if (id === 'diary') return { ...d, diary: structuredClone(version.diary) };
  for (const k of LISTS) {
    const from = (version[k] as Listed[] | undefined) ?? [];
    const i = from.findIndex((x) => x.id === id);
    if (i < 0) continue;
    const now = ((d[k] as Listed[] | undefined) ?? []).find((x) => x.id === id) as { gcalEventId?: string } | undefined;
    const item = relink(structuredClone(from[i]) as Listed & { gcalEventId?: string }, now);
    // A note that went to the Cestino in the meantime comes out of it.
    const loose = (d.looseNotes ?? []).filter((x) => x.id !== id && x.id !== `${id}-cestino`);
    if (k !== 'looseNotes' && d.looseNotes) d.looseNotes = loose;
    const list = [...((d[k] as Listed[] | undefined) ?? [])];
    const j = list.findIndex((x) => x.id === id);
    if (j >= 0) list[j] = item;
    else list.splice(Math.min(i, list.length), 0, item);
    (d as unknown as Record<string, unknown>)[k] = list;
    return d;
  }
  for (const [meal, list] of Object.entries(version.food?.meals ?? {}) as [MealId, FoodEntry[]][]) {
    const i = list.findIndex((e) => e.id === id);
    if (i < 0) continue;
    const food = d.food ?? { meals: {} };
    const cur = [...(food.meals[meal] ?? [])];
    const j = cur.findIndex((e) => e.id === id);
    if (j >= 0) cur[j] = structuredClone(list[i]);
    else cur.splice(Math.min(i, cur.length), 0, structuredClone(list[i]));
    return { ...d, food: { ...food, meals: { ...food.meals, [meal]: cur } } };
  }
  return d;
}

/** Every item of the earlier version that is missing today. */
export function restoreMissing(current: DayEntry, version: DayEntry): DayEntry {
  return diffWith(version, current)
    .filter((x) => x.kind === 'missing')
    .reduce((d, x) => restoreItem(d, version, x.id), current);
}
