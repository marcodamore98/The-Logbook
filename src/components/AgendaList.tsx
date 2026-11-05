import { Sym } from './icons';
import type { SymName } from './ms';
import { dayOf, KIND_LABEL, timeOf, type AgendaItem, type AgendaKind } from '../lib/agenda';
import type { ISODate } from '../lib/types';

export const KIND_ICON: Record<AgendaKind, SymName> = {
  appt: 'event',
  course: 'school',
  congress: 'groups',
  webinar: 'videocam',
  travel: 'flight_takeoff',
  outing: 'celebration',
  gcal: 'calendar_month',
};

/** One line per item, like the schedule of Google Calendar: icon by kind, time, title, place. */
export function AgendaRows({ items, date, onPick, compact }: { items: AgendaItem[]; date: ISODate; onPick?: (it: AgendaItem) => void; compact?: boolean }) {
  return (
    <ul className={`ag-rows${compact ? ' compact' : ''}`}>
      {items.map((it) => {
        const span = dayOf(it, date);
        const body = (
          <>
            <span className={`ag-ico k-${it.kind}`} title={KIND_LABEL[it.kind]}>
              <Sym name={KIND_ICON[it.kind]} size={compact ? 16 : 18} />
            </span>
            <span className="ag-text">
              <strong>{it.title || KIND_LABEL[it.kind]}</strong>
              <span className="ag-sub">
                {[timeOf(it, date), span, it.kind !== 'appt' && it.kind !== 'gcal' ? KIND_LABEL[it.kind] : '', it.place].filter(Boolean).join(' · ')}
              </span>
            </span>
            {it.kind === 'gcal' && (
              <span className="badge badge-sync" title="Evento di Google Calendar">
                G
              </span>
            )}
          </>
        );
        return (
          <li key={it.key} className={`ag-row k-${it.kind}`}>
            {onPick ? (
              <button type="button" className="ag-btn" onClick={() => onPick(it)}>
                {body}
              </button>
            ) : (
              <div className="ag-btn">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Bars in a month cell, like Google's month view; events of several days run on from day to day. */
export function MonthChips({ items, date, weekStart, weekEnd, max = 2 }: { items: AgendaItem[]; date: ISODate; weekStart: boolean; weekEnd: boolean; max?: number }) {
  return (
    <span className="ev-chips">
      {items.slice(0, max).map((it) => {
        const contL = date > it.startDate && !weekStart;
        const contR = date < it.endDate && !weekEnd;
        return (
          <span key={it.key} className={`ev-chip k-${it.kind}${contL ? ' cont-l' : ''}${contR ? ' cont-r' : ''}`} title={it.title}>
            {date === it.startDate || weekStart ? it.title || KIND_LABEL[it.kind] : ' '}
          </span>
        );
      })}
      {items.length > max && <span className="ev-more">+{items.length - max}</span>}
    </span>
  );
}
