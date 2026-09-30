import type { HHMM, ISODate } from './types';

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): ISODate {
  return toISO(new Date());
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(s: ISODate, n: number): ISODate {
  const d = fromISO(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

/** Monday of the week containing s. */
export function startOfWeek(s: ISODate): ISODate {
  const d = fromISO(s);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

export function startOfMonth(s: ISODate): ISODate {
  return s.slice(0, 8) + '01';
}

export function endOfMonth(s: ISODate): ISODate {
  const d = fromISO(startOfMonth(s));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toISO(d);
}

export function rangeDays(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 6x7 grid of dates covering the month of s, starting on Monday. */
export function monthGrid(s: ISODate): ISODate[] {
  const first = startOfWeek(startOfMonth(s));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function isoWeek(s: ISODate): number {
  const d = fromISO(s);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export function formatLong(s: ISODate): string {
  const d = fromISO(s);
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatMonth(s: ISODate): string {
  const d = fromISO(s);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function minutesOf(t: HHMM): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Duration in minutes; end <= start means the shift crosses midnight (00:00–00:00 = 0). */
export function shiftMinutes(start: HHMM, end: HHMM): number {
  const a = minutesOf(start);
  const b = minutesOf(end);
  if (a === b) return a === 0 ? 0 : 24 * 60;
  return b > a ? b - a : 24 * 60 - a + b;
}

/** RFC3339 local date-time for Google Calendar, with explicit time zone field. */
export function localDateTime(date: ISODate, t: HHMM): string {
  return `${date}T${t}:00`;
}

export const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';
