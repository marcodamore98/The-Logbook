import { useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, today } from '../lib/dates';
import { useStore } from '../lib/store/StoreContext';
import { itemOf, movedCopy, putIn, takeOut, type MoveRef } from '../lib/store/move';
import type { ISODate } from '../lib/types';
import { confirmAction } from './Confirm';
import { Sym } from './icons';
import { TimeTile } from './ui';
import { useUndo } from './Undo';

const dayName = (d: ISODate) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * "Sposta in un altro giorno": for something written on the wrong day (a study session, a workout, an
 * appointment…). It leaves this day and goes to the chosen one, with its Google event; "Annulla" puts it back.
 */
export function MoveButton({ from, what, target, className, label = 'Sposta in un altro giorno', iconOnly, onMoved }: { from: ISODate; what: string; target: MoveRef; className?: string; label?: string; iconOnly?: boolean; onMoved?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className ?? (iconOnly ? 'icon-btn small no-print' : 'move-btn no-print')} aria-label={iconOnly ? `Sposta ${what} in un altro giorno` : undefined} title={iconOnly ? 'Sposta in un altro giorno' : undefined} onClick={() => setOpen(true)}>
        <Sym name="event_upcoming" size={18} />
        {!iconOnly && ` ${label}`}
      </button>
      {open && <MoveSheet from={from} what={what} target={target} onClose={() => setOpen(false)} onMoved={onMoved} />}
    </>
  );
}

export function MoveSheet({ from, what, target, onClose, onMoved }: { from: ISODate; what: string; target: MoveRef; onClose: () => void; onMoved?: () => void }) {
  const store = useStore();
  const offerUndo = useUndo();
  const [to, setTo] = useState<ISODate>(addDays(from, 1));
  const [busy, setBusy] = useState(false);
  const quick: [string, ISODate][] = [
    ['Giorno prima', addDays(from, -1)],
    ['Giorno dopo', addDays(from, 1)],
    ...(from !== today() ? ([['Oggi', today()]] as [string, ISODate][]) : []),
  ];

  const move = async () => {
    if (to === from) return onClose();
    setBusy(true);
    try {
      const item = itemOf(store.day(from), target);
      if (!item) return onClose();
      // A day has one shift and one guardia: ask before replacing the one already there.
      if (target.kind === 'shift' || target.kind === 'guardia') {
        await store.loadRange(to, to);
        if (store.day(to)[target.kind] && !(await confirmAction(`${dayName(to)} ha già ${target.kind === 'shift' ? 'un turno' : 'una guardia medica'}: sostituirlo?`, { action: 'Sostituisci' }))) return;
      }
      const before = store.day(to)[target.kind === 'shift' || target.kind === 'guardia' ? target.kind : 'shift'];
      const moved = movedCopy(item, target, from, to);
      await store.updateDay(from, (d) => takeOut(d, target));
      await store.updateDay(to, (d) => putIn(d, moved.ref, moved.item));
      onClose();
      onMoved?.();
      offerUndo(`Spostato a ${dayName(to)}`, async () => {
        await store.updateDay(to, (d) => {
          const out = takeOut(d, moved.ref);
          return target.kind === 'shift' || target.kind === 'guardia' ? { ...out, [target.kind]: before } : out;
        });
        await store.updateDay(from, (d) => putIn(d, target, item));
      }, 8000);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet move-sheet" role="dialog" aria-label={`Sposta ${what}`} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>Sposta {what}</h2>
          <button type="button" className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <Sym name="close" size={20} />
          </button>
        </div>
        <p className="muted small">Da {dayName(from)} a un altro giorno. Su Google Calendar l’evento si sposta con lui.</p>
        <div className="move-quick">
          {quick.map(([label, d]) => (
            <button key={label} type="button" className={`chip${to === d ? ' chip-on' : ''}`} onClick={() => setTo(d)}>
              {label}
            </button>
          ))}
        </div>
        <TimeTile type="date" label="Nuovo giorno" value={to} onChange={(v) => v && setTo(v)} />
        <button type="button" className="move-go" disabled={busy || to === from} onClick={move}>
          <span>Sposta a {dayName(to)}</span>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
