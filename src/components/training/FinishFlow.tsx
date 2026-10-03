import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store/StoreContext';
import { bestsBefore, prsOf, workingSets, workoutVolume } from '../../lib/training/analytics';
import type { ISODate, WorkoutModule } from '../../lib/types';
import { fmt } from '../charts';
import { GlyphPrev } from '../icons';
import { AutoText, NumField } from '../ui';

const SHORT_MIN = 10; // below this the duration is probably a mistake

/** Fun comparison for the total weight lifted. */
function compare(kg: number): { icon: string; text: string } {
  if (kg < 300) return { icon: '🎹', text: 'È come sollevare un pianoforte!' };
  if (kg < 900) return { icon: '🐎', text: 'È come sollevare un cavallo!' };
  if (kg < 2500) return { icon: '🚗', text: 'È come sollevare un’auto!' };
  if (kg < 7000) return { icon: '🐘', text: 'È come sollevare un elefante!' };
  if (kg < 15000) return { icon: '🚌', text: 'È come sollevare un autobus!' };
  return { icon: '✈️', text: 'È come sollevare un aereo!' };
}

const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`);

/**
 * What happens when you press "Termina": a check if the duration looks too short, a page to
 * save the workout (name, duration, notes), and a "well done" screen with the totals.
 */
export function FinishFlow({
  w,
  date,
  onSave,
  onAbandon,
  onClose,
}: {
  w: WorkoutModule;
  date: ISODate;
  onSave: (patch: Partial<WorkoutModule>) => void;
  onAbandon: () => void;
  onClose: () => void;
}) {
  const nav = useNavigate();
  const { allDays, history } = useStore();
  const endedAt = useMemo(() => Date.now(), []);
  const measured = Math.max(1, Math.round((endedAt - (w.startedAt ?? endedAt)) / 60000));
  const [step, setStep] = useState<'short' | 'save' | 'done'>(measured < SHORT_MIN ? 'short' : 'save');
  const [title, setTitle] = useState(w.title ?? '');
  const [notes, setNotes] = useState(w.notes ?? '');
  const [minutes, setMinutes] = useState(measured);
  const [focusMin, setFocusMin] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('modal-open');
    return () => document.documentElement.classList.remove('modal-open');
  }, []);

  const volume = Math.round(workoutVolume(w));
  const sets = workingSets(w);
  const records = useMemo(() => {
    let n = 0;
    for (const ex of w.exercises) {
      const b = bestsBefore(history, ex.exerciseId, w.id, date);
      n += ex.sets.filter((s) => prsOf(s, b).length).length;
    }
    return n;
  }, [w, history, date]);
  const number = useMemo(() => allDays.flatMap((d) => d.modules).filter((m) => m.kind === 'workout' && m.finishedAt && m.id !== w.id).length + 1, [allDays, w.id]);

  if (step === 'short') {
    return (
      <div className="finish-backdrop">
        <div className="finish-dialog" role="alertdialog" aria-label="Durata insolita">
          <h2>Durata dell’allenamento insolita</h2>
          <p>
            Il tuo allenamento è durato <strong>{measured} min</strong>. Questa durata sembra essere inferiore al solito. Desideri modificarla?
          </p>
          <button
            className="btn"
            onClick={() => {
              setFocusMin(true);
              setStep('save');
            }}
          >
            Modifica durata allenamento
          </button>
          <button className="btn-ghost" onClick={() => setStep('save')}>
            Mantieni durata attuale
          </button>
          <button className="btn-ghost" onClick={onClose}>
            Riprendi allenamento
          </button>
        </div>
      </div>
    );
  }

  if (step === 'save') {
    return (
      <div className="finish-screen" role="dialog" aria-label="Salva allenamento">
        <header className="finish-bar">
          <button className="icon-btn" aria-label="Torna all’allenamento" onClick={onClose}>
            <GlyphPrev />
          </button>
          <h2>Salva allenamento</h2>
          <button
            className="btn small"
            onClick={() => {
              onSave({ title: title.trim() || undefined, notes: notes.trim() || undefined, durationMin: Math.max(1, Math.round(minutes)), finishedAt: Math.round(minutes) !== measured && w.startedAt ? w.startedAt + Math.round(minutes) * 60000 : endedAt });
              setStep('done');
            }}
          >
            Salva
          </button>
        </header>
        <div className="finish-body">
          <input className="finish-title" value={title} placeholder="Nome dell’allenamento" onChange={(e) => setTitle(e.target.value)} />
          <dl className="finish-stats">
            <div>
              <dt>Durata</dt>
              <dd className="accent">
                <NumField value={minutes} min={1} label="Durata in minuti" className={`finish-min${focusMin ? ' focus' : ''}`} onChange={setMinutes} /> min
              </dd>
            </div>
            <div>
              <dt>Volume</dt>
              <dd>{fmt(volume)} kg</dd>
            </div>
            <div>
              <dt>Serie</dt>
              <dd>{sets}</dd>
            </div>
          </dl>
          <label className="field">
            <span className="field-label">Note</span>
            <AutoText className="finish-notes" value={notes} placeholder="Come è andato il tuo allenamento? Lascia qualche nota qui…" onChange={setNotes} />
          </label>
          <button
            className="finish-abandon"
            onClick={() => {
              if (window.confirm('Abbandonare l’allenamento? Verrà eliminato.')) onAbandon();
            }}
          >
            Abbandona allenamento
          </button>
        </div>
      </div>
    );
  }

  const fun = compare(volume);
  return (
    <div className="finish-screen finish-done" role="dialog" aria-label="Allenamento completato">
      <h1>Ottimo lavoro!</h1>
      <p className="finish-sub">Questo è il tuo allenamento {number}</p>
      <div className="finish-card">
        <p>Hai sollevato un totale di</p>
        <strong className="finish-big">{fmt(volume)} kg</strong>
        <p>{fun.text}</p>
        <span className="finish-emoji" aria-hidden="true">
          {fun.icon}
        </span>
      </div>
      <dl className="finish-stats finish-stats-done">
        <div>
          <dt>Durata</dt>
          <dd>{hm(Math.max(1, Math.round(minutes)))}</dd>
        </div>
        <div>
          <dt>Serie</dt>
          <dd>{sets}</dd>
        </div>
        <div>
          <dt>Record</dt>
          <dd>{records ? `👑 ${records}` : '–'}</dd>
        </div>
      </dl>
      <button className="btn finish-ok" onClick={() => nav(`/giorno/${date}`)}>
        Fatto
      </button>
    </div>
  );
}
