import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { today } from '../../lib/dates';
import { dayIntake, MEALS, totalsOf } from '../../lib/nutrition/foods';
import { useStore } from '../../lib/store/StoreContext';
import { bestsBefore, countsSet, e1rm, prsOf, workingSets, workoutProgress, workoutVolume } from '../../lib/training/analytics';
import { workoutFromRoutine } from '../../lib/training/routines';
import { fmtRest, useRestTimer } from '../training/RestTimer';
import { exerciseDef } from '../../lib/training/exercises';
import type { DayEntry, ISODate, Routine, WorkoutModule } from '../../lib/types';
import { fmt } from '../charts';
import { GlyphPlus, IconFood, IconWorkout } from '../icons';
import { Card, uid } from '../ui';

function prCount(w: WorkoutModule, date: ISODate, h: ReturnType<typeof useStore>['history']) {
  let n = 0;
  for (const ex of w.exercises) {
    const b = bestsBefore(h, ex.exerciseId, w.id, date);
    if (ex.sets.some((s) => prsOf(s, b).length)) n++;
  }
  return n;
}

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

/** Workouts of the day as summaries; logging happens on the workout page. */
export function TrainingBlock({ day }: { day: DayEntry }) {
  const store = useStore();
  const nav = useNavigate();
  const rest = useRestTimer();
  const [choosing, setChoosing] = useState(false);
  const workouts = day.modules.filter((m): m is WorkoutModule => m.kind === 'workout');
  const running = workouts.find((w) => w.startedAt && !w.finishedAt);
  const lines = workouts.map((w) => workoutLine(w, prCount(w, day.date, store.history)));
  const routines = store.settings.routines ?? [];

  /** Creates the workout (empty or from a saved one) and opens its page. */
  async function create(r?: Routine) {
    setChoosing(false);
    const id = uid();
    const fresh: WorkoutModule = r
      ? workoutFromRoutine(r, id, day.date, store.history)
      : { kind: 'workout', id, type: 'strength', durationMin: 0, exercises: [] };
    const w = day.date === today() ? { ...fresh, startedAt: Date.now() } : fresh;
    await store.updateDay(day.date, (d) => ({ ...d, modules: [...d.modules, w] }));
    nav(`/palestra/allenamento/${day.date}/${id}`);
  }

  const p = running ? workoutProgress(running, store.settings.exercises) : null;

  return (
    <>
    <Card
      id="day.training"
      print="palestra"
      icon={<IconWorkout />}
      title="Allenamento"
      defaultOpen={!!running}
      open={running ? true : undefined}
      summary={running ? 'In corso' : workouts.length ? lines.join(' / ') : 'Nessun allenamento'}
      actions={
        <button className="icon-btn" aria-label="Nuovo allenamento" onClick={() => setChoosing(true)}>
          <GlyphPlus />
        </button>
      }
    >
      {running && p && (
        <div className="workout-day-running">
          <strong>{running.title || 'Allenamento'} in corso</strong>
          <span className="muted">
            {p.exerciseName ? `${p.exerciseName} · serie ${p.setNo}/${p.setCount}` : 'Tutte le serie fatte'} · {p.done}/{p.total} serie
          </span>
          {rest.state.left !== null && <span className="muted">Recupero {fmtRest(rest.state.left)}</span>}
          <Link className="btn" to={`/palestra/allenamento/${day.date}/${running.id}`}>
            Riprendi l’allenamento
          </Link>
        </div>
      )}
      {workouts.length === 0 && <p className="empty">Nessun allenamento. Premi + per iniziarne uno.</p>}
      {workouts
        .filter((w) => w !== running)
        .map((w) => {
          const i = workouts.indexOf(w);
          return (
            <div key={w.id} className="summary-block">
              <div className="summary-head">
                <strong>{lines[i]}</strong>
                <Link className="btn-ghost small" to={`/palestra/allenamento/${day.date}/${w.id}`}>
                  Apri
                </Link>
              </div>
              <ul className="summary-list">
                {w.exercises.map((ex, k) => {
                  const sets = ex.sets.filter(countsSet);
                  const top = sets.reduce((b, s) => (e1rm(s.kg, s.reps) > e1rm(b?.kg, b?.reps) ? s : b), sets[0]);
                  return (
                    <li key={k}>
                      <span>{exerciseDef(ex.exerciseId, store.settings.exercises).name}</span>
                      <span className="muted">
                        {sets.length} serie{top?.kg ? ` · top ${fmt(top.kg, 1)}×${top.reps}` : top?.reps ? ` · top ${top.reps} rip` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
    </Card>
      {choosing && (
        <div className="sheet-backdrop" onClick={() => setChoosing(false)}>
          <div className="sheet" role="dialog" aria-label="Che allenamento fai?" onClick={(e) => e.stopPropagation()}>
            <div className="grabber" />
            <h2 className="sheet-title">Che allenamento fai?</h2>
            <ul className="choose-list">
              {routines.map((r) => (
                <li key={r.id}>
                  <button onClick={() => create(r)}>{r.name}</button>
                </li>
              ))}
              <li>
                <button className="new" onClick={() => create()}>
                  <GlyphPlus /> Allenamento nuovo
                </button>
              </li>
            </ul>
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
      <Link className="btn-ghost small" to={`/alimentazione/${day.date}`}>
        Apri il diario alimentare
      </Link>
    </Card>
  );
}
