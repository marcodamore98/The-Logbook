import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Sym } from './icons';
import { Field, NumField, TimeTile, uid } from './ui';
import { DurationField, TimeField } from './WheelPicker';
import { useUndo } from './Undo';
import { today } from '../lib/dates';
import { fmtDuration, fmtKm } from '../lib/running/geo';
import { atLevel, changes, DEFAULT_MAX_INCLINE, levelLabel } from '../lib/running/program';
import { kmhOf, treadmillPresets } from '../lib/running/treadmill';
import { useStore } from '../lib/store/StoreContext';
import { WORKOUT_TYPES } from '../lib/vocab';
import type { ISODate, RunLap, RunModule, RunStep, WorkoutModule } from '../lib/types';

/** "18:30" an hour before now, rounded to the quarter: a likely start for something just done. */
const anHourAgo = () => {
  const d = new Date(Date.now() - 3600e3);
  return `${String(d.getHours()).padStart(2, '0')}:${String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, '0')}`;
};
const at = (date: ISODate, time: string) => new Date(`${date}T${time || '12:00'}:00`).getTime();

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet manual-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <Sym name="close" size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** The phases of a programme cut at the time really run: what was done, phase by phase. */
function lapsFor(steps: RunStep[], durationSec: number): RunLap[] {
  const out: RunLap[] = [];
  let t = 0;
  for (const s of steps) {
    if (t >= durationSec) break;
    const sec = Math.min(s.value, durationSec - t);
    t += sec;
    const kmh = kmhOf(s);
    out.push({ kind: s.kind, by: 'time', value: s.value, seconds: sec, meters: Math.round((kmh * sec) / 3.6), kmh, incline: s.incline });
  }
  return out;
}

/**
 * "Corsa già fatta": a run done without the app (or lost) written afterwards — outdoors with its
 * distance, or on the treadmill with a programme (then it also takes the judgement) or with the
 * average speed and incline. The calories burned follow from it like for any run.
 */
