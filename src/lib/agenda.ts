// The day's agenda as Google Calendar shows it: appointments (also over several days),
// courses, congresses and webinars, trips and outings, and the events of Google Calendar,
// each with its kind, so the calendars can colour them and the day page can list them first.

import { eventLocal, type GEvent } from './google/calendar';
import type { Appointment, CourseModule, DayEntry, ISODate, OutingModule, TravelModule } from './types';

export type AgendaKind = 'appt' | 'course' | 'congress' | 'webinar' | 'travel' | 'outing' | 'gcal';

export interface AgendaItem {
  key: string;
  kind: AgendaKind;
  title: string;
  /** The day it is saved on (where it is edited). */
  origin: ISODate;
  startDate: ISODate;
  endDate: ISODate;
  allDay: boolean;
  start?: string;
  end?: string;
  place?: string;
  appt?: Appointment;
  module?: CourseModule | TravelModule | OutingModule;
  event?: GEvent;
}

export const KIND_LABEL: Record<AgendaKind, string> = {
  appt: 'Impegno',
  course: 'Corso',
  congress: 'Congresso',
  webinar: 'Webinar',
  travel: 'Viaggio',
  outing: 'Uscita',
  gcal: 'Google Calendar',
};

const dayBefore = (d: ISODate) => {
  const t = new Date(`${d}T12:00:00`);
  t.setDate(t.getDate() - 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/** First and last day an event of Google Calendar covers (all-day ends are exclusive there). */
export function eventDays(e: GEvent): [ISODate, ISODate] {
  const a = eventLocal(e.start);
  const b = eventLocal(e.end);
  if (!a.time) return [a.date, b.date > a.date ? dayBefore(b.date) : a.date];
  // A timed event ending at midnight belongs to the day before.
  return [a.date, b.time === '00:00' && b.date > a.date ? dayBefore(b.date) : b.date];
}

/** Everything on a day: from the days loaded (also the ones that began earlier) and Google's events. */
export function agendaOn(date: ISODate, days: DayEntry[], events: GEvent[]): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const d of days) {
    if (d.date > date) continue;
    for (const a of d.appointments) {
      const endDate = a.endDate && a.endDate > d.date ? a.endDate : d.date;
      if (date > endDate) continue;
      out.push({ key: a.id, kind: 'appt', title: a.title, origin: d.date, startDate: d.date, endDate, allDay: !!a.allDay, start: a.allDay ? undefined : a.start, end: a.allDay ? undefined : a.end, place: a.location, appt: a });
    }
    for (const m of d.modules) {
      if (m.kind === 'course' || m.kind === 'travel') {
        if (m.startDate > date || date > m.endDate) continue;
        const kind: AgendaKind = m.kind === 'travel' ? 'travel' : m.type === 'congress' ? 'congress' : m.type === 'webinar' ? 'webinar' : 'course';
        const timed = m.kind === 'course' && !!m.startTime;
        out.push({
          key: m.id,
          kind,
          title: m.title || KIND_LABEL[kind],
          origin: d.date,
          startDate: m.startDate,
          endDate: m.endDate,
          allDay: !timed,
          start: timed ? m.startTime : undefined,
          end: timed ? m.endTime : undefined,
          place: m.kind === 'travel' ? m.destination : m.place,
          module: m,
        });
      } else if (m.kind === 'outing' && d.date === date) {
        out.push({ key: m.id, kind: 'outing', title: m.title || KIND_LABEL.outing, origin: d.date, startDate: d.date, endDate: d.date, allDay: true, place: m.place, module: m });
      }
    }
  }
  for (const e of events) {
    const [s, f] = eventDays(e);
    if (date < s || date > f) continue;
    const a = eventLocal(e.start);
    const b = eventLocal(e.end);
    out.push({ key: e.id, kind: 'gcal', title: e.summary || '(senza titolo)', origin: s, startDate: s, endDate: f, allDay: !a.time, start: a.time, end: b.time, place: e.location, event: e });
  }
  // Like Google: the events of several days first, then the all-day ones, then by time.
  return out.sort(
    (x, y) =>
      Number(y.startDate !== y.endDate) - Number(x.startDate !== x.endDate) ||
      x.startDate.localeCompare(y.startDate) ||
      Number(y.allDay) - Number(x.allDay) ||
      (x.start ?? '').localeCompare(y.start ?? '') ||
      x.title.localeCompare(y.title),
  );
}

const days = (a: ISODate, b: ISODate) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5);

/** "giorno 2 di 3" for an event of several days, else "". */
export function dayOf(item: AgendaItem, date: ISODate): string {
  const total = days(item.startDate, item.endDate) + 1;
  return total > 1 ? `giorno ${days(item.startDate, date) + 1} di ${total}` : '';
}

/** "09:00–10:00", "Tutto il giorno" or "dalle 09:00" on the first day of a timed event of several days. */
export function timeOf(item: AgendaItem, date: ISODate): string {
  if (item.allDay || !item.start) return 'Tutto il giorno';
  if (item.startDate !== item.endDate) {
    if (date === item.startDate) return `dalle ${item.start}`;
    if (date === item.endDate && item.end) return `fino alle ${item.end}`;
    return 'Tutto il giorno';
  }
  return item.end ? `${item.start}–${item.end}` : item.start;
}
