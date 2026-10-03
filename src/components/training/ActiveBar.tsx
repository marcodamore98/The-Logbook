import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { today } from '../../lib/dates';
import { useStore } from '../../lib/store/StoreContext';
import { runningWorkout, workoutProgress } from '../../lib/training/analytics';
import { fmtRest, useRestTimer } from './RestTimer';

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Bar fixed at the very bottom of the screen. While a workout is running it shows where you
 * are (exercise, set, rest) and takes you back to it with one tap. The rest countdown lives
 * here too: tap it, or swipe it up, for a big stopwatch.
 */
export function ActiveBar() {
  const store = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const rest = useRestTimer();
  const [big, setBig] = useState(false);
  const [, tickNow] = useState(0);
  const touch = useRef<{ y: number; x: number } | null>(null);

  const date = today();
  const w = runningWorkout(store.day(date));
  const onWorkoutPage = loc.pathname.startsWith('/palestra/allenamento/');
  const showWorkout = !!w && !onWorkoutPage;
  const showRest = rest.state.left !== null;
  const visible = showWorkout || showRest;

  useEffect(() => {
    store.loadRange(date, date);
  }, [date]);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => tickNow((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  // Room for the bar at the end of the page.
  useEffect(() => {
    document.body.classList.toggle('has-bar', visible);
    return () => document.body.classList.remove('has-bar');
  }, [visible]);

  useEffect(() => {
    if (!showRest) setBig(false);
  }, [showRest]);

  if (!visible) return null;
  const p = w ? workoutProgress(w, store.settings.exercises) : null;
  const left = rest.state.left ?? 0;
  const pct = rest.state.total ? Math.max(0, Math.min(100, (left / rest.state.total) * 100)) : 0;
  const go = () => w && nav(`/palestra/allenamento/${date}/${w.id}`);

  const onTouchStart = (e: React.TouchEvent) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current;
    touch.current = null;
    if (t && showRest && t.y - e.changedTouches[0].clientY > 30 && Math.abs(e.changedTouches[0].clientX - t.x) < 60) setBig(true);
  };

  return (
    <>
      <div className={`active-bar${rest.state.done ? ' done' : ''}`} role="status" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {showRest && <div className="rest-bar" style={{ width: `${pct}%` }} />}
        {showWorkout && p ? (
          <button type="button" className="active-main" onClick={go} aria-label="Riprendi l'allenamento">
            <span className="active-title">{w!.title || 'Allenamento'} · {clock(Date.now() - w!.startedAt!)}</span>
            <span className="active-sub">
              {p.exerciseName ? `${p.exerciseName} · serie ${p.setNo}/${p.setCount}` : p.total ? 'Tutte le serie fatte' : 'Aggiungi i primi esercizi'}
            </span>
          </button>
        ) : (
          <button type="button" className="active-main" onClick={() => setBig(true)} aria-label="Apri il cronometro">
            <span className="active-title">{rest.state.done ? 'Recupero finito' : 'Recupero'}</span>
            <span className="active-sub">{rest.state.label ?? ''}</span>
          </button>
        )}
        {showRest ? (
          <button type="button" className="active-rest" onClick={() => setBig(true)} aria-label="Apri il cronometro">
            {fmtRest(left)}
            <span aria-hidden="true">⌃</span>
          </button>
        ) : (
          <span className="active-go" aria-hidden="true">
            Riprendi ›
          </span>
        )}
      </div>

      {big && showRest && (
        <div
          className="rest-big"
          role="dialog"
          aria-label="Cronometro di recupero"
          onTouchStart={onTouchStart}
          onTouchEnd={(e) => {
            const t = touch.current;
            touch.current = null;
            if (t && e.changedTouches[0].clientY - t.y > 60) setBig(false);
          }}
        >
          <button className="rest-big-close" onClick={() => setBig(false)} aria-label="Riduci">
            ⌄
          </button>
          <p className="rest-big-label">{rest.state.done ? 'Recupero finito' : `Recupero${rest.state.label ? ` · ${rest.state.label}` : ''}`}</p>
          <div className="rest-big-ring" style={{ ['--p' as string]: `${pct}%` }}>
            <span className="rest-big-time">{fmtRest(left)}</span>
          </div>
          <div className="rest-big-actions">
            <button className="btn-ghost" onClick={() => rest.add(-15)}>
              −15
            </button>
            <button className="btn-ghost" onClick={() => rest.add(15)}>
              +15
            </button>
          </div>
          <button className="btn rest-big-skip" onClick={() => rest.stop()}>
            Salta il recupero
          </button>
          {w && !onWorkoutPage && (
            <button className="btn-ghost" onClick={() => { setBig(false); go(); }}>
              Torna all’allenamento
            </button>
          )}
        </div>
      )}
    </>
  );
}
