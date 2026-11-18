import { useCallback, useEffect, useRef } from 'react';
import { readConfig } from '../lib/garmin/client';
import { syncGarmin } from '../lib/garmin/sync';
import { useStore } from '../lib/store/StoreContext';

/** A function that reads Garmin now (with the latest store, even if called later). */
export function useGarminSync() {
  const store = useStore();
  const ref = useRef(store);
  ref.current = store;
  return useCallback((opts?: { fromDays?: number }) => syncGarmin(() => ref.current, opts), []);
}

const EVERY = 10 * 60e3;

/** Reads Garmin when the app opens and when it comes back on screen (at most every 10 minutes). */
export function GarminAutoSync() {
  const sync = useGarminSync();
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      const cfg = readConfig();
      if (!cfg || Date.now() - (cfg.lastSync ?? 0) < EVERY) return;
      sync().catch(() => {
        /* the error is shown in the Riepilogo and in Impostazioni */
      });
    };
    // A moment after opening, so the days on screen load first.
    const t = window.setTimeout(check, 2500);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', check);
    };
  }, [sync]);
  return null;
}
