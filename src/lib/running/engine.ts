import { useCallback, useEffect, useRef, useState } from 'react';
import { KIND_LABEL, haversine, simplifyTrack } from './geo';
import type { RunStep, TrackPoint } from '../types';

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

/**
 * Run session engine: elapsed time from timestamps (so it stays right if the screen
 * sleeps), GPS distance, and interval steps with sound/vibration/voice signals.
 */
export function useRunSession(steps: RunStep[] | undefined, useGps: boolean) {
  const [state, setState] = useState<RunState>({ phase: 'idle', elapsed: 0, distance: 0, stepIdx: 0, stepLeft: null, position: null, accuracy: null, gps: 'off', track: [] });
  const r = useRef({
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
    steps: steps ?? [],
    watch: null as number | null,
    lock: null as any,
    gps: 'off' as RunState['gps'],
    pos: null as [number, number] | null,
    acc: null as number | null,
  });
  r.current.steps = steps ?? [];

  const elapsedNow = () => (r.current.phase === 'running' ? r.current.base + (Date.now() - r.current.t0) / 1000 : r.current.base);

  const publish = useCallback(() => {
    const c = r.current;
    const e = elapsedNow();
    const s = c.steps[c.idx];
    let left: number | null = null;
    if (s && c.phase !== 'idle') left = s.by === 'time' ? Math.max(0, s.value - (e - c.stepStartE)) : Math.max(0, s.value - (c.dist - c.stepStartD));
    setState({ phase: c.phase, elapsed: e, distance: c.dist, stepIdx: c.idx, stepLeft: left, stepKind: s?.kind, position: c.pos, accuracy: c.acc, gps: c.gps, track: c.track });
  }, []);

  const advance = useCallback(() => {
    const c = r.current;
    // Catch up if several steps ended while the screen was asleep.
    for (let guard = 0; guard < 50; guard++) {
      const s = c.steps[c.idx];
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
      c.idx++;
      c.stepStartE = s.by === 'time' ? c.stepStartE + s.value : e;
      c.stepStartD = c.dist;
      if (c.idx >= c.steps.length) {
        c.phase = 'done';
        c.base = e;
        signals.finish();
        stopGps();
        return;
      }
      signals.start(c.steps[c.idx].kind);
    }
  }, []);

  const onPos = useCallback((p: GeolocationPosition) => {
    const c = r.current;
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
  }, []);

  const stopGps = () => {
    const c = r.current;
    if (c.watch !== null) navigator.geolocation.clearWatch(c.watch);
    c.watch = null;
    c.lock?.release?.().catch?.(() => undefined);
    c.lock = null;
  };

  const startGps = useCallback(() => {
    const c = r.current;
    if (!useGps || c.watch !== null) return;
    if (!('geolocation' in navigator)) {
      c.gps = 'denied';
      return;
    }
    c.gps = 'waiting';
    c.watch = navigator.geolocation.watchPosition(onPos, () => (c.gps = 'denied'), { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  }, [useGps, onPos]);

  const keepAwake = async () => {
    try {
      r.current.lock = await (navigator as any).wakeLock?.request('screen');
    } catch {
      /* not supported or refused */
    }
  };

  const start = () => {
    unlockAudio();
    const c = r.current;
    Object.assign(c, { phase: 'running', t0: Date.now(), base: 0, dist: 0, last: null, track: [], idx: 0, stepStartE: 0, stepStartD: 0, ticked: -1 });
    startGps();
    void keepAwake();
    if (c.steps.length) signals.start(c.steps[0].kind);
    else tone(880, 200);
    publish();
  };
  const pause = () => {
    const c = r.current;
    if (c.phase !== 'running') return;
    c.base = elapsedNow();
    c.phase = 'paused';
    c.last = null;
    publish();
  };
  const resume = () => {
    const c = r.current;
    if (c.phase !== 'paused') return;
    c.t0 = Date.now();
    c.phase = 'running';
    void keepAwake();
    publish();
  };
  const stop = () => {
    const c = r.current;
    c.base = elapsedNow();
    c.phase = 'done';
    stopGps();
    publish();
  };
  const reset = () => {
    const c = r.current;
    stopGps();
    Object.assign(c, { phase: 'idle', base: 0, dist: 0, last: null, track: [], idx: 0, pos: c.pos });
    publish();
  };
  /** Skip to the next step by hand. */
  const skip = () => {
    const c = r.current;
    const s = c.steps[c.idx];
    if (!s || c.phase !== 'running') return;
    if (s.by === 'time') c.stepStartE = elapsedNow() - s.value;
    else c.stepStartD = c.dist - s.value;
    advance();
    publish();
  };

  // Show the user's position on the map before starting.
  const locate = useCallback(() => {
    startGps();
  }, [startGps]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (r.current.phase === 'running') advance();
      publish();
    }, 250);
    const vis = () => {
      if (document.visibilityState === 'visible' && r.current.phase === 'running') void keepAwake();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [advance, publish]);

  useEffect(() => () => stopGps(), []);

  const finalTrack = () => simplifyTrack(r.current.track);
  return { state, start, pause, resume, stop, reset, skip, locate, finalTrack, KIND_LABEL };
}
