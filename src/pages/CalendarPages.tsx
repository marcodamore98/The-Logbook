import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GlyphNext, GlyphPrev } from '../components/icons';
import { useSwipeNav } from '../components/useSwipeNav';
import { metaOf, summarize } from '../components/modules/meta';
import {
  addDays,
  addMonths,
  formatMonth,
  fromISO,
  isoWeek,
  monthGrid,
  shiftMinutes,
  startOfWeek,
  today,
  WEEKDAYS_SHORT,
} from '../lib/dates';
import { agendaOn, type AgendaItem } from '../lib/agenda';
import { useStore } from '../lib/store/StoreContext';
import { AgendaRows, MonthChips } from '../components/AgendaList';
import { EventSheet } from '../components/EventSheet';
import { useRangeSelect } from '../components/useRangeSelect';
import type { DayEntry, ISODate, ModuleKind } from '../lib/types';
import { surgeryTotals } from '../lib/worklog';

/** Month · Week · Day switch at the top of the calendar pages. */
function CalSwitch({ view, date }: { view: 'mese' | 'settimana'; date: ISODate }) {
  const nav = useNavigate();
  return (
    <div className="segmented kind-switch cal-switch" role="tablist">
      {(
        [
          ['mese', 'Mese'],
          ['settimana', 'Settimana'],
          ['giorno', 'Giorno'],
        ] as const
      ).map(([id, label]) => (
        <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => nav(`/${id}/${date}`)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Colour family of each kind of activity, shared by dots, legend and rows. */
const DOT: Partial<Record<ModuleKind, string>> = {
  surgery: 'sky',
  clinical: 'sky',
  workout: 'lime',
  run: 'amber',
  study: 'lav',
  course: 'lav',
  travel: 'sage',
  outing: 'sage',
};
const LEGEND: [string, string][] = [
  ['sky', 'Sala / clinica'],
  ['lime', 'Palestra'],
  ['amber', 'Corsa'],
  ['lav', 'Studio e corsi'],
  ['sage', 'Tempo libero'],
];

const short = (name: string) => (name.length <= 4 ? name : name.replace(/[^A-Za-zÀ-ú ]/g, '').split(' ').filter(Boolean).map((w, _i, a) => (a.length > 1 ? w[0] : w.slice(0, 3))).join('').slice(0, 3));
const hh = (t: string) => t.slice(0, 2);

function ShiftTag({ day, withTime }: { day: DayEntry; withTime?: boolean }) {
  const { settings } = useStore();
  return (
    <>
      {[day.shift, day.guardia].map((sh, i) => {
        if (!sh) return null;
        const t = settings.shiftTypes.find((x) => x.id === sh.shiftTypeId);
        return (
          <span key={i} className="shift-tag" style={{ '--tint': t?.color ?? '#9c9ca2' } as React.CSSProperties}>
            {withTime ? (
              `${t?.name ?? (i ? 'Guardia' : 'Turno')} · ${sh.start}–${sh.end}`
            ) : (
              <>
                <b className="st-code">{short(t?.name ?? (i ? 'G' : 'T'))} </b>
                {hh(sh.start)}-{hh(sh.end)}
              </>
            )}
          </span>
        );
      })}
    </>
  );
}

/** Shown as agenda items (bars and rows), not as dots or activity rows. */
const AGENDA_KINDS = new Set<ModuleKind>(['course', 'travel', 'outing']);

function Dots({ day }: { day: DayEntry }) {
  const tones = [...new Set(day.modules.filter((m) => !AGENDA_KINDS.has(m.kind)).map((m) => DOT[m.kind]).filter(Boolean))] as string[];
  return (
    <span className="cell-dots">
      {tones.map((t) => (
        <i key={t} className={`dot-${t}`} />
      ))}
    </span>
  );
}

function DayRows({ day }: { day: DayEntry }) {
  const list = day.modules.filter((m) => !AGENDA_KINDS.has(m.kind));
  if (!list.length) return null;
  return (
    <ul className="day-rows">
      {list.map((m) => {
        const M = metaOf(m.kind);
        return (
          <li key={m.id}>
            <span className={`dr-ico dot-${DOT[m.kind] ?? 'sand'}`}>
              <M.Icon size={20} />
            </span>
            <span className="dr-text">{summarize(m)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function MonthPage() {
  const params = useParams();
  const anchor = params.date ?? today();
  const nav = useNavigate();
  const store = useStore();
  const grid = monthGrid(anchor);
  const month = anchor.slice(0, 7);
  const [picked, setPicked] = useState<ISODate | null>(null);
  const [adding, setAdding] = useState<[ISODate, ISODate] | null>(null);
  // Hold a day and drag over the others: a new appointment over those days.
  const sel = useRangeSelect<HTMLDivElement>((a, b) => setAdding([a, b]));
  const agenda = (d: ISODate) => agendaOn(d, store.allDays, store.eventsOn(d));

  useEffect(() => {
    // Also the weeks before: trips and courses that began earlier run into this month.
    store.loadRange(addDays(grid[0], -45), grid[41]);
  }, [anchor, store.gcal.connected]);
  useEffect(() => setPicked(today().startsWith(month) ? today() : null), [month]);

  const inMonth = grid.filter((d) => d.startsWith(month)).map((d) => store.day(d));
  const count = (f: (d: DayEntry) => number) => inMonth.reduce((n, d) => n + f(d), 0);
  const pills: [string, number, string][] = [
    ['lav', count((d) => (d.shift ? 1 : 0)), 'Turni'],
    ['coral', count((d) => (d.guardia ? 1 : 0)), 'Guardie'],
    ['lime', count((d) => d.modules.filter((m) => m.kind === 'workout' || m.kind === 'run').length), 'Allenamenti'],
    ['sky', count((d) => surgeryTotals(d.modules).patients), 'Interventi'],
    ['amber', count((d) => d.modules.filter((m) => m.kind === 'course').length), 'Corsi e congressi'],
  ];
  const selDay = picked ? store.day(picked) : null;
  const selItems = picked ? agenda(picked) : [];
  const open = (it: AgendaItem) => nav(`/giorno/${it.kind === 'gcal' ? picked : it.origin}${it.module ? `?apri=${it.module.id}` : ''}`);

  const swipeRef = useSwipeNav<HTMLDivElement>(() => nav(`/mese/${addMonths(anchor, -1)}`), () => nav(`/mese/${addMonths(anchor, 1)}`), month);
  return (
    <div ref={swipeRef} className="page swipe-page cal-page">
      <CalSwitch view="mese" date={picked ?? anchor} />
      <header className="page-head">
        <button className="icon-btn" aria-label="Mese precedente" onClick={() => nav(`/mese/${addMonths(anchor, -1)}`)}>
          <GlyphPrev />
        </button>
        <div className="page-title">
          <h1 className="capitalize">{formatMonth(anchor)}</h1>
        </div>
        <button className="icon-btn" aria-label="Mese successivo" onClick={() => nav(`/mese/${addMonths(anchor, 1)}`)}>
          <GlyphNext />
        </button>
        {month !== today().slice(0, 7) ? (
          <Link className="today-pill" to={`/mese/${today()}`}>
            Oggi
          </Link>
        ) : (
          <span className="today-pill on">Mese corrente</span>
        )}
      </header>
      <div className="sum-pills">
        {pills
          .filter(([, n]) => n > 0)
          .map(([tone, n, label]) => (
            <span key={label} className="sum-pill">
              <i className={`dot-${tone}`} /> {n} {label}
            </span>
          ))}
      </div>
      <section className="month-card">
        <div className="month" ref={sel.ref}>
          {WEEKDAYS_SHORT.map((w, i) => (
            <div key={w} className={`month-dow${i === 5 ? ' sat' : i === 6 ? ' sun' : ''}`}>
              {w}
            </div>
          ))}
          {grid.map((d, i) => {
            const day = store.day(d);
            const other = d.slice(0, 7) !== month;
            return (
              <button
                key={d}
                type="button"
                data-date={d}
                onClick={() => !sel.justPicked() && (picked === d ? nav(`/giorno/${d}`) : setPicked(d))}
                className={`month-cell${other ? ' other' : ''}${d === today() ? ' is-today' : ''}${d === picked ? ' picked' : ''}${sel.inRange(d) ? ' in-range' : ''}${i % 7 === 5 ? ' sat' : i % 7 === 6 ? ' sun' : ''}`}
              >
                <span className="month-num">{fromISO(d).getDate()}</span>
                <ShiftTag day={day} />
                {/* Same height with or without a shift, so the bars of several days stay in line. */}
                {!day.shift && !day.guardia && <span className="shift-tag ghost" aria-hidden="true">{'\u00a0'}</span>}
                <MonthChips items={agenda(d)} date={d} weekStart={i % 7 === 0} weekEnd={i % 7 === 6} />
                <Dots day={day} />
              </button>
            );
          })}
        </div>
        <p className="cal-hint muted small">Tocca un giorno per aggiungere un impegno; tienilo premuto e trascina per sceglierne più di uno.</p>
        <div className="cal-legend">
          {LEGEND.map(([t, label]) => (
            <span key={t}>
              <i className={`dot-${t}`} /> {label}
            </span>
          ))}
        </div>
      </section>
      {selDay && picked && (
        <section className="day-preview">
          <div className="dp-head">
            <div>
              <strong className="capitalize">{fromISO(picked).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
              {picked === today() && <span className="today-badge">Oggi</span>}
            </div>
            <ShiftTag day={selDay} withTime />
          </div>
          <button type="button" className="quick-add" onClick={() => setAdding([picked, picked])}>
            <span className="qa-plus" aria-hidden="true">+</span>
            <span>Aggiungi un impegno</span>
          </button>
          {selItems.length > 0 && <AgendaRows items={selItems} date={picked} onPick={open} />}
          <DayRows day={selDay} />
          {!selItems.length && !selDay.modules.length && <p className="muted small">Niente in programma.</p>}
          <Link className="lime-banner" to={`/giorno/${picked}`}>
            <span>Apri la pagina del giorno</span>
            <span aria-hidden="true">›</span>
          </Link>
        </section>
      )}
      {adding && <EventSheet from={adding[0]} to={adding[1]} onClose={() => setAdding(null)} />}
    </div>
  );
}

export function WeekPage() {
  const params = useParams();
  const start = startOfWeek(params.date ?? today());
  const nav = useNavigate();
  const store = useStore();
  const days: ISODate[] = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [adding, setAdding] = useState<[ISODate, ISODate] | null>(null);
  const sel = useRangeSelect<HTMLDivElement>((a, b) => setAdding([a, b]));

  useEffect(() => {
    store.loadRange(addDays(days[0], -45), days[6]);
  }, [start, store.gcal.connected]);

  const end = fromISO(days[6]);
  const entries = days.map((d) => store.day(d));
  const hours = entries.reduce(
    (n, d) => n + [d.shift, d.guardia].reduce((m, sh) => (sh && store.settings.shiftTypes.find((t) => t.id === sh.shiftTypeId)?.countsAsWork !== false ? m + shiftMinutes(sh.start, sh.end) / 60 : m), 0),
    0,
  );
  const shifts = entries.reduce((n, d) => n + (d.shift ? 1 : 0) + (d.guardia ? 1 : 0), 0);
  const train = entries.reduce((n, d) => n + d.modules.filter((m) => m.kind === 'workout' || m.kind === 'run').length, 0);
  const runs = entries.reduce((n, d) => n + d.modules.filter((m) => m.kind === 'run').length, 0);
  const studyH = entries.reduce((n, d) => n + d.modules.reduce((m, x) => m + (x.kind === 'study' ? x.durationMin : 0), 0), 0) / 60;
  const courses = entries.reduce((n, d) => n + d.modules.filter((m) => m.kind === 'course').length, 0);
  const fmt1 = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });

  const swipeRef = useSwipeNav<HTMLDivElement>(() => nav(`/settimana/${addDays(start, -7)}`), () => nav(`/settimana/${addDays(start, 7)}`), start);
  return (
    <div ref={swipeRef} className="page swipe-page cal-page">
      <CalSwitch view="settimana" date={start} />
      <header className="page-head week-strip">
        <button className="icon-btn" aria-label="Settimana precedente" onClick={() => nav(`/settimana/${addDays(start, -7)}`)}>
          <GlyphPrev />
        </button>
        <div className="page-title">
          <h1>Settimana {isoWeek(start)}</h1>
          <span className="page-sub">
            {fromISO(start).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} – {end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <button className="icon-btn" aria-label="Settimana successiva" onClick={() => nav(`/settimana/${addDays(start, 7)}`)}>
          <GlyphNext />
        </button>
        {start !== startOfWeek(today()) && (
          <Link className="today-pill" to={`/settimana/${today()}`}>
            Oggi
          </Link>
        )}
      </header>
      <div className="week-tiles">
        <div className="stat-tile">
          <span className="stat-label">Lavoro</span>
          <strong>{fmt1(hours)} h</strong>
          <span className="wt-sub">{shifts === 1 ? '1 turno' : `${shifts} turni`}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Allenamento</span>
          <strong className="hi">{train}</strong>
          <span className="wt-sub">{runs ? `di cui ${runs} ${runs === 1 ? 'corsa' : 'corse'}` : 'sessioni'}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Formazione</span>
          <strong className="lav">{fmt1(studyH)} h</strong>
          <span className="wt-sub">{courses ? `${courses} ${courses === 1 ? 'corso' : 'corsi'}` : 'di studio'}</span>
        </div>
      </div>
      <p className="cal-hint muted small">Tocca “+ Impegno” in un giorno; tieni premuto un giorno e trascina per sceglierne più di uno.</p>
      <div className="week" ref={sel.ref}>
        {days.map((d, i) => {
          const day = entries[i];
          const agenda = agendaOn(d, store.allDays, store.eventsOn(d));
          const items = day.todos.filter((t) => t.time).map((t) => ({ k: t.id, t: t.time!, label: `☐ ${t.text}`, g: false }));
          const openTodos = day.todos.filter((t) => !t.time && !t.done).length;
          const showMonth = i === 0 || d.endsWith('-01');
          return (
            <Link
              key={d}
              to={`/giorno/${d}`}
              data-date={d}
              onClick={(e) => sel.justPicked() && e.preventDefault()}
              className={`week-day${d === today() ? ' is-today' : ''}${sel.inRange(d) ? ' in-range' : ''}`}
            >
              <div className="week-head">
                <span className="week-dow">{WEEKDAYS_SHORT[i]}</span>
                <span className="week-num">{fromISO(d).getDate()}</span>
                {showMonth && <span className="week-month">{fromISO(d).toLocaleDateString('it-IT', { month: 'long' })}</span>}
                {d === today() && <span className="today-badge">Oggi</span>}
                <span className="week-go" aria-hidden="true">›</span>
              </div>
              <ShiftTag day={day} withTime />
              {agenda.length > 0 && <AgendaRows items={agenda} date={d} compact />}
              {items.length > 0 && (
                <ul className="week-items">
                  {items.map((it) => (
                    <li key={it.k} className={it.g ? 'gcal' : ''}>
                      <span className="time">{it.t}</span> {it.label}
                    </li>
                  ))}
                </ul>
              )}
              {openTodos > 0 && <span className="muted small">{openTodos} da fare</span>}
              <DayRows day={day} />
              <button
                type="button"
                className="quick-add small"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAdding([d, d]);
                }}
              >
                <span className="qa-plus" aria-hidden="true">+</span>
                <span>Impegno</span>
              </button>
            </Link>
          );
        })}
      </div>
      {adding && <EventSheet from={adding[0]} to={adding[1]} onClose={() => setAdding(null)} />}
    </div>
  );
}
