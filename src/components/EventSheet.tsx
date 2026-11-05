import { useState } from 'react';
import { createPortal } from 'react-dom';
import { confirmAction } from './Confirm';
import { Sym } from './icons';
import type { SymName } from './ms';
import { TimeTile, uid } from './ui';
import { useUndo } from './Undo';
import { TimeField } from './WheelPicker';
import { minutesOf, rangeDays } from '../lib/dates';
import { useStore } from '../lib/store/StoreContext';
import { OUTING_TYPES } from '../lib/vocab';
import type { Appointment, CourseModule, DayEntry, ISODate, OutingModule, TravelModule } from '../lib/types';

export type EventType = 'appt' | 'course' | 'congress' | 'webinar' | 'travel' | 'outing' | 'ferie';

const TYPES: [EventType, string, SymName][] = [
  ['appt', 'Impegno', 'event'],
  ['course', 'Corso', 'school'],
  ['congress', 'Congresso', 'groups'],
  ['webinar', 'Webinar', 'videocam'],
  ['travel', 'Viaggio', 'flight_takeoff'],
  ['outing', 'Uscita / evento', 'celebration'],
  ['ferie', 'Ferie', 'beach_access'],
];
/** Only one day: a webinar or an outing. */
const ONE_DAY: EventType[] = ['webinar', 'outing'];
/** With an hour (or "Tutto il giorno"). */
const TIMED: EventType[] = ['appt', 'course', 'congress', 'webinar'];
const plus1h = (t: string) => {
  const m = (minutesOf(t) + 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const label = (d: ISODate) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * "Nuovo impegno", like the quick event of Google Calendar: a title, the days (one or more),
 * all day or with the hours, and what it is. An appointment stays in the agenda; a course,
 * congress or webinar becomes a card of "Corsi e congressi", a trip or an outing a card of
 * "Viaggi e uscite", "Ferie" marks the days as holidays in place of the shift. Everything goes
 * to Google Calendar like the rest.
 */
export function EventSheet({ from, to, edit, onClose }: { from: ISODate; to?: ISODate; edit?: { date: ISODate; appt: Appointment }; onClose: () => void }) {
  const store = useStore();
  const offerUndo = useUndo();
  const a = edit?.appt;
  const [type, setType] = useState<EventType>('appt');
  const [title, setTitle] = useState(a?.title ?? '');
  const [start, setStart] = useState<ISODate>(edit?.date ?? from);
  const [end, setEnd] = useState<ISODate>(a?.endDate ?? to ?? from);
  const [allDay, setAllDay] = useState(a ? !!a.allDay : !!to && to !== from);
  const [t1, setT1] = useState(a?.start ?? '09:00');
  const [t2, setT2] = useState(a?.end ?? '10:00');
  const [place, setPlace] = useState(a?.location ?? '');
  const [link, setLink] = useState('');
  const [outing, setOuting] = useState('concert');
  const [busy, setBusy] = useState(false);

  const oneDay = ONE_DAY.includes(type);
  const last = oneDay || end < start ? start : end;
  const timed = TIMED.includes(type) && !allDay;
  const n = rangeDays(start, last).length;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const name = title.trim();
    const add = (date: ISODate, fn: (d: DayEntry) => DayEntry) => store.updateDay(date, fn);
    let undo: () => Promise<unknown>;
    if (type === 'ferie') {
      const ds = rangeDays(start, last);
      await store.loadRange(start, last);
      const busyDays = ds.filter((d) => {
        const sh = store.day(d).shift;
        return sh && sh.shiftTypeId !== 'ferie' && store.settings.shiftTypes.find((t) => t.id === sh.shiftTypeId)?.countsAsWork !== false;
      });
      if (busyDays.length && !(await confirmAction(`Mettere le ferie al posto di ${busyDays.length === 1 ? 'un turno' : `${busyDays.length} turni`}?`, { detail: busyDays.map(label).join(', '), action: 'Metti le ferie' }))) {
        setBusy(false);
        return;
      }
      const before = new Map(ds.map((d) => [d, store.day(d).shift]));
      for (const d of ds) await add(d, (x) => ({ ...x, shift: { shiftTypeId: 'ferie', start: '00:00', end: '00:00', colleagueIds: [], ...(name ? { note: name } : {}) } }));
      undo = async () => {
        for (const d of ds) await add(d, (x) => ({ ...x, shift: before.get(d) }));
      };
    } else if (type === 'appt') {
      const appt: Appointment = {
        ...(a ?? {}),
        id: a?.id ?? uid(),
        title: name,
        start: t1,
        end: t2,
        allDay: allDay || undefined,
        endDate: last > start ? last : undefined,
        location: place.trim() || undefined,
      };
      // Edited on another day: it moves there (its Google event follows).
      if (edit && edit.date !== start) await add(edit.date, (d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== appt.id) }));
      await add(start, (d) => ({ ...d, appointments: d.appointments.some((x) => x.id === appt.id) ? d.appointments.map((x) => (x.id === appt.id ? appt : x)) : [...d.appointments, appt] }));
      undo = async () => {
        await add(start, (d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== appt.id) }));
        if (edit) await add(edit.date, (d) => ({ ...d, appointments: [...d.appointments.filter((x) => x.id !== a!.id), a!] }));
      };
    } else {
      let m: CourseModule | TravelModule | OutingModule;
      if (type === 'travel') m = { kind: 'travel', id: uid(), title: name, destination: place.trim() || undefined, startDate: start, endDate: last };
      else if (type === 'outing') m = { kind: 'outing', id: uid(), type: outing, title: name, place: place.trim() || undefined };
      else
        m = {
          kind: 'course',
          id: uid(),
          type,
          title: name,
          startDate: start,
          endDate: last,
          ...(timed ? { startTime: t1, endTime: t2 } : {}),
          ...(type === 'webinar' ? (link.trim() ? { link: link.trim() } : {}) : place.trim() ? { place: place.trim() } : {}),
        };
      // An appointment turned into a course, a trip…: the appointment goes (with its Google event).
      if (edit) await add(edit.date, (d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== a!.id) }));
      await add(start, (d) => ({ ...d, modules: [...d.modules, m] }));
      undo = async () => {
        await add(start, (d) => ({ ...d, modules: d.modules.filter((x) => x.id !== m.id) }));
        if (edit) await add(edit.date, (d) => ({ ...d, appointments: [...d.appointments, a!] }));
      };
    }
    onClose();
    const what = type === 'ferie' ? 'Ferie segnate' : type === 'outing' ? 'Uscita aggiunta' : `${TYPES.find((t) => t[0] === type)![1]} ${edit ? 'salvato' : 'aggiunto'}`;
    offerUndo(`${what}${n > 1 ? ` · ${n} giorni` : ''}`, () => void undo(), 6000);
  };

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet event-sheet" role="dialog" aria-label={edit ? 'Modifica impegno' : 'Nuovo impegno'} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>{edit ? 'Modifica impegno' : 'Nuovo impegno'}</h2>
          <button type="button" className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <Sym name="close" size={22} />
          </button>
        </div>
        <input
          className="ev-title"
          value={title}
          autoFocus={!edit}
          placeholder={type === 'ferie' ? 'Nota (facoltativa)' : 'Aggiungi titolo'}
          aria-label="Titolo"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
        />
        <div className="ev-types" role="radiogroup" aria-label="Tipo">
          {TYPES.map(([id, name, icon]) => (
            <button key={id} type="button" role="radio" aria-checked={type === id} className={`ev-type t-${id}${type === id ? ' on' : ''}`} onClick={() => setType(id)}>
              <Sym name={icon} size={18} />
              {name}
            </button>
          ))}
        </div>
        <div className={`ev-dates${oneDay ? ' one' : ''}`}>
          <TimeTile type="date" label={oneDay ? 'Giorno' : 'Dal'} value={start} onChange={(v) => v && (setStart(v), end < v && setEnd(v))} />
          {!oneDay && <TimeTile type="date" label="Al" value={last} min={start} onChange={(v) => v && setEnd(v)} />}
        </div>
        {!oneDay && n > 1 && <p className="muted small ev-days">{n} giorni · {label(start)} – {label(last)}</p>}
        {TIMED.includes(type) && (
          <>
            <label className="ev-allday">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              <span>Tutto il giorno</span>
            </label>
            {!allDay && (
              <div className="ev-times">
                <div className="time-tile tile-time">
                  <span className="tt-label">{n > 1 ? `Inizio (${label(start)})` : 'Inizio'}</span>
                  <TimeField
                    value={t1}
                    label="Ora di inizio"
                    onChange={(v) => {
                      if (!v) return;
                      // The end follows the start (one hour later) unless it was set apart.
                      if (t2 === plus1h(t1) || minutesOf(t2) <= minutesOf(v)) setT2(plus1h(v));
                      setT1(v);
                    }}
                  />
                </div>
                <div className="time-tile tile-time">
                  <span className="tt-label">{n > 1 ? `Fine (${label(last)})` : 'Fine'}</span>
                  <TimeField value={t2} label="Ora di fine" onChange={(v) => v && setT2(v)} />
                </div>
              </div>
            )}
          </>
        )}
        {type === 'outing' && (
          <select className="ev-select" value={outing} aria-label="Tipo di uscita" onChange={(e) => setOuting(e.target.value)}>
            {OUTING_TYPES.filter((o) => o.id !== 'travel').map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {type === 'webinar' ? (
          <label className="icon-input ev-input">
            <Sym name="link" size={18} />
            <input value={link} placeholder="Link per accedere (facoltativo)" onChange={(e) => setLink(e.target.value)} />
          </label>
        ) : (
          type !== 'ferie' && (
            <label className="icon-input ev-input">
              <Sym name="location_on" size={18} />
              <input value={place} placeholder={type === 'travel' ? 'Destinazione' : 'Luogo (facoltativo)'} onChange={(e) => setPlace(e.target.value)} />
            </label>
          )
        )}
        <p className="muted small ev-hint">
          {type === 'appt'
            ? 'Compare tra gli impegni del giorno, subito dopo i turni, e su Google Calendar.'
            : type === 'ferie'
              ? 'I giorni diventano ferie al posto del turno; gli impegni di quei giorni compaiono per primi.'
              : type === 'travel' || type === 'outing'
                ? 'Compare tra gli impegni e, più in basso, come scheda Viaggi e uscite (anche su Google Calendar).'
                : 'Compare tra gli impegni con la sua icona e come scheda Corsi e congressi (ECM, programma, attestato).'}
        </p>
        <div className="ev-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annulla
          </button>
          <button type="button" className="btn ev-save" disabled={busy || (type !== 'ferie' && !title.trim())} onClick={save}>
            Salva
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