export function ManualRunSheet({ defaultDate, onClose }: { defaultDate?: ISODate; onClose: () => void }) {
  const store = useStore();
  const { settings } = store;
  const offerUndo = useUndo();
  const [date, setDate] = useState<ISODate>(defaultDate ?? today());
  const [time, setTime] = useState(anHourAgo());
  const [where, setWhere] = useState<'out' | 'tm'>('tm');
  const [minutes, setMinutes] = useState(30);
  const [km, setKm] = useState('');
  const [planId, setPlanId] = useState('');
  const [kmh, setKmh] = useState(5);
  const [incline, setIncline] = useState(0);
  const [feel, setFeel] = useState<'easy' | 'ok' | 'hard'>();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const maxIncline = settings.treadmillMaxIncline ?? DEFAULT_MAX_INCLINE;
  const levels = settings.runLevels ?? {};
  const plans = useMemo(() => [...treadmillPresets(), ...(settings.runPlans ?? []).filter((p) => p.treadmill)], [settings.runPlans]);
  const plan = plans.find((p) => p.id === planId);
  const level = plan ? levels[plan.id] ?? 0 : 0;
  const steps = useMemo(() => (plan ? atLevel(plan.steps, level, maxIncline) : []), [plan, level, maxIncline]);
  const planSec = steps.reduce((n, s) => n + s.value, 0);

  const choosePlan = (id: string) => {
    setPlanId(id);
    const p = plans.find((x) => x.id === id);
    if (p) setMinutes(Math.round(p.steps.reduce((n, s) => n + s.value, 0) / 60));
  };

  const durationSec = minutes * 60;
  const laps: RunLap[] = where === 'tm' ? (plan ? lapsFor(steps, durationSec) : [{ kind: 'work', by: 'time', value: durationSec, seconds: durationSec, meters: Math.round((kmh * durationSec) / 3.6), kmh, incline }]) : [];
  const typedM = Math.round((Number(km.replace(',', '.')) || 0) * 1000);
  const distanceM = where === 'out' || typedM ? typedM : laps.reduce((n, l) => n + l.meters, 0);
  const next = plan && feel && feel !== 'ok' ? changes(atLevel(plan.steps, level, maxIncline), atLevel(plan.steps, level + (feel === 'easy' ? 1 : -1), maxIncline)) : [];

  const save = async () => {
    const m: RunModule = {
      kind: 'run',
      id: uid(),
      title: title.trim() || undefined,
      mode: where === 'tm' ? 'treadmill' : 'continuous',
      planName: plan?.name,
      steps: plan ? steps : undefined,
      distanceM,
      durationSec,
      startedAt: at(date, time),
      laps: laps.length ? laps : undefined,
      notes: notes.trim() || undefined,
      manual: true,
      ...(plan ? { planId: plan.id, level, ...(feel ? { feel } : {}) } : {}),
    };
    await store.updateDay(date, (d) => ({ ...d, modules: [...d.modules, m] }));
    if (plan && feel && feel !== 'ok') await store.saveSettings({ ...store.settings, runLevels: { ...(store.settings.runLevels ?? {}), [plan.id]: level + (feel === 'easy' ? 1 : -1) } });
    onClose();
    offerUndo(
      'Corsa aggiunta',
      async () => {
        await store.updateDay(date, (d) => ({ ...d, modules: d.modules.filter((x) => x.id !== m.id) }));
        if (plan && feel && feel !== 'ok') await store.saveSettings({ ...store.settings, runLevels: { ...(store.settings.runLevels ?? {}), [plan.id]: level } });
      },
      6000,
    );
  };

  return (
    <Sheet title="Corsa già fatta" onClose={onClose}>
      <p className="muted small">Per una corsa fatta senza l’app, o che non si è salvata: conta nelle statistiche e nelle calorie bruciate.</p>
      <div className="manual-when">
        <TimeTile type="date" label="Giorno" value={date} onChange={(v) => v && setDate(v)} />
        <div className="time-tile tile-time">
          <span className="tt-label">Inizio</span>
          <TimeField value={time} label="Ora di inizio" onChange={(v) => setTime(v ?? time)} />
        </div>
      </div>
      <div className="segmented kind-switch" role="tablist">
        <button role="tab" aria-selected={where === 'tm'} className={where === 'tm' ? 'on' : ''} onClick={() => setWhere('tm')}>
          Tapis roulant
        </button>
        <button role="tab" aria-selected={where === 'out'} className={where === 'out' ? 'on' : ''} onClick={() => setWhere('out')}>
          All’aperto
        </button>
      </div>
      {where === 'tm' && (
        <Field label="Programma">
          <select value={planId} onChange={(e) => choosePlan(e.target.value)}>
            <option value="">Nessuno: velocità e pendenza medie</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {levels[p.id] ? ` · ${levelLabel(levels[p.id])}` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="manual-grid">
        <label className="field">
          <span className="field-label">Durata (ore : minuti)</span>
          <DurationField label="Durata della corsa" unit="min" value={minutes} onChange={(v) => setMinutes(Math.max(1, v))} />
        </label>
        {where === 'tm' && !plan && (
          <>
            <label className="field">
              <span className="field-label">Velocità media (km/h)</span>
              <NumField value={kmh} max={25} label="Velocità media in km/h" onChange={(v) => setKmh(Math.round(v * 10) / 10)} />
            </label>
            <label className="field">
              <span className="field-label">Pendenza media (%)</span>
              <NumField value={incline} max={30} label="Pendenza media in percentuale" onChange={(v) => setIncline(Math.round(v * 2) / 2)} />
            </label>
          </>
        )}
        <Field label={where === 'out' ? 'Distanza (km)' : 'Distanza (km, facoltativa)'}>
          <input inputMode="decimal" value={km} placeholder={where === 'tm' ? fmtKm(distanceM) : 'es. 5,2'} onChange={(e) => setKm(e.target.value.replace(/[^0-9.,]/g, ''))} />
        </Field>
      </div>
      {plan && (
        <p className="muted small">
          {planSec && durationSec < planSec ? `Fatto fino a ${fmtDuration(durationSec)} di ${fmtDuration(planSec)}: contano le fasi fatte. ` : ''}
          Circa {fmtKm(distanceM)} km.
        </p>
      )}
      {plan && (
        <section className="rs-feel">
          <span className="field-label">Com’è andata?</span>
          <div className="feel-row" role="radiogroup" aria-label="Com’è andata?">
            {(
              [
                ['easy', 'sentiment_satisfied', 'Troppo facile'],
                ['ok', 'check_circle', 'Giusto così'],
                ['hard', 'local_fire_department', 'Troppo duro'],
              ] as const
            ).map(([k, icon, label]) => (
              <button key={k} type="button" role="radio" aria-checked={feel === k} className={`feel-btn f-${k}${feel === k ? ' on' : ''}`} onClick={() => setFeel(feel === k ? undefined : k)}>
                <Sym name={icon} size={24} />
                {label}
              </button>
            ))}
          </div>
          {feel && feel !== 'ok' && (
            <div className="feel-next">
              <p>
                <strong>La prossima volta {feel === 'easy' ? 'un po’ più dura' : 'un po’ più leggera'}:</strong>
              </p>
              <ul>{next.length ? next.map((c) => <li key={c}>{c}</li>) : <li>già al limite: resta uguale</li>}</ul>
            </div>
          )}
        </section>
      )}
      <Field label="Titolo (facoltativo)">
        <input value={title} placeholder={plan?.name ?? (where === 'tm' ? 'Tapis roulant' : 'es. Giro del parco')} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Note">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <button type="button" className="btn run-btn" disabled={where === 'out' && !typedM && minutes < 1} onClick={save}>
        Aggiungi la corsa
      </button>
    </Sheet>
  );
}

/**
 * "Allenamento già fatto": a workout written afterwards, empty or from a routine (its exercises
 * with the sets ticked as done); then the workout opens to adjust weights and repetitions.
 */
export function ManualWorkoutSheet({ defaultDate, onClose }: { defaultDate?: ISODate; onClose: () => void }) {
  const store = useStore();
  const nav = useNavigate();
  const routines = store.settings.routines ?? [];
  const [date, setDate] = useState<ISODate>(defaultDate ?? today());
  const [time, setTime] = useState(anHourAgo());
  const [minutes, setMinutes] = useState(60);
  const [routineId, setRoutineId] = useState('');
  const [type, setType] = useState('strength');
  const [title, setTitle] = useState('');
  const routine = routines.find((r) => r.id === routineId);

  const save = async () => {
    const start = at(date, time);
    const w: WorkoutModule = {
      kind: 'workout',
      id: uid(),
      routineId: routine?.id,
      title: title.trim() || routine?.name || WORKOUT_TYPES.find((t) => t.id === type)?.label,
      type: routine?.type ?? type,
      durationMin: minutes,
      startedAt: start,
      finishedAt: start + minutes * 60000,
      manual: true,
      notes: routine?.notes,
      exercises: (routine?.exercises ?? []).map((ex) => ({
        exerciseId: ex.exerciseId,
        supersetId: ex.supersetId,
        restSec: ex.restSec,
        sets: ex.sets.map((p) => ({ type: p.type, reps: p.reps ?? 0, kg: p.kg, seconds: p.seconds, done: true })),
      })),
    };
    await store.updateDay(date, (d) => ({ ...d, modules: [...d.modules, w] }));
    onClose();
    nav(`/palestra/allenamento/${date}/${w.id}`);
  };

  return (
    <Sheet title="Allenamento già fatto" onClose={onClose}>
      <p className="muted small">Per un allenamento fatto senza l’app: conta nelle statistiche e nelle calorie bruciate. Dopo si apre, così puoi aggiungere o correggere esercizi, pesi e ripetizioni.</p>
      <div className="manual-when">
        <TimeTile type="date" label="Giorno" value={date} onChange={(v) => v && setDate(v)} />
        <div className="time-tile tile-time">
          <span className="tt-label">Inizio</span>
          <TimeField value={time} label="Ora di inizio" onChange={(v) => setTime(v ?? time)} />
        </div>
      </div>
      <label className="field">
        <span className="field-label">Durata (ore : minuti)</span>
        <DurationField label="Durata dell’allenamento" unit="min" value={minutes} onChange={(v) => setMinutes(Math.max(1, v))} />
      </label>
      {routines.length > 0 && (
        <Field label="Routine (facoltativa)">
          <select value={routineId} onChange={(e) => setRoutineId(e.target.value)}>
            <option value="">Nessuna: aggiungo gli esercizi dopo</option>
            {routines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!routine && (
        <Field label="Tipo">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {WORKOUT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Titolo (facoltativo)">
        <input value={title} placeholder={routine?.name ?? WORKOUT_TYPES.find((t) => t.id === type)?.label} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <button type="button" className="btn run-btn" onClick={save}>
        Aggiungi l’allenamento
      </button>
    </Sheet>
  );
}

/** Two small buttons ("Allenamento già fatto", "Corsa già fatta") with their sheets. */
export function ManualEntryButtons({ date, only }: { date?: ISODate; only?: 'run' | 'workout' }) {
  const [open, setOpen] = useState<'run' | 'workout' | null>(null);
  return (
    <>
      <div className="manual-btns no-print">
        {only !== 'run' && (
          <button type="button" className="btn-ghost small" onClick={() => setOpen('workout')}>
            <Sym name="edit_calendar" size={18} /> Allenamento già fatto
          </button>
        )}
        {only !== 'workout' && (
          <button type="button" className="btn-ghost small" onClick={() => setOpen('run')}>
            <Sym name="edit_calendar" size={18} /> Corsa già fatta
          </button>
        )}
      </div>
      {open === 'run' && <ManualRunSheet defaultDate={date} onClose={() => setOpen(null)} />}
      {open === 'workout' && <ManualWorkoutSheet defaultDate={date} onClose={() => setOpen(null)} />}
    </>
  );
}
