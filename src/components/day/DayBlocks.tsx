import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dayIntake } from '../../lib/nutrition/foods';
import { useStore } from '../../lib/store/StoreContext';
import { bestsBefore, prsOf, workingSets, workoutVolume } from '../../lib/training/analytics';
import { exerciseDef } from '../../lib/training/exercises';
import { addDays, startOfWeek, today } from '../../lib/dates';
import type { DayEntry, ISODate, RunModule, WorkoutModule } from '../../lib/types';
import { fmtDuration, fmtKm, fmtPace } from '../../lib/running/geo';
import { fmt } from '../charts';
import { runLine } from '../modules/meta';
import { IconFood, IconWorkout } from '../icons';
import { Card } from '../ui';
import { useUndo } from '../Undo';

export function workoutLine(w: WorkoutModule, prs = 0): string {
  return [
    w.title || 'Allenamento',
    w.durationMin ? `${w.durationMin}′` : '',
    `${fmt(workoutVolume(w))} kg`,
    `${workingSets(w)} serie`,
    prs ? `${prs} PR` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const dur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`);

/** Workout of the day: a tappable summary (name, volume, times) or a banner to start one. */
export function TrainingBlock({ day }: { day: DayEntry }) {
  const nav = useNavigate();
  const store = useStore();
  const offerUndo = useUndo();
  const remove = (m: WorkoutModule | RunModule, label: string) => {
    const index = day.modules.findIndex((x) => x.id === m.id);
    store.updateDay(day.date, (d) => ({ ...d, modules: d.modules.filter((x) => x.id !== m.id) }));
    offerUndo(label, () => store.updateDay(day.date, (d) => ({ ...d, modules: [...d.modules.slice(0, index), m, ...d.modules.slice(index)] })));
  };
  const [picked, setPicked] = useState<WorkoutModule | null>(null);
  const [pickedRun, setPickedRun] = useState<RunModule | null>(null);
  const [, tickNow] = useState(0);
  const workouts = day.modules.filter((m): m is WorkoutModule => m.kind === 'workout');
  const runs = day.modules.filter((m): m is RunModule => m.kind === 'run');
  const anyRunning = workouts.some((w) => w.startedAt && !w.finishedAt);

  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => tickNow((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  const info = (w: WorkoutModule) => {
    const running = !!w.startedAt && !w.finishedAt;
    const minutes = running ? Math.max(1, Math.round((Date.now() - w.startedAt!) / 60000)) : w.durationMin;
    const times = w.startedAt ? (w.finishedAt ? `${hhmm(w.startedAt)}–${hhmm(w.finishedAt)}` : `dalle ${hhmm(w.startedAt)}`) : '';
    return { running, name: w.title || 'Allenamento', volume: Math.round(workoutVolume(w)), minutes, times };
  };
  const summary = workouts.length
    ? workouts
        .map((w) => {
          const i = info(w);
          return `${i.name} · ${fmt(i.volume)} kg${i.minutes ? ` · ${dur(i.minutes)}` : ''}${i.running ? ' · in corso' : ''}`;
        })
        .join(' / ')
    : '';
  const runSummary = runs.map(runLine).join(' / ');
  const cardSummary = [summary, runSummary].filter(Boolean).join(' / ') || 'Niente di registrato';

  const records = (w: WorkoutModule) => {
    const out: string[] = [];
    for (const ex of w.exercises) {
      const b = bestsBefore(store.history, ex.exerciseId, w.id, day.date);
      const best = ex.sets.filter((x) => prsOf(x, b).length).sort((a, c) => (c.kg ?? 0) - (a.kg ?? 0))[0];
      if (best) out.push(`${exerciseDef(ex.exerciseId, store.settings.exercises).name} ${best.kg ? `${fmt(best.kg, 1)} kg × ${best.reps}` : `${best.reps} rip.`}`);
    }
    return out;
  };

  return (
    <>
      <Card id="day.training" print="palestra" icon={<IconWorkout />} title="Allenamento" defaultOpen={true} summary={cardSummary}>
        {workouts.length === 0 && runs.length === 0 ? (
          <div className="start-pair">
            <Link className="lime-banner" to="/palestra">
              <span>Inizia allenamento</span>
              <span aria-hidden="true">›</span>
            </Link>
            <Link className="lime-banner" to="/corsa">
              <span>Inizia corsa</span>
              <span aria-hidden="true">›</span>
            </Link>
          </div>
        ) : workouts.length === 0 ? (
          <Link className="lime-banner" to="/palestra">
            <span>Inizia allenamento</span>
            <span aria-hidden="true">›</span>
          </Link>
        ) : (
          workouts.map((w) => {
            const i = info(w);
            const prs = i.running ? [] : records(w);
            return (
              <div key={w.id} className="ws-wrap">
              <button type="button" onClick={() => nav(`/palestra/allenamento/${day.date}/${w.id}`)} className={`workout-summary${i.running ? ' running' : ''}`}>
                <strong className="ws-name">{i.name}</strong>
                {i.running && <span className="ws-live">In corso</span>}
                {prs.length > 0 && (
                  <span className="pr-banner">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
                      <rect x="5" y="20" width="14" height="2" rx="1" />
                    </svg>
                    {prs.length === 1 ? `Nuovo record · ${prs[0]}` : `${prs.length} nuovi record · ${prs.join(', ')}`}
                  </span>
                )}
                <dl className="ws-stats">
                  <div>
                    <dt>Carico sollevato</dt>
                    <dd className="hi">{fmt(i.volume)} kg</dd>
                  </div>
                  <div>
                    <dt>Durata</dt>
                    <dd>{i.minutes ? (i.minutes >= 60 ? `${Math.floor(i.minutes / 60)}h ${String(i.minutes % 60).padStart(2, '0')}m` : `${i.minutes} min`) : '–'}</dd>
                  </div>
                  <div>
                    <dt>Orario</dt>
                    <dd>{i.times || '–'}</dd>
                  </div>
                </dl>
              </button>
              <button type="button" className="icon-btn small ws-more" aria-label="Altre azioni" onClick={() => setPicked(w)}>
                ⋮
              </button>
              </div>
            );
          })
        )}
        {runs.length === 0 ? (
          workouts.length > 0 && <Link className="lime-banner" to="/corsa">
            <span>Inizia corsa</span>
            <span aria-hidden="true">›</span>
          </Link>
        ) : (
          runs.map((m) => (
            <div key={m.id} className="ws-wrap">
            <button type="button" onClick={() => nav('/corsa')} className="workout-summary run">
              <strong className="ws-name">{m.title || (m.mode === 'intervals' ? m.planName ?? 'Corsa a intervalli' : m.mode === 'treadmill' ? m.planName ?? 'Tapis roulant' : 'Corsa')}</strong>
              <dl className="ws-stats">
                <div>
                  <dt>Distanza</dt>
                  <dd className="hi">{m.distanceM ? `${fmtKm(m.distanceM)} km` : '–'}</dd>
                </div>
                <div>
                  <dt>Durata</dt>
                  <dd>{m.durationSec ? fmtDuration(m.durationSec) : '–'}</dd>
                </div>
                <div>
                  <dt>Passo</dt>
                  <dd>{m.distanceM && m.durationSec ? `${fmtPace(m.distanceM, m.durationSec)}/km` : '–'}</dd>
                </div>
              </dl>
            </button>
            <button type="button" className="icon-btn small ws-more" aria-label="Altre azioni" onClick={() => setPickedRun(m)}>
              ⋮
            </button>
            </div>
          ))
        )}
        <WeekTraining date={day.date} />
      </Card>
      {picked && (
        <div className="sheet-backdrop" onClick={() => setPicked(null)}>
          <div className="sheet action-sheet" role="dialog" aria-label="Allenamento" onClick={(e) => e.stopPropagation()}>
            <div className="grabber" />
            <h2 className="sheet-title">{picked.title || 'Allenamento'}</h2>
            <button
              className="danger-banner"
              onClick={() => {
                remove(picked, 'Allenamento eliminato');
                setPicked(null);
              }}
            >
              Elimina
            </button>
            <button className="btn-ghost cancel-banner" onClick={() => setPicked(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}
      {pickedRun && (
        <div className="sheet-backdrop" onClick={() => setPickedRun(null)}>
          <div className="sheet action-sheet" role="dialog" aria-label="Corsa" onClick={(e) => e.stopPropagation()}>
            <div className="grabber" />
            <h2 className="sheet-title">{pickedRun.title || 'Corsa'}</h2>
            <button
              className="danger-banner"
              onClick={() => {
                remove(pickedRun, 'Corsa eliminata');
                setPickedRun(null);
              }}
            >
              Elimina
            </button>
            <button className="btn-ghost cancel-banner" onClick={() => setPickedRun(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Calories and protein of the day, always visible; the full food diary is on the nutrition page. */
export function NutritionBlock({ day }: { day: DayEntry }) {
  const { settings } = useStore();
  const goals = settings.goals ?? {};
  const intake = dayIntake(day);
  const kcal = intake.kcal ?? 0;
  const protein = intake.protein ?? 0;
  const logged = intake.kcal !== undefined;
  const bar = (v: number, goal?: number, thin = false) =>
    goal ? (
      <span className={`nut-bar${thin ? ' thin' : ''}`}>
        <span style={{ width: `${Math.min(100, (v / goal) * 100)}%` }} />
      </span>
    ) : null;
  return (
    <Card
      id="day.nutrition"
      print="alimentazione"
      icon={<IconFood />}
      title="Alimentazione"
      defaultOpen={true}
      summary={logged ? `${fmt(kcal)}${goals.kcalIn ? ` / ${fmt(goals.kcalIn)}` : ''} kcal · proteine ${fmt(protein)}${goals.proteinG ? ` / ${fmt(goals.proteinG)}` : ''} g` : 'Niente registrato'}
    >
      {logged && (
        <div className="nut-bars">
          <span className="nut-protein nut-kcal">
            <span>Calorie</span>
            <strong>
              {fmt(kcal)}
              {goals.kcalIn ? ` / ${fmt(goals.kcalIn)}` : ''} kcal
            </strong>
          </span>
          {bar(kcal, goals.kcalIn)}
          <span className="nut-protein">
            <span>Proteine</span>
            <strong>
              {fmt(protein)}
              {goals.proteinG ? ` / ${fmt(goals.proteinG)}` : ''} g
            </strong>
          </span>
          {bar(protein, goals.proteinG, true)}
        </div>
      )}
      <Link className="lime-banner" to={`/alimentazione/${day.date}`}>
        <span>Apri il diario alimentare</span>
        <span aria-hidden="true">›</span>
      </Link>
    </Card>
  );
}

/** Training minutes per day of the week (gym + running); the day being viewed is highlighted. */
function WeekTraining({ date }: { date: ISODate }) {
  const store = useStore();
  const monday = startOfWeek(date);
  useEffect(() => {
    store.loadRange(monday, addDays(monday, 6));
  }, [monday]);
  const now = today();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const minutes = store.day(d).modules.reduce((n, m) => {
      if (m.kind === 'workout') return n + (m.durationMin ?? (m.startedAt && !m.finishedAt ? Math.round((Date.now() - m.startedAt) / 60000) : 0));
      if (m.kind === 'run') return n + Math.round((m.durationSec ?? 0) / 60);
      return n;
    }, 0);
    return { d, minutes };
  });
  const total = days.reduce((n, x) => n + x.minutes, 0);
  if (!total) return null;
  const max = Math.max(...days.map((x) => x.minutes));
  return (
    <div className="week-train" aria-label={`Allenamento della settimana: ${dur(total)}`}>
      <div className="wt-head">
        <span className="stat-label">{monday === startOfWeek(now) ? 'Questa settimana' : 'Settimana'}</span>
        <strong>{dur(total)}</strong>
      </div>
      <div className="wt-bars">
        {days.map((x, i) => (
          <div key={x.d} className={`wt-day${x.d === date ? ' on' : ''}${x.d > now ? ' future' : ''}`} title={`${x.minutes} min`}>
            <span className="wt-track">
              <span className={`wt-bar${x.minutes ? '' : ' empty'}`} style={{ height: x.minutes ? `${Math.max(12, (x.minutes / max) * 100)}%` : undefined }} />
            </span>
            <span className="wt-label">{'LMMGVSD'[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
