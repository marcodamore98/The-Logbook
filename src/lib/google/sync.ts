// Logbook → Google Calendar: turno, appuntamenti e to-do con orario diventano eventi.
// Google Calendar → Logbook: orari/titoli modificati su Google vengono riportati
// negli elementi collegati (reconcile), gli altri eventi sono mostrati in lettura.

import { addDays, minutesOf } from '../dates';
import type { Appointment, CourseModule, DayEntry, Settings, ShiftAssignment, Todo } from '../types';
import { deleteEvent, eventLocal, hasToken, upsertEvent, type EventInput, type GEvent } from './calendar';

export const SHIFT_KEYS = ['shift', 'guardia'] as const;

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
  const end = minutesOf(t.time!) + 30;
  const pad = (n: number) => String(n).padStart(2, '0');
  const endT = end >= 1440 ? '23:59' : `${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
  return { kind: 'todo', date: day.date, summary: `${t.done ? '✓ ' : '☐ '}${t.text}`, start: t.time, end: endT };
}

const COURSE_LABEL = { course: 'Corso', congress: 'Congresso', webinar: 'Webinar' } as const;

function courseInput(m: CourseModule): EventInput {
  const end = Math.min(minutesOf(m.startTime!) + 60, 23 * 60 + 59);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    kind: 'course',
    date: m.startDate,
    summary: `${COURSE_LABEL[m.type ?? 'course']}: ${m.title || 'senza titolo'}`,
    start: m.startTime,
    end: `${pad(Math.floor(end / 60))}:${pad(end % 60)}`,
    reminders: m.remind ? [30, 5] : [],
    location: m.place || undefined,
  };
}

const courses = (d: DayEntry) => d.modules.filter((m): m is CourseModule => m.kind === 'course');

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
    if (!cur) continue;
    const input = shiftInput(out, cur, settings);
    if (force || !cur.gcalEventId || !same(input, old && shiftInput(prev!, old, settings))) {
      cur.gcalEventId = await upsertEvent(cal, cur.gcalEventId, input);
    }
  }

  // Appointments
  for (const a of out.appointments) {
    const input = apptInput(out, a);
    const old = prev?.appointments.find((x) => x.id === a.id);
    if (force || !a.gcalEventId || !old || !same(input, apptInput(prev!, old))) {
      a.gcalEventId = await upsertEvent(cal, a.gcalEventId, input);
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
      t.gcalEventId = await upsertEvent(cal, t.gcalEventId, input);
    }
  }
  // Courses, congresses and webinars with a start time (with their reminders)
  for (const m of courses(out)) {
    if (!m.startTime) {
      if (m.gcalEventId) {
        await deleteEvent(cal, m.gcalEventId);
        m.gcalEventId = undefined;
      }
      continue;
    }
    const old = prev && courses(prev).find((x) => x.id === m.id);
    const input = courseInput(m);
    if (force || !m.gcalEventId || !old?.startTime || !same(input, courseInput(old))) {
      m.gcalEventId = await upsertEvent(cal, m.gcalEventId, input);
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
  courses(next).forEach((m) => m.gcalEventId && keep.add(m.gcalEventId));
  const gone: string[] = [];
  for (const k of SHIFT_KEYS) {
    const id = prev[k]?.gcalEventId;
    if (id && !keep.has(id)) gone.push(id);
  }
  prev.appointments.forEach((a) => a.gcalEventId && !keep.has(a.gcalEventId) && gone.push(a.gcalEventId));
  prev.todos.forEach((t) => t.gcalEventId && !keep.has(t.gcalEventId) && gone.push(t.gcalEventId));
  courses(prev).forEach((m) => m.gcalEventId && !keep.has(m.gcalEventId) && gone.push(m.gcalEventId));
  if (!gone.length) return next;
  return { ...next, gcalTrash: [...new Set([...(next.gcalTrash ?? []), ...gone])] };
}

/** Applies edits made directly on Google Calendar to linked logbook items. Returns null when nothing changed. */
export function reconcile(day: DayEntry, events: GEvent[]): DayEntry | null {
  const byId = new Map(events.map((e) => [e.id, e]));
  let changed = false;
  const out: DayEntry = structuredClone(day);
  const times = (e: GEvent) => {
    const s = eventLocal(e.start);
    const en = eventLocal(e.end);
    return s.date === day.date && s.time && en.time ? { start: s.time, end: en.time } : null;
  };
  for (const k of SHIFT_KEYS) {
    const sh = out[k];
    if (!sh?.gcalEventId) continue;
    const e = byId.get(sh.gcalEventId);
    const t = e && times(e);
    if (t && (t.start !== sh.start || t.end !== sh.end)) {
      Object.assign(sh, t);
      changed = true;
    }
  }
  for (const a of out.appointments) {
    const e = a.gcalEventId ? byId.get(a.gcalEventId) : undefined;
    if (!e) continue;
    const t = times(e);
    if (t && (t.start !== a.start || t.end !== a.end)) {
      Object.assign(a, t);
      changed = true;
    }
    if (e.summary && e.summary !== a.title) {
      a.title = e.summary;
      changed = true;
    }
    if ((e.location ?? undefined) !== a.location) {
      a.location = e.location;
      changed = true;
    }
  }
  return changed ? out : null;
}

/** Ids of Google events already represented by logbook items (not shown twice). */
export function linkedIds(days: DayEntry[]): Set<string> {
  const s = new Set<string>();
  for (const d of days) {
    for (const k of SHIFT_KEYS) if (d[k]?.gcalEventId) s.add(d[k]!.gcalEventId!);
    d.appointments.forEach((a) => a.gcalEventId && s.add(a.gcalEventId));
    d.todos.forEach((t) => t.gcalEventId && s.add(t.gcalEventId));
    courses(d).forEach((m) => m.gcalEventId && s.add(m.gcalEventId));
  }
  return s;
}
