import type { DayEntry, FoodEntry, MealId } from '../types';

/**
 * Phone and computer each keep a copy of the day they are looking at, and a day is saved whole.
 * Before saving, the copy on the cloud (`remote`) is merged with this device's (`local`), knowing
 * the version this device started from (`base`): what the other device added stays, what it
 * deleted goes only if it was not changed here, and what was changed here wins.
 */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Lists of items with an id (cards, appointments, reminders, notes, foods). */
function mergeList<T extends { id: string }>(base: T[] | undefined, local: T[] | undefined, remote: T[] | undefined): T[] | undefined {
  if (!remote) return local;
  if (!local) return remote;
  const b = new Map((base ?? []).map((x) => [x.id, x]));
  const l = new Map(local.map((x) => [x.id, x]));
  const r = new Map(remote.map((x) => [x.id, x]));
  const out: T[] = [];
  for (const x of local) {
    const rx = r.get(x.id);
    const bx = b.get(x.id);
    if (!rx) {
      // Gone from the cloud: deleted on the other device. It goes only if it was not changed here.
      if (bx && same(bx, x)) continue;
      out.push(x);
      continue;
    }
    // Changed only on the other device: take that version.
    out.push(bx && same(bx, x) && !same(rx, x) ? rx : x);
  }
  // Added on the other device (never seen here) or kept there while deleted here only if changed there.
  remote.forEach((rx, i) => {
    if (l.has(rx.id)) return;
    const bx = b.get(rx.id);
    if (bx && same(bx, rx)) return; // deleted here, untouched there
    // Put it near where it was on the other device.
    const before = remote.slice(0, i).reverse().find((x) => out.some((o) => o.id === x.id));
    const at = before ? out.findIndex((o) => o.id === before.id) + 1 : 0;
    out.splice(at, 0, rx);
  });
  return out;
}

/** A single value (shift, mood, body, diary…): the side that changed it wins, this device first. */
function mergeValue<T>(base: T, local: T, remote: T): T {
  if (same(local, base)) return remote;
  return local;
}

export function mergeDay(base: DayEntry | undefined, local: DayEntry, remote: DayEntry | undefined): DayEntry {
  if (!remote || same(remote, base) || same(remote, local)) return local;
  const b = base ?? ({ date: local.date, todos: [], appointments: [], modules: [], updatedAt: 0 } as DayEntry);
  const out: DayEntry = { ...local };
  out.modules = mergeList(b.modules, local.modules, remote.modules) ?? [];
  out.appointments = mergeList(b.appointments, local.appointments, remote.appointments) ?? [];
  out.todos = mergeList(b.todos, local.todos, remote.todos) ?? [];
  out.looseNotes = mergeList(b.looseNotes, local.looseNotes, remote.looseNotes);
  for (const k of ['shift', 'guardia', 'mood', 'body', 'diary'] as const) (out as unknown as Record<string, unknown>)[k] = mergeValue<unknown>(b[k], local[k], remote[k]);
  if (local.food || remote.food) {
    const lf = local.food ?? { meals: {} };
    const rf = remote.food ?? { meals: {} };
    const bf = b.food ?? { meals: {} };
    const meals: Partial<Record<MealId, FoodEntry[]>> = {};
    for (const m of new Set([...Object.keys(lf.meals), ...Object.keys(rf.meals)]) as Set<MealId>) {
      const list = mergeList(bf.meals[m], lf.meals[m], rf.meals[m]);
      if (list) meals[m] = list;
    }
    out.food = { ...rf, ...lf, meals, waterMl: mergeValue(bf.waterMl, lf.waterMl, rf.waterMl), notes: mergeValue(bf.notes, lf.notes, rf.notes) };
  }
  const trash = [...new Set([...(local.gcalTrash ?? []), ...(remote.gcalTrash ?? [])])];
  out.gcalTrash = trash.length ? trash : undefined;
  out.updatedAt = Math.max(local.updatedAt, remote.updatedAt);
  return out;
}
