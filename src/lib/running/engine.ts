import { useSyncExternalStore } from 'react';
import { KIND_LABEL, haversine, recentPace, simplifyTrack } from './geo';
import type { RunLap, RunStep, TrackPoint } from '../types';

export type Phase = 'idle' | 'running' | 'paused' | 'done';

export interface RunState {
  phase: Phase;
  elapsed: number; // s, excluding pauses
  distance: number; // m
  stepIdx: number;
  stepLeft: number | null; // s or m remaining in the current step
  stepKind?: RunStep['kind'];
  position: [number, number] | null;
  accuracy: number | null;
  gps: 'off' | 'waiting' | 'ok' | 'denied';
  track: TrackPoint[];
  pace: number | null; // current pace, s/km over the last ~25 s
  laps: RunLap[];
}

let audio: AudioContext | null = null;

/** Must run inside a user gesture the first time so the browser allows sound. */
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    /* no audio */
  }
}

function tone(freq: number, ms: number, when = 0, vol = 0.25) {
  if (!audio) return;
  const t = audio.currentTime + when;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + ms / 1000 + 0.05);
}

function say(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.rate = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* no speech */
  }
}

export const signals = {
  /** Start of a step: rising double beep for effort, falling for easy. */
  start(kind: RunStep['kind']) {
    if (kind === 'work') {
      tone(880, 180);
      tone(1320, 320, 0.22);
      navigator.vibrate?.([250, 80, 250]);
    } else {
      tone(660, 200);
      tone(440, 320, 0.24);
      navigator.vibrate?.([450]);
    }
    say(kind === 'work' ? 'Via! Corri' : kind === 'rest' ? 'Recupero' : kind === 'cooldown' ? 'Defaticamento' : 'Riscaldamento');
  },
  tick() {
    tone(1000, 90, 0, 0.18);
  },
  finish() {
    tone(784, 160);
    tone(988, 160, 0.2);
    tone(1319, 420, 0.4);
    navigator.vibrate?.([200, 100, 200, 100, 500]);
    say('Allenamento completato. Ottimo lavoro');
  },
};

/** What the run was started with: it travels with the session so it survives a reload. */
export interface RunConfig {
  mode: 'continuous' | 'intervals' | 'treadmill';
  steps: RunStep[];
  useGps: boolean;
  planName: string;
  planId?: string;
}

const KEY = 'logbook.run.active';
const IDLE: RunState = { phase: 'idle', elapsed: 0, distance: 0, stepIdx: 0, stepLeft: null, position: null, accuracy: null, gps: 'off', track: [], pace: null, laps: [] };

/**
 * One run session for the whole app (not for a page): leaving "Corsa", going back or closing the
 * app does not stop it. Elapsed time comes from timestamps, so it stays right while the screen
 * sleeps or the app is closed; the session is saved on the phone at every step and comes back
 * when the app reopens (running, paused, or finished and waiting to be saved).
 */
const c = {
  phase: 'idle' as Phase,
  t0: 0, // wall clock of the last resume
  base: 0, // elapsed before the last resume
  dist: 0,
  last: null as [number, number] | null,
  track: [] as TrackPoint[],
  idx: 0,
  stepStartE: 0,
  stepStartD: 0,
  ticked: -1,
  config: null as RunConfig | null,
  watch: null as number | null,
  lock: null as any,
  gps: 'off' as RunState['gps'],
  pos: null as [number, number] | null,
  acc: null as number | null,
  laps: [] as RunLap[],
};
let snapshot: RunState = IDLE;
const listeners = new Set<() => void>();
let timer: number | null = null;
let savedAt = 0;

const steps = () => c.config?.steps ?? [];
const elapsedNow = () => (c.phase === 'running' ? c.base + (Date.now() - c.t0) / 1000 : c.base);

function publish() {
  const e = elapsedNow();
  const s = steps()[c.idx];
  let left: number | null = null;
  if (s && c.phase !== 'idle') left = s.by === 'time' ? Math.max(0, s.value - (e - c.stepStartE)) : Math.max(0, s.value - (c.dist - c.stepStartD));
  snapshot = { phase: c.phase, elapsed: e, distance: c.dist, stepIdx: c.idx, stepLeft: left, stepKind: s?.kind, position: c.pos, accuracy: c.acc, gps: c.gps, track: c.track, pace: c.phase === 'running' ? recentPace(c.track, e) : null, laps: c.laps };
  listeners.forEach((f) => f());
}

/** Saved on the phone: what is needed to carry on after a reload or after closing the app. */
function persist() {
  savedAt = Date.now();
  try {
    if (c.phase === 'idle') localStorage.removeItem(KEY);
    else {
      const { phase, t0, base, dist, last, track, idx, stepStartE, stepStartD, config, laps } = c;
      localStorage.setItem(KEY, JSON.stringify({ phase, t0, base, dist, last, track, idx, stepStartE, stepStartD, config, laps }));
    }
  } catch {
    /* storage full or blocked: the run goes on in memory */
  }
}

