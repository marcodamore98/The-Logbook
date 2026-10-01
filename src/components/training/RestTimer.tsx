import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { GlyphClose } from '../icons';

interface Timer {
  start(seconds: number, label?: string): void;
}

const Ctx = createContext<Timer>({ start: () => undefined });
export const useRestTimer = () => useContext(Ctx);

function beep() {
  try {
    const ac = new AudioContext();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.6);
  } catch {
    /* audio not available */
  }
  navigator.vibrate?.([200, 100, 200]);
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Countdown shown as a floating pill after each completed set. */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [end, setEnd] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [label, setLabel] = useState<string>();
  const [, tick] = useState(0);
  const fired = useRef(false);

  const start = useCallback((seconds: number, l?: string) => {
    if (seconds <= 0) return;
    fired.current = false;
    setTotal(seconds);
    setLabel(l);
    setEnd(Date.now() + seconds * 1000);
  }, []);

  useEffect(() => {
    if (end === null) return;
    const id = window.setInterval(() => {
      tick((n) => n + 1);
      if (Date.now() >= end && !fired.current) {
        fired.current = true;
        beep();
        window.setTimeout(() => setEnd((e) => (e === end ? null : e)), 4000);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [end]);

  const left = end === null ? 0 : Math.max(0, Math.ceil((end - Date.now()) / 1000));
  return (
    <Ctx.Provider value={{ start }}>
      {children}
      {end !== null && (
        <div className={`rest-timer${left === 0 ? ' done' : ''}`} role="timer" aria-live="polite">
          <div className="rest-bar" style={{ width: `${total ? (left / total) * 100 : 0}%` }} />
          <span className="rest-label">{left === 0 ? 'Recupero finito' : label ? `Recupero · ${label}` : 'Recupero'}</span>
          <strong className="rest-time">{fmt(left)}</strong>
          <button className="btn-ghost small" onClick={() => setEnd((e) => (e ? e - 15000 : e))}>
            −15
          </button>
          <button className="btn-ghost small" onClick={() => setEnd((e) => (e ? e + 15000 : e))}>
            +15
          </button>
          <button className="icon-btn small" aria-label="Salta recupero" onClick={() => setEnd(null)}>
            <GlyphClose />
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}
