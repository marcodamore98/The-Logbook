import { createStore, entries, get, getMany, set } from 'idb-keyval';
import { rangeDays } from '../dates';
import type { DayEntry, Settings } from '../types';
import { blobToDataURL, type Repo } from './repo';

const db = createStore('the-logbook', 'kv');

export const localRepo: Repo = {
  mode: 'local',
  getSettings: () => get<Settings>('settings', db).then((s) => s ?? null),
  saveSettings: (s) => set('settings', s, db),
  async getRange(from, to) {
    const days = rangeDays(from, to);
    const found = await getMany<DayEntry | undefined>(days.map((d) => `day:${d}`), db);
    return found.filter((d): d is DayEntry => !!d);
  },
  async getAll() {
    const all = await entries<string, unknown>(db);
    return all.filter(([k]) => k.startsWith('day:')).map(([, v]) => v as DayEntry);
  },
  saveDay: (d) => set(`day:${d.date}`, d, db),
  async uploadPhoto(_id, blob) {
    return { src: await blobToDataURL(blob) };
  },
  async deletePhoto() {},
  resolvePhoto: async (src) => src,
};
