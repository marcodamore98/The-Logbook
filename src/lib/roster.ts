// Department roster (tabellone): who does what on each day, for residents
// (specializzandi) and staff (strutturati). Codes are normalized ids shared
// with the shift types, so the user's own shifts can be imported directly.

import { ROSTER_2026_10 } from '../data/roster-2026-10';
import { minutesOf } from './dates';
import type { Colleague, HHMM, ISODate, ShiftAssignment, ShiftType } from './types';

export interface RosterMonth {
  from: ISODate;
  to: ISODate;
  /** date → surname → codes (top row first) */
  residents: Record<ISODate, Record<string, string[]>>;
  staff: Record<ISODate, Record<string, string[]>>;
}

export const ROSTERS: RosterMonth[] = [ROSTER_2026_10];

/** How the user appears in the residents' sheet. */
export const ROSTER_SELF = "D'Amore";

export const RESIDENTS = [
  'Covino', 'Carignano', 'Pascotto', 'Suraci', 'Viale', 'Alice', 'Costa Torro', 'Mucciacito', 'Paradiso',
  'Bisconte', 'Brusa', 'Hussein', 'Moretto', 'Taha', 'Albano', 'Ballesio', 'Buggea', 'Iannelli', 'Labbate',
  'Ostoni', 'Quinteri', 'Ricossa', 'Varricchio',
];