function ensureTimer() {
  if (timer !== null) return;
  timer = window.setInterval(() => {
    if (c.phase === 'running') {
      advance();
      if (Date.now() - savedAt > 5000) persist();
    }
    publish();
    if (c.phase === 'idle' && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }, 250);
}

function advance() {
  // Catch up if several steps ended while the screen was asleep or the app was closed.
  for (let guard = 0; guard < 200; guard++) {
    const s = steps()[c.idx];
    if (!s) return;
    const e = elapsedNow();
    const done = s.by === 'time' ? e - c.stepStartE >= s.value : c.dist - c.stepStartD >= s.value;
    if (!done) {
      if (s.by === 'time') {
        const left = Math.ceil(s.value - (e - c.stepStartE));
        if (left <= 3 && left >= 1 && c.ticked !== left + c.idx * 1000) {
          c.ticked = left + c.idx * 1000;
          signals.tick();
        }
      }
      return;
    }
    c.laps.push({ kind: s.kind, by: s.by, value: s.value, seconds: Math.round(s.by === 'time' ? s.value : e - c.stepStartE), meters: Math.round(c.dist - c.stepStartD), kmh: s.kmh, incline: s.incline, paceSec: s.paceSec });
    c.idx++;
    c.stepStartE = s.by === 'time' ? c.stepStartE + s.value : e;
    c.stepStartD = c.dist;
    if (c.idx >= steps().length) {
      // The last step ended (perhaps while the app was closed): the run ends at its planned time.
      c.phase = 'done';
      c.base = Math.min(e, c.stepStartE);
      signals.finish();
      stopGps();
      persist();
      return;
    }
    signals.start(steps()[c.idx].kind);
    persist();
  }
}

function onPos(p: GeolocationPosition) {
  const pt: [number, number] = [p.coords.latitude, p.coords.longitude];
  c.pos = pt;
  c.acc = p.coords.accuracy;
  c.gps = 'ok';
  if (c.phase !== 'running') return;
  if (p.coords.accuracy > 40) return; // too imprecise to count
  if (c.last) {
    const d = haversine(c.last, pt);
    if (d < 3 || d > 80) return; // jitter, or a jump
    c.dist += d;
  }
  c.last = pt;
  c.track.push([Math.round(pt[0] * 1e5) / 1e5, Math.round(pt[1] * 1e5) / 1e5, Math.round(elapsedNow())]);
}

function stopGps() {
  if (c.watch !== null) navigator.geolocation.clearWatch(c.watch);
  c.watch = null;
  c.lock?.release?.().catch?.(() => undefined);
  c.lock = null;
}

function startGps(force = false) {
  if ((!force && !c.config?.useGps) || c.watch !== null) return;
  if (!('geolocation' in navigator)) {
    c.gps = 'denied';
    return;
  }
  c.gps = 'waiting';
  c.watch = navigator.geolocation.watchPosition(onPos, () => (c.gps = 'denied'), { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
}

async function keepAwake() {
  try {
    c.lock = await (navigator as any).wakeLock?.request('screen');
  } catch {
    /* not supported or refused */
  }
}

export const runSession = {
  get config() {
    return c.config;
  },
  start(config: RunConfig) {
    unlockAudio();
    stopGps();
    Object.assign(c, { config, phase: 'running', t0: Date.now(), base: 0, dist: 0, last: null, track: [], laps: [], idx: 0, stepStartE: 0, stepStartD: 0, ticked: -1 });
    startGps();
    void keepAwake();
    if (config.steps.length) signals.start(config.steps[0].kind);
    else tone(880, 200);
    persist();
    ensureTimer();
    publish();
  },
  pause() {
    if (c.phase !== 'running') return;
    c.base = elapsedNow();
    c.phase = 'paused';
    c.last = null;
    persist();
    publish();
  },
  resume() {
    if (c.phase !== 'paused') return;
    c.t0 = Date.now();
    c.phase = 'running';
    void keepAwake();
    persist();
    ensureTimer();
    publish();
  },
  stop() {
    c.base = elapsedNow();
    c.phase = 'done';
    stopGps();
    persist();
    publish();
  },
  /** After saving or discarding: the session is gone (from the phone too). */
  reset() {
    stopGps();
    Object.assign(c, { phase: 'idle', base: 0, dist: 0, last: null, track: [], laps: [], idx: 0, config: null });
    persist();
    publish();
  },
  /** Skip to the next step by hand. */
  skip() {
    const s = steps()[c.idx];
    if (!s || c.phase !== 'running') return;
    if (s.by === 'time') c.stepStartE = elapsedNow() - s.value;
    else c.stepStartD = c.dist - s.value;
    advance();
    publish();
  },
  /** Show the user's position before starting. */
  locate() {
    startGps(true);
  },
  finalTrack: () => simplifyTrack(c.track),
  rawTrack: () => c.track,
};

/** Called once when the app opens: a run left running, paused or unsaved comes back. */
export function restoreRun() {
  if (c.phase !== 'idle') return;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved?.phase || saved.phase === 'idle' || !saved.config) return;
    Object.assign(c, saved, { ticked: -1, watch: null, lock: null });
    if ((c.phase as Phase) === 'running') {
      startGps();
      void keepAwake();
      advance();
    }
    ensureTimer();
    publish();
  } catch {
    /* unreadable: start clean */
  }
}

if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && c.phase === 'running') void keepAwake();
    // Saved when the app goes to the background: it may be closed from there.
    if (document.visibilityState === 'hidden' && c.phase !== 'idle') persist();
  });

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

/** The run session, from any page. */
export function useRunSession() {
  const state = useSyncExternalStore(subscribe, () => snapshot);
  return { state, ...runSession, KIND_LABEL };
}
