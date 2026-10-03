import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { restOver, tick, unlockAudio } from '../../lib/sound';

export interface RestState {
  /** Whole seconds left (rounded up), or null when no timer is running. */
  left: number | null;
  total: number;
  label?: string;
  /** Reached 0 and still shown for a few seconds. */
  done: boolean;
}

interface Timer {
  start(seconds: number, label?: string): void;
  add(seconds: number): void;
  stop(): void;
  state: RestState;
}

const Ctx = createContext<Timer>({ start: () => undefined, add: () => undefined, stop: () => undefined, state: { left: null, total: 0, done: false } });
export const useRestTimer = () => useContext(Ctx);

export const fmtRest = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Rest countdown. Time comes from a timestamp, so it stays right when the screen sleeps.
 * Ticks at 3-2-1 and a longer beep at 0; the banner then stays a few seconds as "finished".
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [end, setEnd] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [label, setLabel] = useState<string>();
  const [, force] = useState(0);
  const ticked = useRef(new Set<number>());
  const finished = useRef(false);
  const doneAt = useRef(0);

  const start = useCallback((seconds: number, l?: string) => {
    if (seconds <= 0) return;
    unlockAudio();
    ticked.current.clear();
    finished.current = false;
    setTotal(seconds);
    setLabel(l);
    setEnd(Date.now() + seconds * 1000);
  }, []);
  const add = useCallback((seconds: number) => {
    setEnd((e) => (e === null ? e : e + seconds * 1000));
    setTotal((t) => Math.max(1, t + seconds));
    ticked.current.clear();
    finished.current = false;
  }, []);
  const stop = useCallback(() => setEnd(null), []);

  useEffect(() => {
    if (end === null) return;
    const run = () => {
      const msLeft = end - Date.now();
      const left = Math.ceil(msLeft / 1000);
      if (left >= 1 && left <= 3 && !ticked.current.has(left)) {
        ticked.current.add(left);
        tick();
      }
      if (msLeft <= 0 && !finished.current) {
        finished.current = true;
        doneAt.current = Date.now();
        restOver();
      }
      if (finished.current && Date.now() - doneAt.current > 6000) setEnd(null);
      force((n) => n + 1);
    };
    run();
    const id = window.setInterval(run, 200);
    const vis = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [end]);

  const msLeft = end === null ? null : end - Date.now();
  const left = msLeft === null ? null : Math.max(0, Math.ceil(msLeft / 1000));
  const state: RestState = { left, total, label, done: msLeft !== null && msLeft <= 0 };
  const value = useMemo<Timer>(() => ({ start, add, stop, state }), [start, add, stop, left, total, label]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
