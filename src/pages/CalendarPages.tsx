import { useEffect } from 'react';
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
  startOfWeek,
  today,
  WEEKDAYS_SHORT,
} from '../lib/dates';
import { eventLocal } from '../lib/google/calendar';
import { useStore } from '../lib/store/StoreContext';
import type { DayEntry, ISODate } from '../lib/types';

function ShiftChip({ day }: { day: DayEntry }) {
  const { settings } = useStore();
  return (
    <>
      {[day.shift, day.guardia].map((sh, i) => {
        if (!sh) return null;
        const t = settings.shiftTypes.find((x) => x.id === sh.shiftTypeId);
        return (
          <span key={i} className="shift-chip" style={{ '--tint': t?.color ?? '#ccc' } as React.CSSProperties}>
            {t?.name ?? 'Turno'}
          </span>
        );
      })}
    </>
  );
}

function ModuleDots({ day }: { day: DayEntry }) {
  const kinds = [...new Set(day.modules.map((m) => m.kind))];
  return (
    <span className="module-dots">
      {kinds.map((k) => {
        const M = metaOf(k);
        return (
          <span key={k} title={M.label}>
            <M.Icon size={20} />
          </span>
        );
      })}
    </span>
  );
}

export function MonthPage() {
  const params = useParams();
  const anchor = params.date ?? today();
  const nav = useNavigate();
  const store = useStore();
  const grid = monthGrid(anchor);
  const month = anchor.slice(0, 7);

  useEffect(() => {
    store.loadRange(grid[0], grid[41]);
  }, [anchor, store.gcal.connected]);

  const swipeRef = useSwipeNav<HTMLDivElement>(() => nav(`/mese/${addMonths(anchor, -1)}`), () => nav(`/mese/${addMonths(anchor, 1)}`), month);
  return (
    <div ref={swipeRef} className="page swipe-page">
      <header className="page-head">
        <button className="icon-btn" aria-label="Mese precedente" onClick={() => nav(`/mese/${addMonths(anchor, -1)}`)}>
          <GlyphPrev />
        </button>
        <div className="page-title">
          <h1 className="capitalize">{formatMonth(anchor)}</h1>
          {month !== today().slice(0, 7) && (
            <Link className="link-quiet" to={`/mese/${today()}`}>
              mese corrente
            </Link>
          )}
        </div>
        <button className="icon-btn" aria-label="Mese successivo" onClick={() => nav(`/mese/${addMonths(anchor, 1)}`)}>
          <GlyphNext />
        </button>
      </header>
      <div className="month">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="month-dow">
            {w}
          </div>
        ))}
        {grid.map((d) => {
          const day = store.day(d);
          const ev = store.eventsOn(d);
          const other = d.slice(0, 7) !== month;
          const extras = day.appointments.length + ev.length;
          return (
            <Link
              key={d}
              to={`/giorno/${d}`}
              className={`month-cell${other ? ' other' : ''}${d === today() ? ' is-today' : ''}`}
            >
              <span className="month-num">{fromISO(d).getDate()}</span>
              <ShiftChip day={day} />
              {extras > 0 && <span className="month-extra">{extras} impegn{extras === 1 ? 'o' : 'i'}</span>}
              <ModuleDots day={day} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function WeekPage() {
  const params = useParams();
  const start = startOfWeek(params.date ?? today());
  const nav = useNavigate();
  const store = useStore();
  const days: ISODate[] = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  useEffect(() => {
    store.loadRange(days[0], days[6]);
  }, [start, store.gcal.connected]);

  const end = fromISO(days[6]);
  const swipeRef = useSwipeNav<HTMLDivElement>(() => nav(`/settimana/${addDays(start, -7)}`), () => nav(`/settimana/${addDays(start, 7)}`), start);
  return (
    <div ref={swipeRef} className="page swipe-page">
      <header className="page-head">
        <button className="icon-btn" aria-label="Settimana precedente" onClick={() => nav(`/settimana/${addDays(start, -7)}`)}>
          <GlyphPrev />
        </button>
        <div className="page-title">
          <h1>
            Settimana {isoWeek(start)}
            <span className="muted">
              {' '}
              · {fromISO(start).getDate()}–{end.getDate()} {end.toLocaleDateString('it-IT', { month: 'long' })}
            </span>
          </h1>
          {start !== startOfWeek(today()) && (
            <Link className="link-quiet" to={`/settimana/${today()}`}>
              settimana corrente
            </Link>
          )}
        </div>
        <button className="icon-btn" aria-label="Settimana successiva" onClick={() => nav(`/settimana/${addDays(start, 7)}`)}>
          <GlyphNext />
        </button>
      </header>
      <div className="week">
        {days.map((d, i) => {
          const day = store.day(d);
          const items = [
            ...day.appointments.map((a) => ({ k: a.id, t: a.start, label: a.title || 'Impegno', g: false })),
            ...store.eventsOn(d).map((e) => ({ k: e.id, t: eventLocal(e.start).time ?? '', label: e.summary ?? '', g: true })),
            ...day.todos.filter((t) => t.time).map((t) => ({ k: t.id, t: t.time!, label: `☐ ${t.text}`, g: false })),
          ].sort((a, b) => a.t.localeCompare(b.t));
          const openTodos = day.todos.filter((t) => !t.time && !t.done).length;
          return (
            <Link key={d} to={`/giorno/${d}`} className={`week-day${d === today() ? ' is-today' : ''}`}>
              <div className="week-head">
                <span className="week-dow">{WEEKDAYS_SHORT[i]}</span>
                <span className="week-num">{fromISO(d).getDate()}</span>
              </div>
              <ShiftChip day={day} />
              {[day.shift, day.guardia].map(
                (sh, k) =>
                  sh && (
                    <span key={k} className="week-time">
                      {sh.start}–{sh.end}
                    </span>
                  ),
              )}
              <ul className="week-items">
                {items.map((it) => (
                  <li key={it.k} className={it.g ? 'gcal' : ''}>
                    <span className="time">{it.t}</span> {it.label}
                  </li>
                ))}
                {openTodos > 0 && <li className="muted">{openTodos} da fare</li>}
              </ul>
              <ul className="week-modules">
                {day.modules.map((m) => {
                  const M = metaOf(m.kind);
                  return (
                    <li key={m.id}>
                      <M.Icon size={20} /> <span>{summarize(m)}</span>
                    </li>
                  );
                })}
              </ul>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
