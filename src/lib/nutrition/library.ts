// Larger food library published next to the app (public/foods/*.json).
// The whole library is downloaded the first time the app is online and kept on the
// device (IndexedDB), so searching works offline from then on. A newer version on the
// site replaces the saved one on the next start.

import { useSyncExternalStore } from 'react';
import { createStore, get, set } from 'idb-keyval';
import type { Food } from '../types';

const PACKS = ['piatti-it'] as const;

interface Pack {
  version: number;
  source: string;
  columns: string[];
  rows: (string | number | null)[][];
}

const db = createStore('the-logbook-foods', 'packs');
let foods: Food[] = [];
const packs: Record<string, Pack | undefined> = {};
const listeners = new Set<() => void>();

function publish() {
  foods = PACKS.flatMap((k) => {
    const p = packs[k];
    if (!p) return [];
    const at = (name: string) => p.columns.indexOf(name);
    const col = Object.fromEntries(['id', 'name', 'category', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'portionG', 'portionName'].map((c) => [c, at(c)]));
    const num = (r: Pack['rows'][number], c: string) => (col[c] >= 0 && typeof r[col[c]] === 'number' ? (r[col[c]] as number) : undefined);
    const str = (r: Pack['rows'][number], c: string) => (col[c] >= 0 && typeof r[col[c]] === 'string' ? (r[col[c]] as string) : undefined);
    return p.rows.map(
      (r): Food => ({
        id: `lib-${k}-${str(r, 'id')}`,
        name: str(r, 'name') ?? '',
        category: str(r, 'category'),
        kcal: num(r, 'kcal') ?? 0,
        protein: num(r, 'protein') ?? 0,
        carbs: num(r, 'carbs') ?? 0,
        fat: num(r, 'fat') ?? 0,
        fiber: num(r, 'fiber'),
        portionG: num(r, 'portionG'),
        portionName: str(r, 'portionName'),
        source: 'library',
      }),
    );
  });
  listeners.forEach((l) => l());
}

let started = false;

/** Load the saved library, then refresh it from the site when online. */
export async function loadLibrary() {
  if (!started) {
    started = true;
    for (const k of PACKS) packs[k] = await get<Pack>(k, db).catch(() => undefined);
    publish();
    window.addEventListener('online', () => void refresh());
  }
  await refresh();
}

async function refresh() {
  if (!navigator.onLine) return;
  let changed = false;
  for (const k of PACKS) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}foods/${k}.json`, { cache: 'no-cache' });
      if (!res.ok) continue;
      const p = (await res.json()) as Pack;
      if (!Array.isArray(p.rows) || p.version === packs[k]?.version) continue;
      packs[k] = p;
      changed = true;
      await set(k, p, db).catch(() => undefined);
    } catch {
      // offline or the site is unreachable: keep the saved copy
    }
  }
  if (changed) publish();
}

/** Foods of the downloaded library (empty until the first download). */
export function useLibrary(): Food[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => foods,
  );
}