export const STAFF = [
  'Bounous', 'Cacciari', "D'Alonzo", 'Ferrero', 'Fuso', 'Jacomuzzi', 'Mancarella', 'Mariani', 'Moggio', 'Novara',
  'Pace', 'Pecchio', 'Perrini', 'Roagna', 'Sgro', 'Spanu',
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-');
export const residentId = (name: string) => `spec-${slug(name)}`;
export const staffId = (name: string) => `strut-${slug(name)}`;

export const ROSTER_COLLEAGUES: Colleague[] = [
  ...STAFF.map((name) => ({ id: staffId(name), name, role: 'Strutturato' })),
  ...RESIDENTS.map((name) => ({ id: residentId(name), name, role: 'Specializzando' })),
];

type Group = 'Reparto e sala' | 'Ambulatori e diagnostica' | 'Guardie e reperibilità' | 'Formazione e altro' | 'Assenze';

interface Code {
  id: string;
  short: string; // as written on the sheet
  label: string;
  start: HHMM;
  end: HHMM;
  group: Group;
  work: boolean;
}

const C = (id: string, short: string, label: string, group: Group, start = '08:00', end = '14:00', work = true): Code => ({
  id, short, label, group, start, end, work,
});

export const ROSTER_CODES: Code[] = [
  C('ost', 'Ost', 'Reparto Ostetricia', 'Reparto e sala'),
  C('gin', 'Gin', 'Reparto Ginecologia', 'Reparto e sala'),
  C('so', 'SO', 'Sala operatoria', 'Reparto e sala'),
  C('sop', 'SOp', 'Sala operatoria pomeriggio', 'Reparto e sala', '14:00', '20:00'),
  C('sor', 'SOr', 'Sala operatoria (SOr)', 'Reparto e sala'),
  C('ps', 'PS', 'Pronto soccorso', 'Reparto e sala'),
  C('preric', 'preric', 'Prericovero', 'Reparto e sala'),
  C('falconi', 'Falconi', 'Falconi', 'Reparto e sala'),

  C('eco', 'Eco', 'Ecografia', 'Ambulatori e diagnostica'),
  C('ecop', 'EcoP', 'Ecografie pomeriggio', 'Ambulatori e diagnostica', '14:00', '20:00'),
  C('agin', 'A.Gin', 'Ambulatorio ginecologico', 'Ambulatori e diagnostica'),
  C('ambost', 'AmbO', 'Ambulatorio ostetrico', 'Ambulatori e diagnostica'),
  C('amen', 'Men', 'Ambulatorio menopausa', 'Ambulatori e diagnostica'),
  C('uro', 'Uro', 'Uroginecologia', 'Ambulatori e diagnostica'),
  C('puro', 'P.Ur.', 'Prove urodinamiche', 'Ambulatori e diagnostica'),
  C('colpo', 'Colp', 'Colposcopia', 'Ambulatori e diagnostica'),
  C('vulvo', 'vulvo', 'Ambulatorio vulvologia', 'Ambulatori e diagnostica'),
  C('isc', 'Isc', 'Isteroscopia', 'Ambulatori e diagnostica'),
  C('istom', 'IstoM', 'Isteroscopia mattino', 'Ambulatori e diagnostica'),
  C('istop', 'IstoP', 'Isteroscopia pomeriggio', 'Ambulatori e diagnostica', '14:00', '20:00'),
  C('laser', 'laser', 'Laser', 'Ambulatori e diagnostica'),
  C('laserp', 'laser pom', 'Laser pomeriggio', 'Ambulatori e diagnostica', '14:00', '20:00'),
  C('caressflow', 'caressflow', 'Caressflow', 'Ambulatori e diagnostica', '14:00', '20:00'),
  C('sen', 'Sen', 'Senologia', 'Ambulatori e diagnostica'),
  C('oncm', 'OncM', 'Follow-up mammella', 'Ambulatori e diagnostica'),
  C('oncp', 'OncP', 'Oncologia pelvica', 'Ambulatori e diagnostica'),
  C('brca', 'BRCA', 'Ambulatorio BRCA', 'Ambulatori e diagnostica'),
  C('dh', 'Dh', 'Day Hospital chemioterapia', 'Ambulatori e diagnostica'),
  C('cas', 'CAS', 'Centro Accoglienza Servizi', 'Ambulatori e diagnostica'),
  C('agg', 'Agg', 'Prestazioni aggiuntive', 'Ambulatori e diagnostica', '14:00', '20:00'),

  C('gg', 'GG', 'Guardia giorno', 'Guardie e reperibilità', '08:00', '20:00'),
  C('gp', 'GP', 'Guardia pomeriggio', 'Guardie e reperibilità', '14:00', '20:00'),
  C('gn', 'GN', 'Guardia notte', 'Guardie e reperibilità', '20:00', '08:00'),
  C('rep', 'rep', 'Reperibilità', 'Guardie e reperibilità', '20:00', '08:00', false),
  C('rg', 'RG', 'Reperibilità giorno', 'Guardie e reperibilità', '08:00', '20:00', false),
  C('rn', 'RN', 'Reperibilità notte', 'Guardie e reperibilità', '20:00', '08:00', false),

  C('lez', 'Lez', 'Lezioni', 'Formazione e altro'),
  C('cong', 'Cong', 'Congresso', 'Formazione e altro', '08:00', '17:00', false),
  C('esame', 'Es', 'Esame', 'Formazione e altro', '08:00', '14:00', false),
  C('concorso', 'concorso', 'Concorso', 'Formazione e altro', '08:00', '14:00', false),
  C('extra', 'Extra', 'Attività extra ospedale', 'Formazione e altro', '08:00', '14:00', false),

  C('smonto', 's', 'Smonto notte', 'Assenze', '08:00', '08:00', false),
  C('riposo', '/', 'Riposo', 'Assenze', '00:00', '00:00', false),
  C('ferie', 'Ferie', 'Ferie', 'Assenze', '00:00', '00:00', false),
  C('perm', 'Perm', 'Permesso', 'Assenze', '00:00', '00:00', false),
  C('xx', 'XX', 'Assente (vuoto)', 'Assenze', '00:00', '00:00', false),
];

const GROUP_COLORS: Record<Group, string> = {
  'Reparto e sala': '#d9798a',
  'Ambulatori e diagnostica': '#7fa77a',
  'Guardie e reperibilità': '#5a67b8',
  'Formazione e altro': '#e0a93b',
  Assenze: '#c9c4bb',
};

const SPECIFIC_COLORS: Record<string, string> = {
  so: '#c7613f', sop: '#c7613f', sor: '#c7613f', ost: '#d9798a', gin: '#b56576',
  eco: '#3f9c9a', ecop: '#3f9c9a', gg: '#6d78b3', gn: '#4a4e69', gp: '#7a8fa6',
  ferie: '#b7d3c0',
};

export const codeOf = (id: string) => ROSTER_CODES.find((c) => c.id === id);
export const codeLabel = (id: string) => codeOf(id)?.label ?? id;
export const codeShort = (id: string) => codeOf(id)?.short ?? id;

export const ROSTER_SHIFT_TYPES: ShiftType[] = ROSTER_CODES.map((c) => ({
  id: c.id,
  name: c.label,
  start: c.start,
  end: c.end,
  color: SPECIFIC_COLORS[c.id] ?? GROUP_COLORS[c.group],
  countsAsWork: c.work,
  group: c.group,
}));

export function rosterFor(date: ISODate): { residents: Record<string, string[]>; staff: Record<string, string[]> } | null {
  const m = ROSTERS.find((r) => date >= r.from && date <= r.to);
  if (!m) return null;
  const residents = m.residents[date] ?? {};
  const staff = m.staff[date] ?? {};
  return Object.keys(residents).length || Object.keys(staff).length ? { residents, staff } : null;
}

/** Codes that only mean "not working here today". */
export const IDLE_CODES = new Set(['riposo', 'smonto', 'ferie', 'perm', 'xx']);

/**
 * Builds the user's shift from their codes: primary = first real code, the
 * time span covers every working code (e.g. SO + SOp → 08–20, / + GN → 20–08).
 */
export function shiftFromCodes(codes: string[], date: ISODate, colleagues: Colleague[]): ShiftAssignment | null {
  const real = codes.filter((c) => c !== 'riposo');
  if (!real.length) return codes.includes('riposo') ? { shiftTypeId: 'riposo', start: '00:00', end: '00:00', colleagueIds: [] } : null;
  const primary = real[0];
  const spans = real
    .map(codeOf)
    .filter((c): c is Code => !!c && c.work)
    .map((c) => {
      const s = minutesOf(c.start);
      let e = minutesOf(c.end);
      if (e <= s) e += 1440;
      return [s, e] as const;
    });
  const p = codeOf(primary);
  let start = p?.start ?? '08:00';
  let end = p?.end ?? '14:00';
  if (spans.length) {
    const s = Math.min(...spans.map((x) => x[0]));
    const e = Math.max(...spans.map((x) => x[1]));
    const fmt = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    start = fmt(s);
    end = fmt(e);
  }
  const others = real.slice(1).map(codeShort);
  return {
    shiftTypeId: primary,
    start,
    end,
    colleagueIds: idsForNames(colleaguesSharing(date, real), colleagues),
    note: others.length ? `Tabellone: ${real.map(codeShort).join(' · ')}` : undefined,
  };
}

/** Maps roster surnames to saved colleagues (by name, so user-added entries are reused). */
export function idsForNames(names: string[], colleagues: Colleague[]): string[] {
  return names.map((n) => colleagues.find((c) => c.name.trim().toLowerCase() === n.toLowerCase())?.id ?? (STAFF.includes(n) ? staffId(n) : residentId(n)));
}

/** Surnames of residents sharing any of the codes, plus staff on the same primary activity. */
export function colleaguesSharing(date: ISODate, codes: string[]): string[] {
  const r = rosterFor(date);
  if (!r) return [];
  const work = codes.filter((c) => !IDLE_CODES.has(c) && c !== 'rep');
  if (!work.length) return [];
  const ids: string[] = [];
  for (const [name, cs] of Object.entries(r.residents)) {
    if (name !== ROSTER_SELF && cs.some((c) => work.includes(c))) ids.push(name);
  }
  for (const [name, cs] of Object.entries(r.staff)) {
    if (cs.includes(work[0])) ids.push(name);
  }
  return ids;
}

/** The user's own codes for every rostered day. */
export function myRosterDays(): { date: ISODate; codes: string[] }[] {
  const out: { date: ISODate; codes: string[] }[] = [];
  for (const m of ROSTERS) {
    for (const [date, row] of Object.entries(m.residents)) {
      if (row[ROSTER_SELF]?.length) out.push({ date, codes: row[ROSTER_SELF] });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const ORDER = ['gn', 'gg', 'gp', 'rg', 'rn', 'rep', 'so', 'sop', 'sor', 'ost', 'gin', 'ps'];

/** Groups a roster row by code: [[code, names], ...], guards and theatre first, idle codes last. */
export function byCode(row: Record<string, string[]>): [string, string[]][] {
  const map = new Map<string, string[]>();
  for (const [name, codes] of Object.entries(row)) {
    for (const c of codes) {
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(name);
    }
  }
  const rank = (c: string) => (IDLE_CODES.has(c) ? 1000 : ORDER.includes(c) ? ORDER.indexOf(c) : 100 + ROSTER_CODES.findIndex((x) => x.id === c));
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
}
