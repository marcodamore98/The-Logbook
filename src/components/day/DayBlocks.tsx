import { Link, useNavigate } from 'react-router-dom';
import { dayIntake, MEALS, totalsOf } from '../../lib/nutrition/foods';
import { useStore } from '../../lib/store/StoreContext';
import { bestsBefore, countsSet, e1rm, prsOf, workingSets, workoutVolume } from '../../lib/training/analytics';
import { exerciseDef } from '../../lib/training/exercises';
import type { DayEntry, ISODate, WorkoutModule } from '../../lib/types';
import { labelOf, WORKOUT_TYPES } from '../../lib/vocab';
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
    w.title || labelOf(WORKOUT_TYPES, w.type),
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
  const workouts = day.modules.filter((m): m is WorkoutModule => m.kind === 'workout');
  const lines = workouts.map((w) => workoutLine(w, prCount(w, day.date, store.history)));

  async function create() {
    const id = uid();
    await store.updateDay(day.date, (d) => ({ ...d, modules: [...d.modules, { kind: 'workout', id, type: 'strength', durationMin: 0, exercises: [] }] }));
    nav(`/palestra/allenamento/${day.date}/${id}`);
  }

  return (
    <Card
      id="day.training"
      print="palestra"
      icon={<IconWorkout />}
      title="Allenamento"
      defaultOpen={false}
      summary={workouts.length ? lines.join(' / ') : 'Nessun allenamento'}
      actions={
        <button className="icon-btn" aria-label="Nuovo allenamento" onClick={create}>
          <GlyphPlus />
        </button>
      }
    >
      {workouts.length === 0 && (
        <p className="empty">
          Nessun allenamento. Avvialo da <Link to="/palestra">Palestra</Link> o con il +.
        </p>
      )}
      {workouts.map((w, i) => (
        <div key={w.id} className="summary-block">
          <div className="summary-head">
            <strong>{lines[i]}</strong>
            <Link className="btn-ghost small" to={`/palestra/allenamento/${day.date}/${w.id}`}>
              {w.startedAt && !w.finishedAt ? 'Continua' : 'Apri registro'}
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
      ))}
    </Card>
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
