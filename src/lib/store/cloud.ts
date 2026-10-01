import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { DayEntry, Settings } from '../types';
import { blobToDataURL, type Repo } from './repo';

// Layout: users/{uid}/meta/settings, users/{uid}/days/{YYYY-MM-DD}, users/{uid}/photos/{id}.
// Photos live in Firestore (compressed JPEG data URLs, ~350 KB each, Firestore max 1 MiB) instead of
// Cloud Storage, so the project stays on the free Spark plan.
export function cloudRepo(uid: string): Repo {
  const days = () => collection(db(), 'users', uid, 'days');
  const photo = (id: string) => doc(db(), 'users', uid, 'photos', id);
  const cache = new Map<string, string>();
  return {
    mode: 'cloud',
    async getSettings() {
      const snap = await getDoc(doc(db(), 'users', uid, 'meta', 'settings'));
      return snap.exists() ? (snap.data() as Settings) : null;
    },
    saveSettings: (s) => setDoc(doc(db(), 'users', uid, 'meta', 'settings'), s),
    async getRange(from, to) {
      const snap = await getDocs(query(days(), where('date', '>=', from), where('date', '<=', to)));
      return snap.docs.map((d) => d.data() as DayEntry);
    },
    async getAll() {
      const snap = await getDocs(days());
      return snap.docs.map((d) => d.data() as DayEntry);
    },
    saveDay: (d) => setDoc(doc(days(), d.date), d),
    async uploadPhoto(id, blob) {
      const data = await blobToDataURL(blob);
      cache.set(id, data);
      // Not awaited: offline writes resolve only on server ack, the local cache already has it.
      setDoc(photo(id), { data, createdAt: Date.now() }).catch((e) => console.error('foto non salvata', e));
      return { src: `fs:${id}`, path: id };
    },
    async deletePhoto(path) {
      if (!path) return;
      cache.delete(path);
      await deleteDoc(photo(path)).catch(() => undefined);
    },
    async resolvePhoto(src) {
      if (!src.startsWith('fs:')) return src;
      const id = src.slice(3);
      if (!cache.has(id)) {
        const snap = await getDoc(photo(id));
        cache.set(id, snap.exists() ? String(snap.data().data) : '');
      }
      return cache.get(id)!;
    },
  };
}
