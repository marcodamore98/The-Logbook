import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dayIntake, MEALS, totalsOf } from '../../lib/nutrition/foods';
import { useStore } from '../../lib/store/StoreContext';
import { workingSets, workoutVolume } from '../../lib/training/analytics';
import type { DayEntry, RunModule, WorkoutModule } from '../../lib/types';
import { fmtDuration, fmtKm, fmtPace } from '../../lib/running/geo';
import { fmt } from '../charts';
import { runLine } from '../modules/meta';
import { IconFood, IconWorkout } from '../icons';
import { Card } from '../ui';

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

  return (
    <>
      <Card id="day.training" print="palestra" icon={<IconWorkout />} title="Allenamento" defaultOpen={true} summary={cardSummary}>
        {workouts.length === 0 ? (
          <Link className="lime-banner" to="/palestra">
            <span>Inizia allenamento</span>
            <span aria-hidden="true">›</span>
          </Link>
        ) : (
          workouts.map((w) => {
            const i = info(w);
            return (
              <button key={w.id} type="button" onClick={() => setPicked(w)} className={`workout-summary${i.running ? ' running' : ''}`}>
                <strong className="ws-name">{i.name}</strong>
                {i.running && <span className="ws-live">In corso</span>}
                <dl className="ws-stats">
                  <div>
                    <dt>Carico sollevato</dt>
                    <dd>{fmt(i.volume)} kg</dd>
                  </div>
                  <div>
                    <dt>Durata</dt>
                    <dd>{i.minutes ? dur(i.minutes) : '–'}</dd>
                  </div>
                  <div>
                    <dt>Orario</dt>
                    <dd>{i.times || '–'}</dd>
                  </div>
                </dl>
              </button>
            );
          })
        )}
        {runs.length === 0 ? (
          <Link className="lime-banner" to="/corsa">
            <span>Inizia corsa</span>
            <span aria-hidden="true">›</span>
          </Link>
        ) : (
          runs.map((m) => (
            <button key={m.id} type="button" onClick={() => setPickedRun(m)} className="workout-summary run">
              <strong className="ws-name">{m.title || (m.mode === 'intervals' ? m.planName ?? 'Corsa a intervalli' : 'Corsa')}</strong>
              <dl className="ws-stats">
                <div>
                  <dt>Distanza</dt>
                  <dd>{m.distanceM ? `${fmtKm(m.distanceM)} km` : '–'}</dd>
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
          ))
        )}
      </Card>
      {picked && (
        <div className="sheet-backdrop" onClick={() => setPicked(null)}>
          <div className="sheet action-sheet" role="dialog" aria-label="Allenamento" onClick={(e) => e.stopPropagation()}>
            <div className="grabber" />
            <h2 className="sheet-title">{picked.title || 'Allenamento'}</h2>
            <button className="lime-banner" onClick={() => nav(`/palestra/allenamento/${day.date}/${picked.id}`)}>
              <span>{picked.startedAt && !picked.finishedAt ? 'Riprendi allenamento' : 'Apri allenamento'}</span>
              <span aria-hidden="true">›</span>
            </button>
            <button
              className="danger-banner"
              onClick={() => {
                store.updateDay(day.date, (d) => ({ ...d, modules: d.modules.filter((m) => m.id !== picked.id) }));
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
            <button className="lime-banner" onClick={() => nav('/corsa')}>
              <span>Apri Corsa</span>
              <span aria-hidden="true">›</span>
            </button>
            <button
              className="danger-banner"
              onClick={() => {
                store.updateDay(day.date, (d) => ({ ...d, modules: d.modules.filter((m) => m.id !== pickedRun.id) }));
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

/** Calories and protein of the day; the full food diary is on the nutrition page. */
export function NutritionBlock({ day }: { day: DayEntry }) {
  const { settings } = useStore();
  const goals = settings.goals ?? {};
  const intake = dayIntake(day);
  const meals = MEALS.map((m) => ({ ...m, t: totalsOf(day.food?.meals[m.id] ?? []), n: day.food?.meals[m.id]?.length ?? 0 }));
  const kcal = intake.kcal ?? 0;
  const protein = intake.protein ?? 0;
  const summary =
    intake.kcal !== undefined
      ? `${fmt(kcal)}${goals.kcalIn ? ` / ${fmt(goals.kcalIn)}` : ''} kcal · proteine ${fmt(protein)}${goals.proteinG ? ` / ${fmt(goals.proteinG)}` : ''} g`
      : 'Niente registrato';
  return (
    <Card id="day.nutrition" print="alimentazione" icon={<IconFood />} title="Alimentazione" defaultOpen={false} summary={summary}>
      <div className="focus-row">
        <div className="focus">
          <span className="focus-label">Calorie</span>
          <strong>{fmt(kcal)}</strong>
          {goals.kcalIn ? (
            <span className="meter">
              <span className="meter-fill" style={{ width: `${Math.min(100, (kcal / goals.kcalIn) * 100)}%` }} />
            </span>
          ) : null}
          <span className="muted small">{goals.kcalIn ? `obiettivo ${fmt(goals.kcalIn)} kcal` : 'kcal'}</span>
        </div>
        <div className="focus">
          <span className="focus-label">Proteine</span>
          <strong>{fmt(protein)} g</strong>
          {goals.proteinG ? (
            <span className="meter">
              <span className="meter-fill" style={{ width: `${Math.min(100, (protein / goals.proteinG) * 100)}%` }} />
            </span>
          ) : null}
          <span className="muted small">{goals.proteinG ? `obiettivo ${fmt(goals.proteinG)} g` : ''}</span>
        </div>
      </div>
      {intake.fromLog && (
        <ul className="summary-list">
          {meals
            .filter((m) => m.n)
            .map((m) => (
              <li key={m.id}>
                <span>{m.label}</span>
                <span className="muted">
                  {fmt(m.t.kcal)} kcal · P {fmt(m.t.protein)} g
                </span>
              </li>
            ))}
        </ul>
      )}
      <Link className="lime-banner" to={`/alimentazione/${day.date}`}>
        <span>Apri il diario alimentare</span>
        <span aria-hidden="true">›</span>
      </Link>
    </Card>
  );
}
