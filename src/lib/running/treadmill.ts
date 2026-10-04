// Treadmill sessions: a list of series, each with a speed (km/h), an incline (%) and a
// duration, so the machine can be set series by series. Distance = speed × time.

import { uid } from '../../components/ui';
import type { RunLap, RunPlan, RunStep } from '../types';
import { fmtDuration } from './geo';

export const tStep = (sec: number, kmh: number, incline = 0): RunStep => ({ id: uid(), kind: 'work', by: 'time', value: sec, kmh, incline });

/** Speed of a series; the first treadmill sessions stored a pace instead. */
export const kmhOf = (s: { kmh?: number; paceSec?: number }) => s.kmh ?? (s.paceSec ? 3600 / s.paceSec : 0);

const num = (n: number, d = 1) => n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtKmh = (kmh: number) => (kmh ? num(kmh) : '–');
export const fmtIncline = (n?: number) => (n ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 1 });
/** Pace shown next to the speed: 10 km/h → "6:00". */
export const paceFromKmh = (kmh: number) => {
  if (!kmh) return '–';
  const sec = Math.round(3600 / kmh);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

/** "6,0 km/h · 8% · 2:30" */
export const treadmillSettings = (s: RunStep) => `${fmtKmh(kmhOf(s))} km/h · ${fmtIncline(s.incline)}% · ${fmtDuration(s.value)}`;

const metersFor = (sec: number, kmh: number) => (kmh * sec) / 3.6;

/** Estimated distance of a whole session, in metres. */
export const planMeters = (steps: RunStep[]) => steps.reduce((n, s) => n + metersFor(s.value, kmhOf(s)), 0);

/** Estimated distance so far: completed series plus the part of the current one. */
export function doneMeters(laps: RunLap[], cur: RunStep | undefined, stepLeft: number | null) {
  const done = laps.reduce((n, l) => n + metersFor(l.seconds, kmhOf(l)), 0);
  return done + (cur && stepLeft !== null ? metersFor(Math.max(0, cur.value - stepLeft), kmhOf(cur)) : 0);
}

export const lapMeters = (l: RunLap) => Math.round(metersFor(l.seconds, kmhOf(l)));

export const treadmillPresets = (): RunPlan[] => [
  { id: 't-12-3-30', name: 'Camminata in salita 12% · 30′', treadmill: true, steps: [tStep(300, 4.5, 3), tStep(1800, 5, 12), tStep(300, 4.5, 0)] },
  {
    id: 't-salite',
    name: 'Salite progressive (2 → 10%)',
    treadmill: true,
    steps: [tStep(300, 5, 1), ...[2, 4, 6, 8, 10, 8, 6, 4, 2].map((inc) => tStep(180, 5.5, inc)), tStep(300, 5, 0)],
  },
  {
    id: 't-alterna',
    name: 'Corsa e camminata 5 × (2′ + 2′)',
    treadmill: true,
    steps: [tStep(300, 6, 1), ...Array.from({ length: 5 }, () => [tStep(120, 10, 1), tStep(120, 6, 1)]).flat(), tStep(300, 5.5, 0)],
  },
];
