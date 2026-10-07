import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, today } from '../lib/dates';
import { deleteEvent, listEvents, type GEvent } from '../lib/google/calendar';
import { linkedIds } from '../lib/google/sync';
import { useStore } from '../lib/store/StoreContext';
import { Sym } from './icons';
import { confirmDelete } from './Confirm';

interface Group {
  key: string;
  title: string;
  when: string;
  keep: GEvent;
  /** Copies that can go: not linked to anything in the logbook. */
  extra: GEvent[];
  /** More than one copy is a card of the logbook: the doubles are in the app too, so nothing is deleted here. */
  inApp: boolean;
}

const norm = (s = '') => s.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
const at = (b: GEvent['start']) => (b.dateTime ? new Date(b.dateTime).getTime().toString() : b.date ?? '');

function describe(e: GEvent): string {
  if (e.start.date) return new Date(`${e.start.date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ' · tutto il giorno';
  const a = new Date(e.start.dateTime!);
  const b = e.end.dateTime ? new Date(e.end.dateTime) : null;
  const t = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${a.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${t(a)}${b ? `–${t(b)}` : ''}`;
}

/** Same title, same start and same end: copies of one event. The copy linked to the logbook (or the oldest) stays. */
export function findDuplicates(events: GEvent[], linked: Set<string>): Group[] {
  const by = new Map<string, GEvent[]>();
  for (const e of events) {
    if (e.recurringEventId) continue; // occurrences of a repeating event are left alone
    const key = `${norm(e.summary)}|${at(e.start)}|${at(e.end)}`;
    by.set(key, [...(by.get(key) ?? []), e]);
  }
  const out: Group[] = [];
  for (const [key, list] of by) {
    if (list.length < 2) continue;
    const mine = list.filter((e) => linked.has(e.id));
    const sorted = [...list].sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''));
    const keep = mine[0] ?? sorted.find((e) => e.extendedProperties?.private?.logbook === '1') ?? sorted[0];
    out.push({ key, title: list[0].summary?.trim() || '(senza titolo)', when: describe(list[0]), keep, extra: list.filter((e) => e !== keep && !linked.has(e.id)), inApp: mine.length > 1 });
  }
  return out.sort((a, b) => at(a.keep.start).localeCompare(at(b.keep.start)));
}

/** Impostazioni → Google Calendar: finds the doubled events of the logbook's calendar and deletes the extra copies after a check. */
export function DuplicateCleaner({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const cal = store.settings.gcal.calendarId;
  const from = addDays(today(), -365);
  const to = addDays(today(), 365);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<{ done: number; all: number } | null>(null);
  const [deleted, setDeleted] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [events, days] = await Promise.all([listEvents(cal, from, to), store.loadAll()]);
        if (alive) setGroups(findDuplicates(events, linkedIds(days)));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doable = (groups ?? []).filter((g) => g.extra.length);
  const chosen = doable.filter((g) => !off.has(g.key));
  const copies = chosen.reduce((n, g) => n + g.extra.length, 0);
  const inApp = (groups ?? []).filter((g) => g.inApp);
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });

  async function run() {
    if (!(await confirmDelete(copies === 1 ? '1 copia doppia da Google Calendar' : `${copies} copie doppie da Google Calendar`, { detail: 'Per ogni evento ne resta una. Da Google non si possono recuperare.' }))) return;
    const list = chosen.flatMap((g) => g.extra);
    setProgress({ done: 0, all: list.length });
    let n = 0;
    try {
      for (const e of list) {
        await deleteEvent(cal, e.id);
        setProgress({ done: ++n, all: list.length });
      }
    } catch (e) {
      setError(`Interrotto dopo ${n} eliminazioni: ${e instanceof Error ? e.message : e}`);
    }
    setProgress(null);
    setDeleted(n);
    setGroups((gs) => (gs ?? []).map((g) => (chosen.some((c) => c.key === g.key) ? { ...g, extra: [] } : g)).filter((g) => g.extra.length || g.inApp));
  }

  return createPortal(
    <div className="sheet-backdrop" onClick={progress ? undefined : onClose}>
      <div className="sheet dup-sheet" role="dialog" aria-label="Doppioni in Google Calendar" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Doppioni in Google Calendar</h2>
          <button type="button" className="icon-btn" aria-label="Chiudi" disabled={!!progress} onClick={onClose}>
            <Sym name="close" size={20} />
          </button>
        </div>
        <p className="muted small">
          Calendario {cal === 'primary' ? 'principale' : 'del Logbook'}, da {fmt(from)} a {fmt(to)}. Sono doppioni gli eventi con lo stesso titolo, lo stesso inizio e la stessa fine: ne resta uno (quello collegato al Logbook o il più vecchio). Gli eventi che si ripetono non vengono toccati.
        </p>
        {error && <p className="error small">{error}</p>}
        {deleted !== null && (
          <p className="dup-done">
            <Sym name="check" size={18} /> {deleted === 1 ? 'Eliminata 1 copia doppia.' : `Eliminate ${deleted} copie doppie.`}
          </p>
        )}
        {!groups && !error && <p className="dup-wait">Cerco i doppioni…</p>}
        {groups && doable.length === 0 && deleted === null && !error && (
          <p className="dup-done">
            <Sym name="check" size={18} /> Nessun doppione trovato.
          </p>
        )}
        {doable.length > 0 && (
          <ul className="dup-list">
            {doable.map((g) => {
              const on = !off.has(g.key);
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className={`dup-row${on ? ' on' : ''}`}
                    disabled={!!progress}
                    onClick={() =>
                      setOff((s) => {
                        const n = new Set(s);
                        if (on) n.add(g.key);
                        else n.delete(g.key);
                        return n;
                      })
                    }
                  >
                    <span className="dup-check" aria-hidden="true">{on && <Sym name="check" size={16} />}</span>
                    <span className="dup-text">
                      <strong>{g.title}</strong>
                      <small>{g.when}</small>
                    </span>
                    <span className="dup-count">
                      {g.extra.length + 1} copie
                      <small>{g.extra.length === 1 ? 'ne tolgo 1' : `ne tolgo ${g.extra.length}`}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {inApp.length > 0 && (
          <p className="muted small">
            {inApp.length === 1 ? 'Un evento è doppio' : `${inApp.length} eventi sono doppi`} anche nel Logbook ({inApp.slice(0, 3).map((g) => `“${g.title}”, ${g.when}`).join('; ')}
            {inApp.length > 3 ? '…' : ''}): elimina la scheda in più nella pagina del giorno e sparirà anche da Google.
          </p>
        )}
        {doable.length > 0 && (
          <div className="sheet-foot">
            <span className="muted small">{progress ? `Elimino ${progress.done}/${progress.all}…` : ''}</span>
            <button type="button" className="btn danger-btn" disabled={!copies || !!progress} onClick={run}>
              <Sym name="delete" size={18} /> {copies === 1 ? 'Elimina 1 copia' : `Elimina ${copies} copie`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
