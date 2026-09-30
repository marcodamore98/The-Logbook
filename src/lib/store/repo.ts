import type { DayEntry, ISODate, Settings } from '../types';

/** Persistence backend. `local` keeps everything in IndexedDB; `cloud` uses Firestore + Storage. */
export interface Repo {
  mode: 'local' | 'cloud';
  getSettings(): Promise<Settings | null>;
  saveSettings(s: Settings): Promise<void>;
  getRange(from: ISODate, to: ISODate): Promise<DayEntry[]>;
  getAll(): Promise<DayEntry[]>;
  saveDay(d: DayEntry): Promise<void>;
  /** Stores a JPEG blob and returns what the PhotoItem should keep. */
  uploadPhoto(id: string, blob: Blob): Promise<{ src: string; path?: string }>;
  deletePhoto(path: string | undefined): Promise<void>;
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
