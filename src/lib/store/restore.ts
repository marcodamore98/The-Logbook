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
