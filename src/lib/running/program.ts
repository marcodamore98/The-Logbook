// Treadmill programmes: reading one pasted as text (e.g. from a chat or a table) and making it
// a little harder or easier after each workout, from the judgement given at the end.

import { uid } from '../../components/ui';
import type { RunStep } from '../types';
import { fmtDuration } from './geo';
import { fmtIncline, fmtKmh, kmhOf } from './treadmill';

export const DEFAULT_MAX_INCLINE = 15;
const MAX_KMH = 20;
const MIN_KMH = 2;
/** One level harder: +1% of incline in the hard phases, or +0,3 km/h once the incline is at the top. */
const INCLINE_STEP = 1;
const KMH_STEP = 0.3;

// ---- Reading a programme from text ----

export interface ParsedProgram {
  name: string;
  steps: RunStep[];
  notes?: string;
  warnings: string[];
}

const NUM = String.raw`\d{1,3}(?:[:.]\d{2})?`;
/** "0:00-2:00", "6-8'", "min 2–4", "da 4:00 a 6:00" at the start of a cell. */
const RANGE = new RegExp(String.raw`^\s*(?:min(?:uti|uto)?\.?\s*|da\s+)?(${NUM})\s*['′’]?\s*(?:-|–|—|\ba\b)\s*(${NUM})\s*(?:['′’]|min(?:uti)?\b)?`, 'i');
/** "2 min", "2′", "90 s" at the start of a cell: a duration on its own. */
const SPAN = /^\s*(\d{1,3}(?:[.,]\d+)?)\s*(min(?:uti|uto)?\b|['′’]|s(?:ec(?:ondi)?)?\b|″|")/i;
const SPEED = /(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/?\s*h/i;
const INCLINE = /(\d{1,2}(?:[.,]\d)?)\s*%/;
const HEADER = /^(minut[oi]|min|tempo|durata|velocit[aà]|km\/h|inclinazione|pendenza|%|fase|fasi|note|serie)$/i;

const n = (s: string) => Number(s.replace(',', '.'));
/** "2:30" → 150 s, "2.30" → 150 s, "2" → 120 s (minutes). */
const secOf = (s: string) => {
  const m = s.match(/^(\d+)[:.](\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number(s) * 60;
};

function kindOf(label: string | undefined, i: number, count: number): RunStep['kind'] {
  const l = (label ?? '').toLowerCase();
  if (/riscald|warm/.test(l)) return 'warmup';
  if (/defatic|cool|raffredd/.test(l) || (i === count - 1 && /recuper/.test(l))) return 'cooldown';
  if (/recuper|pausa|riposo/.test(l)) return 'rest';
  return 'work';
}

/**
 * Reads a programme written as a table or as lines: each phase starts with its minutes
 * ("0:00-2:00", "2 min") followed, in the same cell or the next ones, by the speed ("4,5 km/h"),
 * the incline ("5%") and its name ("Riscaldamento"). A short line before the phases is the name;
 * the lines after them are kept as notes (questions are left out).
 */
export function parseProgram(text: string): ParsedProgram {
  const cells = text
    .replace(/\r/g, '')
    .split('\n')
    .flatMap((line) => line.split(/\t|\|/))
    .map((c) => c.trim())
    .filter((c) => c && !/^[-:\s]+$/.test(c)); // markdown table rules "|---|---|"
  type Draft = { sec: number; kmh?: number; incline?: number; label?: string };
  const phases: Draft[] = [];
  let name = '';
  const notes: string[] = [];
  let cur: Draft | null = null;
  const complete = (d: Draft | null) => !!d && d.kmh !== undefined && d.incline !== undefined && !!d.label;

  for (const cell of cells) {
    let rest = cell;
    const r = rest.match(RANGE);
    const span = !r ? rest.match(SPAN) : null;
    if (r) {
      const sec = secOf(r[2]) - secOf(r[1]);
      if (sec > 0) {
        cur = { sec };
        phases.push(cur);
        rest = rest.slice(r[0].length);
      }
    } else if (span && (SPEED.test(rest) || INCLINE.test(rest) || !phases.length || complete(cur))) {
      const v = n(span[1]);
      cur = { sec: Math.round(/^s|″|"/i.test(span[2]) ? v : v * 60) };
      phases.push(cur);
      rest = rest.slice(span[0].length);
    }
    if (!cur) {
      // Before the phases: the first real line is the name, the column headings are skipped.
      const plain = cell.replace(/[*_#>]/g, '').trim();
      if (!name && plain && !HEADER.test(plain) && plain.length <= 70 && !plain.endsWith('?')) name = plain.replace(/[:.]$/, '');
      continue;
    }
    const before = rest;
    const sp = rest.match(SPEED);
    if (sp && cur.kmh === undefined) {
      cur.kmh = n(sp[1]);
      rest = rest.replace(sp[0], ' ');
    }
    const inc = rest.match(INCLINE);
    if (inc && cur.incline === undefined) {
      cur.incline = n(inc[1]);
      rest = rest.replace(inc[0], ' ');
    }
    const words = rest
      .replace(/\b(pendenza|inclinazione|velocit[aà])\b/gi, ' ')
      .replace(/[·•,;()[\]–—*_#-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^((a|al|e|con)\s+)+/i, '')
      .replace(/(\s+(a|al|e|con))+$/i, '');
    const consumed = before !== rest || r || span;
    if (words && /[a-zà-ú]/i.test(words) && !cur.label && words.length <= 40 && !words.includes(':') && !HEADER.test(words)) {
      cur.label = words.charAt(0).toUpperCase() + words.slice(1);
    } else if (!consumed && complete(cur)) {
      if (!cell.endsWith('?')) notes.push(cell);
    }
  }

  const warnings: string[] = [];
  let lastKmh = 5;
  let lastInc = 0;
  const steps = phases.map((p, i): RunStep => {
    if (p.kmh === undefined) warnings.push(`Fase ${i + 1}: velocità non trovata, messa ${fmtKmh(lastKmh)} km/h.`);
    if (p.incline === undefined) warnings.push(`Fase ${i + 1}: pendenza non trovata, messa ${fmtIncline(lastInc)}%.`);
    const kmh = Math.min(MAX_KMH, p.kmh ?? lastKmh);
    const incline = p.incline ?? lastInc;
    lastKmh = kmh;
    lastInc = incline;
    return { id: uid(), kind: kindOf(p.label, i, phases.length), by: 'time', value: p.sec, kmh, incline, ...(p.label ? { label: p.label } : {}) };
  });
  return { name: name || 'Programma importato', steps, notes: notes.join('\n') || undefined, warnings };
}

// ---- Harder or easier, level by level ----

/** The phases that change with the level: not the warm-up, the recoveries and the cool-down. */
const adapts = (s: RunStep) => s.kind === 'work';

/** One level up (+1) or down (−1): incline first, then speed. */
function oneLevel(steps: RunStep[], dir: 1 | -1, maxIncline: number): RunStep[] {
  return steps.map((s) => {
    if (!adapts(s)) return s;
    const inc = s.incline ?? 0;
    const kmh = kmhOf(s);
    if (dir > 0) {
      if (inc + INCLINE_STEP <= maxIncline) return { ...s, incline: inc + INCLINE_STEP };
      return { ...s, kmh: Math.min(MAX_KMH, Math.round((kmh + KMH_STEP) * 10) / 10), paceSec: undefined };
    }
    if (inc >= INCLINE_STEP) return { ...s, incline: inc - INCLINE_STEP };
    return { ...s, kmh: Math.max(MIN_KMH, Math.round((kmh - KMH_STEP) * 10) / 10), paceSec: undefined };
  });
}

/**
 * The programme at a level: 0 is as written (with the incline capped at the treadmill's top),
 * +1 one notch harder, −1 one notch easier, and so on. Always worked out from the programme as
 * written, so going up and then down again gives back exactly the same steps.
 */
export function atLevel(steps: RunStep[], level: number, maxIncline = DEFAULT_MAX_INCLINE): RunStep[] {
  let out: RunStep[] = steps.map((s) => ({ ...s, id: uid(), incline: Math.min(maxIncline, s.incline ?? 0) }));
  for (let i = 0; i < Math.abs(level); i++) out = oneLevel(out, level > 0 ? 1 : -1, maxIncline);
  return out;
}

/** What changes between two versions of a programme, phase by phase ("Salita: 9 → 10%"). */
export function changes(a: RunStep[], b: RunStep[]): string[] {
  const out: string[] = [];
  b.forEach((s, i) => {
    const o = a[i];
    if (!o) return;
    const name = s.label ?? `Serie ${i + 1}`;
    const parts: string[] = [];
    if ((o.incline ?? 0) !== (s.incline ?? 0)) parts.push(`${fmtIncline(o.incline)} → ${fmtIncline(s.incline)}%`);
    if (kmhOf(o) !== kmhOf(s)) parts.push(`${fmtKmh(kmhOf(o))} → ${fmtKmh(kmhOf(s))} km/h`);
    if (parts.length) out.push(`${name}: ${parts.join(', ')}`);
  });
  return out;
}

/** "Livello +2" / "Livello −1" / "" for the programme as written. */
export const levelLabel = (level: number) => (level ? `livello ${level > 0 ? '+' : '−'}${Math.abs(level)}` : '');

/** One line per phase, for the import preview: "0:00–2:00 · 4,5 km/h · 5% · Riscaldamento". */
export function phaseLines(steps: RunStep[]): { time: string; kmh: string; incline: string; label: string }[] {
  let t = 0;
  return steps.map((s, i) => {
    const from = t;
    t += s.value;
    return { time: `${fmtDuration(from)}–${fmtDuration(t)}`, kmh: `${fmtKmh(kmhOf(s))} km/h`, incline: `${fmtIncline(s.incline)}%`, label: s.label ?? `Serie ${i + 1}` };
  });
}
