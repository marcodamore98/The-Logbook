import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { bucket, db } from '../firebase';
import type { DayEntry, Settings } from '../types';
import type { Repo } from './repo';

// Layout: users/{uid}/meta/settings, users/{uid}/days/{YYYY-MM-DD}, Storage users/{uid}/photos/{id}.jpg
export function cloudRepo(uid: string): Repo {
  const days = () => collection(db(), 'users', uid, 'days');
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
      const path = `users/${uid}/photos/${id}.jpg`;
      const r = ref(bucket(), path);
      await uploadBytes(r, blob, { contentType: 'image/jpeg' });
      return { src: await getDownloadURL(r), path };
    },
    async deletePhoto(path) {
      if (!path) return;
      await deleteObject(ref(bucket(), path)).catch(() => undefined);
    },
  };
}
