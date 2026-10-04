import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store/StoreContext';
import { routineFromWorkout } from '../../lib/training/routines';
import { bestsBefore, prsOf, workingSets, workoutVolume } from '../../lib/training/analytics';
import type { ISODate, WorkoutModule } from '../../lib/types';
import { fmt } from '../charts';
import { GlyphPrev, IconWorkout } from '../icons';
import { exerciseDef } from '../../lib/training/exercises';
import { today } from '../../lib/dates';
import { AutoText, uid } from '../ui';
import { DurationField } from '../WheelPicker';


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
  const { allDays, history, settings, saveSettings } = useStore();
  // What to do with the routine this workout came from: keep it (one-off), overwrite it, or save a new one.
  const source = (settings.routines ?? []).find((r) => r.id === w.routineId);
  const [routineChoice, setRoutineChoice] = useState<'keep' | 'update' | 'new'>('keep');
  const [newName, setNewName] = useState('');
  const endedAt = useMemo(() => Date.now(), []);
  const measured = Math.max(1, Math.round((endedAt - (w.startedAt ?? endedAt)) / 60000));
  const [step, setStep] = useState<'confirm' | 'save' | 'done'>('confirm');
  const [title, setTitle] = useState(w.title ?? '');
  const [notes, setNotes] = useState(w.notes ?? '');
  const [minutes, setMinutes] = useState(measured);

  useEffect(() => {
    document.documentElement.classList.add('modal-open');
    return () => document.documentElement.classList.remove('modal-open');
  }, []);

  const volume = Math.round(workoutVolume(w));
  const sets = workingSets(w);
  // One line per exercise with a record: its best new set and how much it beats the old best.
  const records = useMemo(() => {
    const out: { name: string; set: string; delta?: string }[] = [];
    for (const ex of w.exercises) {
      const b = bestsBefore(history, ex.exerciseId, w.id, date);
      const best = ex.sets.filter((s) => prsOf(s, b).length).sort((a, c) => (c.kg ?? 0) - (a.kg ?? 0) || c.reps - a.reps)[0];
      if (!best) continue;
      const gain = best.kg && best.kg > b.kg ? `+${fmt(best.kg - b.kg, 1)} kg` : !best.kg && best.reps > b.reps ? `+${best.reps - b.reps} rip.` : undefined;
      out.push({ name: exerciseDef(ex.exerciseId, settings.exercises).name, set: best.kg ? `${fmt(best.kg, 1)} kg × ${best.reps} rip` : `${best.reps} rip`, delta: gain });
    }
    return out;
  }, [w, history, date, settings.exercises]);
  const number = useMemo(() => allDays.flatMap((d) => d.modules).filter((m) => m.kind === 'workout' && m.finishedAt && m.id !== w.id).length + 1, [allDays, w.id]);

  if (step === 'confirm') {
    return (
      <div className="finish-backdrop" onClick={onClose}>
        <div className="finish-dialog" role="alertdialog" aria-label="Terminare l’allenamento" onClick={(e) => e.stopPropagation()}>
          <span className="finish-icon" aria-hidden="true">
            <IconWorkout size={30} />
          </span>
          <h2>Vuoi terminare l’allenamento?</h2>
          <p className="muted">Verrà salvato nella pagina del giorno.</p>
          <button className="btn finish-primary" onClick={() => setStep('save')}>
            ✓ Termina e salva
          </button>
          <button className="btn-ghost" onClick={onClose}>
            Torna all’allenamento
          </button>
          <button className="finish-danger" onClick={onAbandon}>
            Abbandona ed elimina
          </button>
        </div>
      </div>
    );
  }

  if (step === 'save') {
    return (
      <div className="finish-screen" role="dialog" aria-label="Salva allenamento">
        <header className="finish-bar">
          <button data-back className="icon-btn" aria-label="Torna all’allenamento" onClick={onClose}>
            <GlyphPrev />
          </button>
          <h2>Salva allenamento</h2>
          <button
            className="btn small"
            onClick={() => {
              if (w.exercises.length && routineChoice === 'new') {
                saveSettings({ ...settings, routines: [...(settings.routines ?? []), routineFromWorkout(w, uid(), newName.trim() || title.trim() || 'Nuova routine')] });
              } else if (w.exercises.length && routineChoice === 'update' && source) {
                const updated = { ...source, ...routineFromWorkout(w, source.id, source.name), notes: source.notes, folder: source.folder };
                saveSettings({ ...settings, routines: (settings.routines ?? []).map((r) => (r.id === source.id ? updated : r)) });
              }
              onSave({ title: title.trim() || undefined, notes: notes.trim() || undefined, durationMin: Math.max(1, Math.round(minutes)), finishedAt: Math.round(minutes) !== measured && w.startedAt ? w.startedAt + Math.round(minutes) * 60000 : endedAt });
              setStep('done');
            }}
          >
            Salva
          </button>
        </header>
        <div className="finish-body">
          <div className="finish-name-card">
            <span className="finish-name-dot" aria-hidden="true">
              <IconWorkout size={24} />
            </span>
            <input className="finish-title" value={title} placeholder="Nome dell’allenamento" aria-label="Nome dell’allenamento" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <dl className="finish-stats finish-tiles">
            <div>
              <dt>Durata</dt>
              <dd className="accent">
                <DurationField unit="min" label="Durata dell’allenamento" className="finish-min" value={minutes} onChange={(v) => setMinutes(Math.max(1, v))} />
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
          <label className="field finish-notes-card">
            <span className="field-label">Note sull’allenamento</span>
            <AutoText className="finish-notes" value={notes} placeholder="Come è andato il tuo allenamento? Lascia qualche nota qui…" onChange={setNotes} />
          </label>
          {w.exercises.length > 0 && (
            <fieldset className="routine-choice">
              <legend>{source ? `La routine “${source.name}”` : 'Routine'}</legend>
              <label className={routineChoice === 'keep' ? 'on' : ''}>
                <input type="radio" name="routine-choice" checked={routineChoice === 'keep'} onChange={() => setRoutineChoice('keep')} />
                <span>
                  <strong>{source ? 'Lasciala com’è' : 'Non salvare come routine'}</strong>
                  <small>{source ? 'Le modifiche valgono solo per oggi' : 'Resta solo nel diario di oggi'}</small>
                </span>
              </label>
              {source && (
                <label className={routineChoice === 'update' ? 'on' : ''}>
                  <input type="radio" name="routine-choice" checked={routineChoice === 'update'} onChange={() => setRoutineChoice('update')} />
                  <span>
                    <strong>Aggiorna “{source.name}”</strong>
                    <small>Sovrascrive la routine con esercizi e serie di oggi</small>
                  </span>
                </label>
              )}
              <label className={routineChoice === 'new' ? 'on' : ''}>
                <input
                  type="radio"
                  name="routine-choice"
                  checked={routineChoice === 'new'}
                  onChange={() => {
                    setRoutineChoice('new');
                    if (!newName) setNewName(source ? `${source.name} (2)` : title.trim() || 'Nuova routine');
                  }}
                />
                <span>
                  <strong>Salva come nuova routine</strong>
                  <small>{source ? `“${source.name}” resta com’è` : 'Pronta per i prossimi allenamenti'}</small>
                </span>
              </label>
              {routineChoice === 'new' && <input className="routine-name" value={newName} autoFocus placeholder="Nome della nuova routine" aria-label="Nome della nuova routine" onChange={(e) => setNewName(e.target.value)} />}
            </fieldset>
          )}
          <button
            className="finish-abandon"
            onClick={() => {
              if (window.confirm('Abbandonare l’allenamento? Verrà eliminato.')) onAbandon();
            }}
          >
            Abbandona ed elimina allenamento
          </button>
        </div>
      </div>
    );
  }

  const doneAt = new Date(w.startedAt ? w.startedAt + Math.round(minutes) * 60000 : endedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="finish-screen finish-done" role="dialog" aria-label="Allenamento completato">
      <span className="done-check" aria-hidden="true">✓</span>
      <h1>Ottimo lavoro!</h1>
      <p className="finish-sub">
        {title.trim() || 'Allenamento'} completato · {date === today() ? 'oggi' : date.split('-').reverse().slice(0, 2).join('/')} · {doneAt}
        <br />
        <span>È il tuo allenamento numero {number}</span>
      </p>
      <dl className="done-strip">
        <div>
          <dt>Durata</dt>
          <dd>
            {Math.max(1, Math.round(minutes))}
            <small> min</small>
          </dd>
        </div>
        <div>
          <dt>Volume</dt>
          <dd className="lime">
            {fmt(volume)}
            <small> kg</small>
          </dd>
        </div>
        <div>
          <dt>Serie</dt>
          <dd>{sets}</dd>
        </div>
      </dl>
      {records.length > 0 && (
        <section className="done-records">
          <h2>
            <span className="dr-medal" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
                <rect x="5" y="20" width="14" height="2" rx="1" />
              </svg>
            </span>
            {records.length === 1 ? '1 nuovo record personale' : `${records.length} nuovi record personali`}
          </h2>
          {records.map((r) => (
            <div key={r.name} className="dr-row">
              <span>
                <strong>{r.name}</strong>
                <span className="dr-set">
                  {r.set}
                  {r.delta && <b>{r.delta}</b>}
                </span>
              </span>
            </div>
          ))}
        </section>
      )}
      <button data-back className="btn finish-ok" onClick={() => nav(`/giorno/${date}`)}>
        Fine
      </button>
    </div>
  );
}
