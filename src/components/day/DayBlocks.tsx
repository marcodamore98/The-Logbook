import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dayIntake, MEALS, totalsOf } from '../../lib/nutrition/foods';
import { useStore } from '../../lib/store/StoreContext';
import { workingSets, workoutVolume } from '../../lib/training/analytics';
import type { DayEntry, WorkoutModule } from '../../lib/types';
import { fmt } from '../charts';
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
  const [, tickNow] = useState(0);
  const workouts = day.modules.filter((m): m is WorkoutModule => m.kind === 'workout');
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
    : 'Nessun allenamento';

  return (
    <>
      <Card id="day.training" print="palestra" icon={<IconWorkout />} title="Allenamento" defaultOpen={true} summary={summary}>
        {workouts.length === 0 ? (
          <Link className="lime-banner" to="/palestra">
            <span>Inizia allenamento</span>
            <span aria-hidden="true">›</span>
          </Link>
        ) : (
          workouts.map((w) => {
            const i = info(w);
            return (
              <Link key={w.id} to={`/palestra/allenamento/${day.date}/${w.id}`} className={`workout-summary${i.running ? ' running' : ''}`}>
                <strong className="ws-name">{i.name}</strong>
                {i.running && <span className="ws-live">In corso · tocca per riprendere</span>}
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
              </Link>
            );
          })
        )}
      </Card>
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
