// Logbook → Google Calendar: turni, guardie, impegni, to-do con orario, corsi/congressi,
// viaggi e uscite diventano eventi del calendario scelto.
// Google Calendar → Logbook (pullFromGoogle): orari, durate, date e titoli modificati su
// Google tornano negli elementi collegati; gli eventi eliminati su Google spariscono anche
// qui; gli eventi con orario creati su Google diventano Impegni collegati, tranne quelli
// che iniziano con "Webinar:", "Corso:" o "Congresso:", che diventano schede Corsi e congressi. Ogni elemento
// tiene l'id del suo evento, così non ci sono doppioni in nessuna delle due direzioni.

import { addDays, minutesOf } from '../dates';
import type { Appointment, CourseModule, DayEntry, ISODate, Module, OutingModule, Settings, ShiftAssignment, Todo, TravelModule } from '../types';
import { OUTING_TYPES } from '../vocab';
import { uid } from '../../components/ui';
import { deleteEvent, eventLocal, hasToken, upsertEvent, type EventInput, type GEvent } from './calendar';

const pad = (n: number) => String(n).padStart(2, '0');
const plusMinutes = (t: string, min: number) => {
  const m = Math.min(minutesOf(t) + min, 23 * 60 + 59);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

export const SHIFT_KEYS = ['shift', 'guardia'] as const;

/** Items of a day that are not on Google Calendar yet (or deletions not done yet): made while Google was disconnected. */
export function pendingCount(d: DayEntry): number {
  let n = d.gcalTrash?.length ?? 0;
  for (const k of SHIFT_KEYS) if (d[k] && !d[k]!.gcalEventId && !d[k]!.gcalSkip) n++;
  n += d.appointments.filter((a) => !a.gcalEventId).length;
  n += d.todos.filter((t) => t.time && !t.gcalEventId).length;
  n += d.modules.filter((m) => (m.kind === 'course' || m.kind === 'travel' || m.kind === 'outing') && !m.gcalEventId).length;
  return n;
}

function shiftInput(day: DayEntry, s: ShiftAssignment, settings: Settings): EventInput {
  const type = settings.shiftTypes.find((t) => t.id === s.shiftTypeId);
  const names = s.colleagueIds
    .map((id) => settings.colleagues.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  const allDay = s.start === s.end && s.start === '00:00';
  const overnight = !allDay && minutesOf(s.end) <= minutesOf(s.start);
  return {
    kind: 'shift',
    date: day.date,
    summary: `Turno: ${type?.name ?? 'Turno'}`,
    location: s.place,
    description: [names && `Con: ${names}`, s.note].filter(Boolean).join('\n') || undefined,
    start: allDay ? undefined : s.start,
    end: allDay ? undefined : s.end,
    endDate: overnight ? addDays(day.date, 1) : undefined,
  };
}

function apptInput(day: DayEntry, a: Appointment): EventInput {
  const overnight = minutesOf(a.end) <= minutesOf(a.start);
  return {
    kind: 'appointment',
    date: day.date,
    summary: a.title,
    location: a.location,
    start: a.start,
    end: a.end,
    endDate: overnight ? addDays(day.date, 1) : undefined,
  };
}

function todoInput(day: DayEntry, t: Todo): EventInput {
  const end = t.end && minutesOf(t.end) > minutesOf(t.time!) ? t.end : plusMinutes(t.time!, 30);
  return { kind: 'todo', date: day.date, summary: `${t.done ? '✓ ' : '☐ '}${t.text}`, start: t.time, end };
}

const COURSE_LABEL = { course: 'Corso', congress: 'Congresso', webinar: 'Webinar' } as const;

function courseInput(m: CourseModule): EventInput {
  const summary = `${COURSE_LABEL[m.type ?? 'course']}: ${m.title || 'senza titolo'}`;
  if (!m.startTime) {
    // No time: an all-day event over the whole course / congress.
    return { kind: 'course', date: m.startDate, endDate: m.endDate > m.startDate ? m.endDate : undefined, summary, location: courseWhere(m) };
  }
  const end = m.endTime && minutesOf(m.endTime) > minutesOf(m.startTime) ? m.endTime : plusMinutes(m.startTime, 60);
  return { kind: 'course', date: m.startDate, summary, start: m.startTime, end, reminders: m.remind ? [30, 5] : [], location: courseWhere(m) };
}

/** Webinars are "held" at their link; courses and congresses at their place. */
const courseWhere = (m: CourseModule) => (m.type === 'webinar' ? m.link : m.place) || undefined;

const COURSE_PREFIX = /^\s*(webinar|corso|congresso)\s*:\s*/i;
const URL_RE = /https?:\/\/[^\s<>"')]+/i;

/** The join link of an event: Meet link, or the first web address in its description or place. */
function eventLink(e: GEvent): string | undefined {
  if (e.hangoutLink) return e.hangoutLink;
  const text = `${e.description ?? ''} ${e.location ?? ''}`; // descriptions may be HTML: the address sits in href="…"
  return URL_RE.exec(text)?.[0].replace(/&amp;/g, '&');
}

/** A "Webinar: …", "Corso: …" or "Congresso: …" event as a course card of its first day. */
function courseFromEvent(e: GEvent): CourseModule | undefined {
  const m = COURSE_PREFIX.exec(e.summary ?? '');
  if (!m) return undefined;
  const type = ({ webinar: 'webinar', corso: 'course', congresso: 'congress' } as const)[m[1].toLowerCase() as 'webinar' | 'corso' | 'congresso'];
  const a = eventLocal(e.start);
  const b = eventLocal(e.end);
  const lastDay = a.time ? a.date : addDays(b.date, -1) < a.date ? a.date : addDays(b.date, -1);
  const link = eventLink(e);
  const place = e.location && !URL_RE.test(e.location) ? e.location : undefined;
  return {
    kind: 'course',
    id: uid(),
    type,
    title: (e.summary ?? '').replace(COURSE_PREFIX, '').trim(),
    startDate: a.date,
    endDate: type === 'webinar' ? a.date : lastDay,
    startTime: a.time,
    endTime: a.time ? b.time : undefined,
    place,
    link,
    gcalEventId: e.id,
  };
}

function travelInput(m: TravelModule): EventInput {
  return { kind: 'travel', date: m.startDate, endDate: m.endDate > m.startDate ? m.endDate : undefined, summary: `Viaggio: ${m.title || m.destination || 'senza titolo'}`, location: m.destination || undefined };
}

function outingInput(day: DayEntry, m: OutingModule): EventInput {
  const type = OUTING_TYPES.find((t) => t.id === m.type)?.label ?? 'Uscita';
  return { kind: 'outing', date: day.date, summary: `${type}: ${m.title || 'senza titolo'}`, location: m.place || undefined, description: m.people ? `Con: ${m.people}` : undefined };
}

const courses = (d: DayEntry) => d.modules.filter((m): m is CourseModule => m.kind === 'course');
const travels = (d: DayEntry) => d.modules.filter((m): m is TravelModule => m.kind === 'travel');
const outings = (d: DayEntry) => d.modules.filter((m): m is OutingModule => m.kind === 'outing');
/** Modules that become calendar events. */
const calModules = (d: DayEntry) => d.modules.filter((m): m is CourseModule | TravelModule | OutingModule => m.kind === 'course' || m.kind === 'travel' || m.kind === 'outing');

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Pushes the difference between prev and next to Google Calendar and returns
 * `next` with the created event ids filled in. `force` pushes every linked item.
 */
export async function pushDay(prev: DayEntry | undefined, next: DayEntry, settings: Settings, force = false): Promise<DayEntry> {
  if (!settings.gcal.enabled || !hasToken()) return next;
  const cal = settings.gcal.calendarId;
  const out: DayEntry = structuredClone(next);

  for (const id of out.gcalTrash ?? []) await deleteEvent(cal, id);
  out.gcalTrash = [];

  // Shifts: hospital + guardia medica
  for (const key of SHIFT_KEYS) {
    const cur = out[key];
    const old = prev?.[key];
    if (!cur || cur.gcalSkip) continue;
    const input = shiftInput(out, cur, settings);
    if (force || !cur.gcalEventId || !same(input, old && shiftInput(prev!, old, settings))) {
      cur.gcalEventId = await upsertEvent(cal, cur.gcalEventId, { ...input, itemId: `${out.date}:${key}` });
    }
  }

  // Appointments
  for (const a of out.appointments) {
    const input = apptInput(out, a);
    const old = prev?.appointments.find((x) => x.id === a.id);
    if (force || !a.gcalEventId || !old || !same(input, apptInput(prev!, old))) {
      a.gcalEventId = await upsertEvent(cal, a.gcalEventId, { ...input, itemId: a.id });
    }
  }

  // Todos with a time
  for (const t of out.todos) {
    const old = prev?.todos.find((x) => x.id === t.id);
    if (!t.time) {
      if (t.gcalEventId) {
        await deleteEvent(cal, t.gcalEventId);
        t.gcalEventId = undefined;
      }
      continue;
    }
    const input = todoInput(out, t);
    if (force || !t.gcalEventId || !old || !old.time || !same(input, todoInput(prev!, old))) {
      t.gcalEventId = await upsertEvent(cal, t.gcalEventId, { ...input, itemId: t.id });
    }
  }
  // Courses, congresses and webinars: timed (with their reminders) or all-day over their dates
  for (const m of courses(out)) {
    const old = prev && courses(prev).find((x) => x.id === m.id);
    const input = courseInput(m);
    if (force || !m.gcalEventId || !old || !same(input, courseInput(old))) {
      m.gcalEventId = await upsertEvent(cal, m.gcalEventId, { ...input, itemId: m.id });
    }
  }
  // Trips (all-day, over their dates) and outings (all-day on their day)
  for (const m of travels(out)) {
    const old = prev && travels(prev).find((x) => x.id === m.id);
    const input = travelInput(m);
    if (force || !m.gcalEventId || !old || !same(input, travelInput(old))) {
      m.gcalEventId = await upsertEvent(cal, m.gcalEventId, { ...input, itemId: m.id });
    }
  }
  for (const m of outings(out)) {
    const old = prev && outings(prev).find((x) => x.id === m.id);
    const input = outingInput(out, m);
    if (force || !m.gcalEventId || !old || !same(input, outingInput(prev!, old))) {
      m.gcalEventId = await upsertEvent(cal, m.gcalEventId, { ...input, itemId: m.id });
    }
  }
  return out;
}

/** Collects the event ids of items removed between prev and next, so they can be deleted later. */
export function trashRemoved(prev: DayEntry | undefined, next: DayEntry): DayEntry {
  if (!prev) return next;
  const keep = new Set<string>();
  for (const k of SHIFT_KEYS) if (next[k]?.gcalEventId) keep.add(next[k]!.gcalEventId!);
  next.appointments.forEach((a) => a.gcalEventId && keep.add(a.gcalEventId));
  next.todos.forEach((t) => t.gcalEventId && keep.add(t.gcalEventId));
  calModules(next).forEach((m) => m.gcalEventId && keep.add(m.gcalEventId));
  const gone: string[] = [];
  for (const k of SHIFT_KEYS) {
    const id = prev[k]?.gcalEventId;
    if (id && !keep.has(id)) gone.push(id);
  }
  prev.appointments.forEach((a) => a.gcalEventId && !keep.has(a.gcalEventId) && gone.push(a.gcalEventId));
  prev.todos.forEach((t) => t.gcalEventId && !keep.has(t.gcalEventId) && gone.push(t.gcalEventId));
  calModules(prev).forEach((m) => m.gcalEventId && !keep.has(m.gcalEventId) && gone.push(m.gcalEventId));
  if (!gone.length) return next;
  return { ...next, gcalTrash: [...new Set([...(next.gcalTrash ?? []), ...gone])] };
}

const TODO_MARK = /^([☐✓])\s*/;
const stripLabel = (summary: string | undefined, re: RegExp) => (summary ?? '').replace(re, '').trim();

/**
 * Brings what changed on Google Calendar into the loaded days (the ones in `days`):
 * - linked items take the event's times, duration, dates, title and place;
 * - an appointment or to-do whose event moved to another loaded day moves there;
 * - an item whose event was deleted on Google is removed here too (a shift stays,
 *   unlinked, and is not re-created on Google);
 * - timed events created on Google in the sync calendar become linked appointments.
 * `lookup` fetches a linked event that is not in `events` (moved far away or deleted).
 * Returns only the days that changed.
 */
export async function pullFromGoogle(days: DayEntry[], events: GEvent[], settings: Settings, lookup: (calendarId: string, id: string) => Promise<GEvent | null>): Promise<DayEntry[]> {
  const cal = settings.gcal.calendarId;
  const byId = new Map(events.map((e) => [e.id, e]));
  const out = new Map(days.map((d) => [d.date, structuredClone(d)]));
  const changed = new Set<ISODate>();

  /** The event of a linked item, or what happened to it. */
  const resolve = async (id: string): Promise<GEvent | 'deleted' | 'unknown'> => {
    const e = byId.get(id);
    if (e) return e;
    const far = await lookup(cal, id);
    if (!far) return 'unknown'; // e.g. another calendar was chosen: the item is pushed again
    if (far.status === 'cancelled') return 'deleted';
    byId.set(id, far);
    return far;
  };
  const set = <T extends object>(date: ISODate, item: T, patch: Partial<T>) => {
    for (const [k, v] of Object.entries(patch) as [keyof T, T[keyof T]][]) {
      if (JSON.stringify(item[k]) !== JSON.stringify(v)) {
        if (v === undefined) delete item[k];
        else item[k] = v;
        changed.add(date);
      }
    }
  };

  for (const date of [...out.keys()]) {
    const day = out.get(date)!;

    for (const k of SHIFT_KEYS) {
      const sh = day[k];
      if (!sh?.gcalEventId) continue;
      const e = await resolve(sh.gcalEventId);
      if (e === 'deleted') set(date, sh, { gcalEventId: undefined, gcalSkip: true } as Partial<ShiftAssignment>);
      else if (e === 'unknown') set(date, sh, { gcalEventId: undefined } as Partial<ShiftAssignment>);
      else {
        const a = eventLocal(e.start);
        const b = eventLocal(e.end);
        if (a.date === date && a.time && b.time) set(date, sh, { start: a.time, end: b.time });
      }
    }

    for (const ap of [...day.appointments]) {
      if (!ap.gcalEventId) continue;
      const e = await resolve(ap.gcalEventId);
      if (e === 'deleted') {
        day.appointments = day.appointments.filter((x) => x !== ap);
        changed.add(date);
        continue;
      }
      if (e === 'unknown') {
        set(date, ap, { gcalEventId: undefined } as Partial<Appointment>);
        continue;
      }
      const a = eventLocal(e.start);
      const b = eventLocal(e.end);
      if (!a.time || !b.time) continue; // turned into an all-day event: keep it as it is
      set(date, ap, { start: a.time, end: b.time, title: e.summary || ap.title, location: e.location || undefined });
      const target = a.date !== date ? out.get(a.date) : undefined;
      if (target) {
        day.appointments = day.appointments.filter((x) => x !== ap);
        target.appointments.push(ap);
        changed.add(date).add(a.date);
      }
    }

    for (const t of [...day.todos]) {
      if (!t.gcalEventId) continue;
      const e = await resolve(t.gcalEventId);
      if (e === 'deleted') {
        day.todos = day.todos.filter((x) => x !== t);
        changed.add(date);
        continue;
      }
      if (e === 'unknown') {
        set(date, t, { gcalEventId: undefined } as Partial<Todo>);
        continue;
      }
      const a = eventLocal(e.start);
      const b = eventLocal(e.end);
      const mark = TODO_MARK.exec(e.summary ?? '');
      set(date, t, {
        text: stripLabel(e.summary, TODO_MARK) || t.text,
        done: mark ? mark[1] === '✓' : t.done,
        ...(a.time && b.time ? { time: a.time, end: b.time } : {}),
      });
      const target = a.date !== date ? out.get(a.date) : undefined;
      if (target) {
        day.todos = day.todos.filter((x) => x !== t);
        target.todos.push(t);
        changed.add(date).add(a.date);
      }
    }

    for (const m of [...calModules(day)]) {
      if (!m.gcalEventId) continue;
      const e = await resolve(m.gcalEventId);
      if (e === 'deleted') {
        day.modules = day.modules.filter((x) => x !== (m as Module));
        changed.add(date);
        continue;
      }
      if (e === 'unknown') {
        set(date, m, { gcalEventId: undefined } as Partial<typeof m>);
        continue;
      }
      const a = eventLocal(e.start);
      const b = eventLocal(e.end);
      // All-day events end the day after their last day.
      const lastDay = a.time ? a.date : addDays(b.date, -1) < a.date ? a.date : addDays(b.date, -1);
      if (m.kind === 'course') {
        const link = eventLink(e);
        set(date, m, {
          title: stripLabel(e.summary, COURSE_PREFIX) || m.title,
          place: e.location && !(link && e.location.includes(link)) ? e.location : undefined,
          startDate: a.date,
          endDate: m.type === 'webinar' ? a.date : a.time ? (m.endDate < a.date ? a.date : m.endDate) : lastDay,
          startTime: a.time,
          endTime: a.time ? b.time : undefined,
          ...(link ? { link } : {}),
        });
      } else if (m.kind === 'travel') {
        set(date, m, { title: stripLabel(e.summary, /^Viaggio:\s*/) || m.title, destination: e.location || undefined, startDate: a.date, endDate: lastDay });
      } else {
        set(date, m, { title: stripLabel(e.summary, /^[^:]+:\s*/) || m.title, place: e.location || undefined });
      }
    }
  }

  const linked = linkedIds([...out.values()]);

  // "Webinar: …", "Corso: …", "Congresso: …" written on Google become course cards on their
  // first day (also all-day and multi-day events). Appointments made from such events before
  // become course cards too.
  for (const day of out.values()) {
    for (const ap of [...day.appointments]) {
      if (!ap.gcalEventId || !COURSE_PREFIX.test(ap.title)) continue;
      const e = byId.get(ap.gcalEventId);
      const c = e && courseFromEvent(e);
      if (!c) continue;
      day.appointments = day.appointments.filter((x) => x !== ap);
      changed.add(day.date);
      const target = out.get(c.startDate) ?? day;
      target.modules.push(c);
      changed.add(target.date);
    }
  }
  for (const e of events) {
    if (e.calendarId !== cal || linked.has(e.id) || e.extendedProperties?.private?.logbook === '1') continue;
    const c = courseFromEvent(e);
    const target = c && out.get(c.startDate);
    if (!c || !target) continue;
    target.modules.push(c);
    linked.add(e.id);
    changed.add(target.date);
  }

  // Timed events created on Google in the sync calendar become appointments of their day.
  for (const e of events) {
    if (e.calendarId !== cal || linked.has(e.id) || e.extendedProperties?.private?.logbook === '1' || !e.start.dateTime || !e.end.dateTime) continue;
    const a = eventLocal(e.start);
    const target = out.get(a.date);
    if (!target) continue;
    target.appointments.push({ id: uid(), title: e.summary || '(senza titolo)', start: a.time!, end: eventLocal(e.end).time!, location: e.location || undefined, gcalEventId: e.id });
    linked.add(e.id);
    changed.add(a.date);
  }

  return [...changed].map((d) => out.get(d)!);
}

/** Ids of Google events already represented by logbook items (not shown twice). */
export function linkedIds(days: DayEntry[]): Set<string> {
  const s = new Set<string>();
  for (const d of days) {
    for (const k of SHIFT_KEYS) if (d[k]?.gcalEventId) s.add(d[k]!.gcalEventId!);
    d.appointments.forEach((a) => a.gcalEventId && s.add(a.gcalEventId));
    d.todos.forEach((t) => t.gcalEventId && s.add(t.gcalEventId));
    calModules(d).forEach((m) => m.gcalEventId && s.add(m.gcalEventId));
  }
  return s;
}
