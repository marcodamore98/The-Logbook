import type { RunStep, TrackPoint } from '../types';

export const KIND_LABEL: Record<RunStep['kind'], string> = {
  warmup: 'Riscaldamento',
  work: 'Corsa veloce',
  rest: 'Recupero',
  cooldown: 'Defaticamento',
};

export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const pathLength = (pts: [number, number][]) => pts.reduce((n, p, i) => (i ? n + haversine(pts[i - 1], p) : 0), 0);

export const fmtDuration = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

export const fmtKm = (m: number) => (m / 1000).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Pace as min:ss per km. */
export function fmtPace(distanceM: number, sec: number): string {
  if (distanceM < 20 || sec <= 0) return '–';
  const p = sec / (distanceM / 1000);
  return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}`;
}

export function stepLabel(s: RunStep): string {
  const v = s.by === 'time' ? (s.value >= 60 && s.value % 60 === 0 ? `${s.value / 60}′` : s.value >= 60 ? fmtDuration(s.value) : `${s.value}″`) : s.value >= 1000 ? `${s.value / 1000} km` : `${s.value} m`;
  return `${KIND_LABEL[s.kind]} ${v}`;
}

/** Compact one-line description: groups consecutive work/rest pairs ("6× 400 m / 90″"). */
export function planSummary(steps: RunStep[]): string {
  const out: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.kind === 'work' && steps[i + 1]?.kind === 'rest') {
      let n = 1;
      while (steps[i + 2 * n]?.kind === 'work' && steps[i + 2 * n].by === s.by && steps[i + 2 * n].value === s.value && steps[i + 2 * n + 1]?.kind === 'rest' && steps[i + 2 * n + 1].value === steps[i + 1].value) n++;
      out.push(`${n}× ${stepLabel(s).replace('Corsa veloce ', '')} / ${stepLabel(steps[i + 1]).replace('Recupero ', '')}`);
      i += 2 * n - 1;
    } else out.push(stepLabel(s));
  }
  return out.join(' · ');
}

/** Keeps the track light enough to store: drops points closer than ~8 m, caps at max points. */
export function simplifyTrack(track: TrackPoint[], max = 700): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (const p of track) {
    const last = out[out.length - 1];
    if (!last || haversine([last[0], last[1]], [p[0], p[1]]) >= 8) out.push(p);
  }
  if (out.length <= max) return out;
  const step = out.length / max;
  return Array.from({ length: max }, (_, i) => out[Math.floor(i * step)]);
}

/** Time of each completed km, from a track. */
export function kmSplits(track: TrackPoint[]): number[] {
  const res: number[] = [];
  let dist = 0;
  let lastT = 0;
  let next = 1000;
  for (let i = 1; i < track.length; i++) {
    dist += haversine([track[i - 1][0], track[i - 1][1]], [track[i][0], track[i][1]]);
    while (dist >= next) {
      res.push(track[i][2] - lastT);
      lastT = track[i][2];
      next += 1000;
    }
  }
  return res;
}

export const gmapsDirections = (lat: number, lon: number, from?: [number, number]) =>
  `https://www.google.com/maps/dir/?api=1${from ? `&origin=${from[0]},${from[1]}` : ''}&destination=${lat},${lon}&travelmode=walking`;
export const gmapsSearch = (q: string, lat: number, lon: number) => `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${lat},${lon},14z`;
