import { confirmDelete } from '../Confirm';
import { ManualEntryButtons } from '../ManualEntry';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dayFoodTotals, dayIntake } from '../../lib/nutrition/foods';
import { useStore } from '../../lib/store/StoreContext';
import { bestsBefore, prsOf, workingSets, workoutVolume } from '../../lib/training/analytics';
import { exerciseDef } from '../../lib/training/exercises';
import { addDays, startOfWeek, today } from '../../lib/dates';
import type { DayEntry, ISODate, RunModule, WorkoutModule } from '../../lib/types';
import { levelLabel } from '../../lib/running/program';
import { useBurned } from '../useBurned';
import { fmtDuration, fmtKm, fmtPace } from '../../lib/running/geo';
import { fmt } from '../charts';
import { runLine } from '../modules/meta';
import { IconFood, IconWorkout, Sym } from '../icons';
import { Card } from '../ui';
import { useUndo } from '../Undo';
import { MoveButton } from '../MoveSheet';

/** The judgement given at the end of a treadmill programme ("Com'è andata?"). */
const FEEL = {
  easy: ['sentiment_satisfied', 'Troppo facile'],
  ok: ['check_circle', 'Giusto così'],
  hard: ['local_fire_department', 'Troppo duro'],
} as const;

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
    return { running, name: w.title || 'Allenamento', volume: Math.round(workoutVolume(w)), sets: workingSets(w), minutes, times };
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
                    <Sym name="crown" size={16} fill />
                    {prs.length === 1 ? `Nuovo record · ${prs[0]}` : `${prs.length} nuovi record · ${prs.join(', ')}`}
                  </span>
                )}
                {i.times && <span className="ws-when">{i.times}</span>}
                <dl className="ws-stats">
                  <div>
                    <dt>Volume</dt>
                    <dd className="hi">{fmt(i.volume)}</dd>
                    <small>kg</small>
                  </div>
                  <div>
                    <dt>Serie</dt>
                    <dd>{i.sets}</dd>
                    <small>totali</small>
                  </div>
                  <div>
                    <dt>Durata</dt>
                    <dd>{i.minutes ? (i.minutes >= 60 ? `${Math.floor(i.minutes / 60)}h ${String(i.minutes % 60).padStart(2, '0')}′` : `${i.minutes}′`) : '–'}</dd>
                    <small>{i.running ? 'finora' : 'totale'}</small>
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
              {m.feel && (
                <span className="run-feel-row">
                  <span className={`run-feel f-${m.feel}`}>
                    <Sym name={FEEL[m.feel][0]} size={16} />
                    {FEEL[m.feel][1]}
                  </span>
                  {!!m.level && <span className="run-feel-level">{levelLabel(m.level)}</span>}
                </span>
              )}
              <dl className="ws-stats">
                <div>
                  <dt>Distanza</dt>
                  <dd className="hi run-hi">{m.distanceM ? fmtKm(m.distanceM) : '–'}</dd>
                  <small>km</small>
                </div>
                <div>
                  <dt>Passo</dt>
                  <dd>{m.distanceM && m.durationSec ? fmtPace(m.distanceM, m.durationSec) : '–'}</dd>
                  <small>/km</small>
                </div>
                <div>
                  <dt>Tempo</dt>
                  <dd>{m.durationSec ? fmtDuration(m.durationSec) : '–'}</dd>
                  <small>{m.durationSec && m.durationSec >= 3600 ? 'h:min:s' : 'min:s'}</small>
                </div>
              </dl>
            </button>
            <button type="button" className="icon-btn small ws-more" aria-label="Altre azioni" onClick={() => setPickedRun(m)}>
              ⋮
            </button>
            </div>
          ))
        )}
        <ManualEntryButtons date={day.date} />
        <WeekTraining date={day.date} />
      </Card>
      {picked && (
        <div className="sheet-backdrop" onClick={() => setPicked(null)}>
          <div className="sheet action-sheet" role="dialog" aria-label="Allenamento" onClick={(e) => e.stopPropagation()}>
            <div className="grabber" />
            <h2 className="sheet-title">{picked.title || 'Allenamento'}</h2>
            <MoveButton from={day.date} what="l’allenamento" target={{ kind: 'module', id: picked.id }} className="btn-ghost cancel-banner move-banner" onMoved={() => setPicked(null)} />
            <button
              className="danger-banner"
              onClick={async () => {
                if (!(await confirmDelete('questo allenamento'))) return;
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
            <MoveButton from={day.date} what="la corsa" target={{ kind: 'module', id: pickedRun.id }} className="btn-ghost cancel-banner move-banner" onMoved={() => setPickedRun(null)} />
            <button
              className="danger-banner"
              onClick={async () => {
                if (!(await confirmDelete('questa corsa'))) return;
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

/** The day's food at a glance: kcal left (goal + burned − eaten), the three macros and the water; the full diary is on its own page. */
export function NutritionBlock({ day }: { day: DayEntry }) {
  const store = useStore();
  const goals = store.settings.goals ?? {};
  const intake = dayIntake(day);
  const t = dayFoodTotals(day.food);
  const kcal = intake.kcal ?? 0;
  const logged = intake.kcal !== undefined;
  const burned = useBurned(day.date);
  const target = goals.kcalIn ? goals.kcalIn + burned.total : 0;
  const over = target > 0 && kcal > target;
  const water = day.body?.waterL ?? 0;
  const glasses = Math.round(water / 0.25);
  const slots = Math.max(goals.waterL ? Math.round(goals.waterL / 0.25) : 8, glasses);
  const addWater = () => store.updateDay(day.date, (d) => ({ ...d, body: { ...d.body, waterL: Math.round(((d.body?.waterL ?? 0) + 0.25) * 100) / 100 } }));
  const macros: [string, number | undefined, string][] = [
    ['Carbo', t?.carbs, ''],
    ['Proteine', t?.protein ?? intake.protein, ' lav'],
    ['Grassi', t?.fat, ''],
  ];
  return (
    <Card
      id="day.nutrition"
      print="alimentazione"
      icon={<IconFood />}
      title="Alimentazione"
      defaultOpen={true}
      summary={logged ? (target ? `${fmt(Math.abs(target - kcal))} kcal ${over ? 'in più' : 'rimanenti'} · ${fmt(kcal)} assunte` : `${fmt(kcal)} kcal assunte`) : 'Niente registrato'}
    >
      <div className="nut-energy">
        <div className="ne-top">
          <strong className={over ? 'over' : undefined}>{fmt(target ? Math.abs(target - kcal) : kcal)}</strong>
          <span>{target ? (over ? 'kcal in più' : 'kcal rimanenti') : 'kcal assunte'}</span>
        </div>
        {target > 0 && (
          <span className="nut-bar">
            <span className={over ? 'over' : undefined} style={{ width: `${Math.min(100, (kcal / target) * 100)}%` }} />
          </span>
        )}
        <div className="ne-foot">
          <span>{target ? `${fmt(kcal)} assunte${burned.total ? ` · ${fmt(burned.total)} bruciate` : ''}` : logged ? '' : 'Ancora niente registrato'}</span>
          {goals.kcalIn ? <span>Obiettivo {fmt(target)} kcal</span> : null}
        </div>
      </div>
      {(t || intake.protein !== undefined) && (
        <div className="nut-macros">
          {macros.map(([label, v, tone]) => (
            <div key={label} className={`nm-tile${tone}`}>
              <span>{label}</span>
              <strong>{v !== undefined ? `${fmt(v)}g` : '–'}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="nut-water no-print">
        <div className="nw-text">
          <span className="nw-head">
            <strong>Acqua</strong>
            <span className="nw-amount">
              {fmt(water, 2)} L{goals.waterL ? ` / ${fmt(goals.waterL, 1)} L` : ''}
            </span>
          </span>
          <span className="nw-glasses" aria-hidden="true">
            {Array.from({ length: slots }, (_, i) => (
              <i key={i} className={i < glasses ? 'full' : undefined} />
            ))}
          </span>
        </div>
        <button type="button" className="nw-add" onClick={addWater}>
          +250 ml
        </button>
      </div>
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
    store.loadRange(addDays(monday, -7), addDays(monday, 6));
  }, [monday]);
  const now = today();
  const minutesOn = (d: ISODate) =>
    store.day(d).modules.reduce((n, m) => {
      if (m.kind === 'workout') return n + (m.durationMin ?? (m.startedAt && !m.finishedAt ? Math.round((Date.now() - m.startedAt) / 60000) : 0));
      if (m.kind === 'run') return n + Math.round((m.durationSec ?? 0) / 60);
      return n;
    }, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    return { d, minutes: minutesOn(d) };
  });
  const total = days.reduce((n, x) => n + x.minutes, 0);
  // Compared with the week before, up to the same weekday (a week in progress against a whole one would always look worse).
  const sameDays = monday === startOfWeek(now) ? Math.min(6, Math.round((new Date(`${now}T12:00:00`).getTime() - new Date(`${monday}T12:00:00`).getTime()) / 864e5)) : 6;
  const thisPart = days.slice(0, sameDays + 1).reduce((n, x) => n + x.minutes, 0);
  const prevPart = Array.from({ length: sameDays + 1 }, (_, i) => minutesOn(addDays(monday, i - 7))).reduce((a, b) => a + b, 0);
  const change = prevPart ? Math.round(((thisPart - prevPart) / prevPart) * 100) : null;
  if (!total) return null;
  const max = Math.max(...days.map((x) => x.minutes));
  return (
    <div className="week-train" aria-label={`Allenamento della settimana: ${dur(total)}`}>
      <div className="wt-head">
        <span className="stat-label">{monday === startOfWeek(now) ? 'Questa settimana' : 'Settimana'}</span>
        {change !== null && (
          <span className={`wt-change${change >= 0 ? ' up' : ' down'}`} title={monday === startOfWeek(now) ? 'Rispetto agli stessi giorni della settimana prima' : 'Rispetto alla settimana prima'}>
            {change >= 0 ? '+' : ''}
            {change}% vs prec.
          </span>
        )}
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
