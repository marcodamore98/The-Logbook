// Treadmill sessions: every step is by time, with a pace (min/km) and an incline (%),
// so the machine can be set step by step. Distance is estimated from pace × time.

import { uid } from '../../components/ui';
import type { RunLap, RunPlan, RunStep } from '../types';
import { fmtPaceSec } from './geo';

export const tStep = (kind: RunStep['kind'], sec: number, paceSec: number, incline = 0): RunStep => ({ id: uid(), kind, by: 'time', value: sec, paceSec, incline });

/** km/h shown by the treadmill for a pace in seconds per km, e.g. 330 → "10,9". */
export const fmtKmh = (paceSec?: number) => (paceSec ? (3600 / paceSec).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–');
export const fmtIncline = (n?: number) => (n ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 1 });

/** "5:30 /km · 10,9 km/h · 2%" */
export const treadmillSettings = (s: { paceSec?: number; incline?: number }) => `${fmtPaceSec(s.paceSec)} /km · ${fmtKmh(s.paceSec)} km/h · ${fmtIncline(s.incline)}%`;

const metersFor = (sec: number, paceSec?: number) => (paceSec ? (sec * 1000) / paceSec : 0);

/** Estimated distance of a whole plan, in metres. */
export const planMeters = (steps: RunStep[]) => steps.reduce((n, s) => n + metersFor(s.value, s.paceSec), 0);

/** Estimated distance so far: completed steps plus the part of the current one. */
export function doneMeters(laps: RunLap[], cur: RunStep | undefined, stepLeft: number | null) {
  const done = laps.reduce((n, l) => n + metersFor(l.seconds, l.paceSec), 0);
  return done + (cur && stepLeft !== null ? metersFor(Math.max(0, cur.value - stepLeft), cur.paceSec) : 0);
}

/** warm-up, n × (fast / easy) at the same incline, cool-down. The last recovery is dropped. */
export function treadmillRepeats(
  n: number,
  work: { sec: number; pace: number },
  rest: { sec: number; pace: number },
  incline: number,
  warm: { sec: number; pace: number },
  cool: { sec: number; pace: number },
): RunStep[] {
  const steps: RunStep[] = [];
  if (warm.sec) steps.push(tStep('warmup', warm.sec, warm.pace, Math.min(incline, 1)));
  for (let i = 0; i < n; i++) {
    steps.push(tStep('work', work.sec, work.pace, incline));
    if (i < n - 1) steps.push(tStep('rest', rest.sec, rest.pace, incline));
  }
  if (cool.sec) steps.push(tStep('cooldown', cool.sec, cool.pace, 0));
  return steps;
}

export const treadmillPresets = (): RunPlan[] => [
  {
    id: 't-12-3-30',
    name: 'Camminata in salita 12% · 30′',
    treadmill: true,
    steps: [tStep('warmup', 300, 750, 2), tStep('work', 1800, 750, 12), tStep('cooldown', 300, 800, 0)],
  },
  {
    id: 't-6x2',
    name: 'Intervalli 6 × 2′',
    treadmill: true,
    steps: treadmillRepeats(6, { sec: 120, pace: 330 }, { sec: 120, pace: 450 }, 1, { sec: 300, pace: 450 }, { sec: 300, pace: 500 }),
  },
  {
    id: 't-salite',
    name: 'Salite progressive 2-4-6-8%',
    treadmill: true,
    steps: [
      tStep('warmup', 300, 450, 1),
      ...[2, 4, 6, 8, 6, 4, 2].map((inc) => tStep('work', 180, 420, inc)),
      tStep('cooldown', 300, 500, 0),
    ],
  },
];
