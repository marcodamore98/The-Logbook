import { useEffect, useRef, useState } from 'react';
import { today } from '../../lib/dates';
import { chime } from '../../lib/sound';
import { useStore } from '../../lib/store/StoreContext';
import { bestsBefore, matchingSet, previousSession, prsOf, SET_TYPES, setTypeOf, workingSets, workoutVolume } from '../../lib/training/analytics';
import { exerciseDef, usesDistance, usesReps, usesTime, usesWeight } from '../../lib/training/exercises';
import { REST_OPTIONS, restLabel, supersetLetters } from '../../lib/training/routines';
import type { ExerciseDef, ISODate, SetType, WorkoutExercise, WorkoutModule, WorkoutSet } from '../../lib/types';
import { GlyphCheck, GlyphPlus, IconTimer } from '../icons';
import { AutoText, NumberInput, uid } from '../ui';
import { useUndo } from '../Undo';
import { useBlockDrag } from '../useBlockDrag';
import { ExAvatar } from './ExAvatar';
import { FinishFlow } from './FinishFlow';
import { ExerciseDetail } from './ExerciseDetail';
import { ExercisePicker } from './ExercisePicker';
import { useRestTimer } from './RestTimer';

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Generic list helpers shared by workouts and routines. */
export function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function linkNext<T extends { supersetId?: string }>(list: T[], i: number): T[] {
  if (i >= list.length - 1) return list;
  const id = list[i].supersetId ?? uid();
  return list.map((e, k) => (k === i || k === i + 1 ? { ...e, supersetId: id } : e));
}

export function unlink<T extends { supersetId?: string }>(list: T[], i: number): T[] {
  const id = list[i].supersetId;
  const out = list.map((e, k) => (k === i ? { ...e, supersetId: undefined } : e));
  if (id && out.filter((e) => e.supersetId === id).length === 1) return out.map((e) => (e.supersetId === id ? { ...e, supersetId: undefined } : e));
  return out;
}

/** Warm-up sets only at the start: a warm-up after a working set becomes a normal set. */
export function warmupsFirst<T extends { type?: SetType; warmup?: boolean }>(sets: T[]): T[] {
  let working = false;
  return sets.map((x) => {
    const isWarm = (x.type ?? (x.warmup ? 'warmup' : 'normal')) === 'warmup';
    if (!isWarm) working = true;
    return isWarm && working ? { ...x, type: 'normal' as SetType, warmup: undefined } : x;
  });
}

/** Supersets must stay side by side: after a move, a split group is dissolved. */
export function keepSupersets<T extends { supersetId?: string }>(list: T[]): T[] {
  const broken = new Set<string>();
  const seen = new Map<string, number>();
  list.forEach((e, i) => {
    if (!e.supersetId) return;
    const last = seen.get(e.supersetId);
    if (last !== undefined && last !== i - 1) broken.add(e.supersetId);
    seen.set(e.supersetId, i);
  });
  const counts = new Map<string, number>();
  list.forEach((e) => e.supersetId && counts.set(e.supersetId, (counts.get(e.supersetId) ?? 0) + 1));
  return list.map((e) => (e.supersetId && (broken.has(e.supersetId) || counts.get(e.supersetId)! < 2) ? { ...e, supersetId: undefined } : e));
}

/** Tap cycles the set type; "W" (warm-up) is offered only while all earlier sets are warm-ups. */
export function SetTypeBadge({ type, index, onChange, allowWarmup = true }: { type: SetType; index: number; onChange: (t: SetType) => void; allowWarmup?: boolean }) {
  const meta = SET_TYPES.find((t) => t.id === type)!;
  const cycle = SET_TYPES.filter((t) => allowWarmup || t.id !== 'warmup' || t.id === type);
  const next = cycle[(cycle.findIndex((t) => t.id === type) + 1) % cycle.length].id;
  return (
    <button type="button" className={`set-badge set-${type}`} title={`${meta.label} (tocca per cambiare)`} onClick={() => onChange(next)}>
      {meta.short || index}
    </button>
  );
}

function prevLabel(s: WorkoutSet | undefined, def: ExerciseDef) {
  if (!s) return '—';
  if (usesTime(def.kind)) return `${s.kg ? `${s.kg} kg · ` : ''}${s.seconds ?? 0}s`;
  if (usesWeight(def.kind)) return `${s.kg ?? 0} × ${s.reps}`;
  return `${s.reps} rip`;
}

/** One set row: a grid like Hevy's, with swipe-left to reveal "Elimina". */
function SetRow({
  s,
  n,
  def,
  prevSet,
  prs,
  locked,
  allowWarmup,
  onChange,
  onDone,
  onRemove,
}: {
  s: WorkoutSet;
  n: number;
  allowWarmup: boolean;
  def: ExerciseDef;
  prevSet?: WorkoutSet;
  prs: string[];
  /** An earlier set is not done yet (or a later one already is): the tick is not available. */
  locked: boolean;
  onChange: (s: WorkoutSet) => void;
  onDone: () => void;
  onRemove: () => void;
}) {
  const type = setTypeOf(s);
  const [dx, setDx] = useState(0);
  // Rows are keyed by position: after a deletion the next set takes this slot, closed.
  useEffect(() => setDx(0), [s]);
  const touch = useRef<{ x: number; y: number; base: number; lock: boolean | null } | null>(null);
  const REVEAL = 84;
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('input')) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: dx, lock: null };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = touch.current;
    if (!t) return;
    const mx = e.touches[0].clientX - t.x;
    const my = e.touches[0].clientY - t.y;
    if (t.lock === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) t.lock = Math.abs(mx) > Math.abs(my);
    if (t.lock) setDx(Math.max(-REVEAL, Math.min(0, t.base + mx)));
  };
  const onTouchEnd = () => {
    const t = touch.current;
    touch.current = null;
    if (t?.lock) setDx((v) => (v < -REVEAL / 2 ? -REVEAL : 0));
  };
  const cols = [usesWeight(def.kind), usesDistance(def.kind), usesReps(def.kind), usesTime(def.kind)].filter(Boolean).length;

  return (
    <div className={`set-wrap${dx ? ' open' : ''}`}>
      <button type="button" className="set-delete" tabIndex={dx ? 0 : -1} onClick={onRemove}>
        Elimina
      </button>
      <div
        className={`set-row${s.done ? ' done' : ''} set-row-${type}`}
        style={{ transform: `translate3d(${dx}px,0,0)`, ['--cols' as string]: cols }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <SetTypeBadge type={type} index={n} allowWarmup={allowWarmup} onChange={(t) => onChange({ ...s, type: t, warmup: undefined })} />
        <button type="button" className="prev-btn" title="Copia valori precedenti" onClick={() => prevSet && onChange({ ...s, kg: prevSet.kg, reps: prevSet.reps, seconds: prevSet.seconds })}>
          {prevLabel(prevSet, def)}
        </button>
        {usesWeight(def.kind) && <NumberInput value={s.kg} step={0.5} placeholder="kg" onChange={(kg) => onChange({ ...s, kg })} />}
        {usesDistance(def.kind) && <NumberInput value={s.km} step={0.1} placeholder="km" onChange={(km) => onChange({ ...s, km })} />}
        {usesReps(def.kind) && <NumberInput value={s.reps || undefined} placeholder="rip" onChange={(reps) => onChange({ ...s, reps: reps ?? 0 })} />}
        {usesTime(def.kind) && <NumberInput value={s.seconds} step={5} placeholder="sec" onChange={(seconds) => onChange({ ...s, seconds })} />}
        <span className="check-cell">
          <button type="button" className={`check-btn${s.done ? ' on' : ''}${locked ? ' locked' : ''}`} aria-label={s.done ? 'Segna come non fatta' : 'Segna come fatta'} aria-pressed={!!s.done} aria-disabled={locked} onClick={() => {
              if (locked) return;
              if (!s.done) chime();
              onDone();
            }}>
            <GlyphCheck />
          </button>
          {prs.length > 0 && (
            <span className="pr-crown" role="img" aria-label={`Record personale: ${prs.join(', ')}`} title={`Record: ${prs.join(', ')}`}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
                <rect x="5" y="20" width="14" height="2" rx="1" />
              </svg>
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function ExerciseBlock({
  ex,
  index,
  count,
  workout,
  date,
  letter,
  onChange,
  onMove,
  onRemove,
  onReplace,
  onLink,
  onUnlink,
  onSetDone,
}: {
  ex: WorkoutExercise;
  index: number;
  count: number;
  workout: WorkoutModule;
  date: ISODate;
  letter?: string;
  onChange: (e: WorkoutExercise) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  onReplace: () => void;
  onLink: () => void;
  onUnlink: () => void;
  /** Called instead of onChange when a set gets ticked, so the parent can start timers in the same update. */
  onSetDone: (e: WorkoutExercise) => void;
}) {
  const { settings, history } = useStore();
  const offerUndo = useUndo();
  const def = exerciseDef(ex.exerciseId, settings.exercises);
  const prev = previousSession(history, ex.exerciseId, workout.id, date);
  const bests = bestsBefore(history, ex.exerciseId, workout.id, date);
  const setAt = (k: number, s: WorkoutSet) => onChange({ ...ex, sets: warmupsFirst(ex.sets.map((x, i) => (i === k ? s : x))) });
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  let n = 0;
  const unit = def.kind === 'assisted_bodyweight' ? '−KG' : def.kind === 'weighted_bodyweight' ? '+KG' : 'KG';
  const cols = [usesWeight(def.kind) && unit, usesDistance(def.kind) && 'KM', usesReps(def.kind) && 'RIP', usesTime(def.kind) && 'SEC'].filter(Boolean) as string[];

  return (
    <div className={`exercise${ex.supersetId ? ' in-superset' : ''}`}>
      <div className="exercise-head">
        <ExAvatar muscle={def.muscle} size={42} />
        <button type="button" className="exercise-title link-title" onClick={() => setInfo(true)}>
          <strong>{def.name}</strong>
        </button>
        <div className="menu-wrap">
          <button type="button" className="icon-btn small" aria-label="Altre azioni" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            ⋮
          </button>
          {menu && (
            <>
              <div className="menu-cover" onClick={() => setMenu(false)} />
              <ul className="menu" role="menu">
                <li>
                  <button role="menuitem" onClick={() => { setMenu(false); onReplace(); }}>Sostituisci esercizio</button>
                </li>
                {index > 0 && (
                  <li>
                    <button role="menuitem" onClick={() => { onMove(-1); setMenu(false); }}>Sposta su</button>
                  </li>
                )}
                {index < count - 1 && (
                  <li>
                    <button role="menuitem" onClick={() => { onMove(1); setMenu(false); }}>Sposta giù</button>
                  </li>
                )}
                {ex.supersetId ? (
                  <li>
                    <button role="menuitem" onClick={() => { onUnlink(); setMenu(false); }}>Scollega superserie</button>
                  </li>
                ) : (
                  index < count - 1 && (
                    <li>
                      <button role="menuitem" onClick={() => { onLink(); setMenu(false); }}>Superserie con il successivo</button>
                    </li>
                  )
                )}
                <li>
                  <button role="menuitem" className="danger" onClick={() => { setMenu(false); onRemove(); }}>Rimuovi esercizio</button>
                </li>
              </ul>
            </>
          )}
        </div>
      </div>
      {letter && <span className="superset-pill">Superset {letter}</span>}

      <AutoText className="ex-notes" value={ex.notes ?? ''} placeholder="Aggiungi delle note qui…" onChange={(v) => onChange({ ...ex, notes: v || undefined })} />
      <div className="rest-line">
        <IconTimer size={22} />
        <span className="rest-word">Riposo:</span>
        <select className="rest-select" value={ex.restSec ?? 90} onChange={(e) => onChange({ ...ex, restSec: Number(e.target.value) })} aria-label="Tempo di recupero">
          {REST_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {restLabel(r)}
            </option>
          ))}
        </select>
      </div>

      <div className="sets" style={{ ['--cols' as string]: cols.length }}>
        <div className="set-head">
          <span>SERIE</span>
          <span>PRECEDENTE</span>
          {cols.map((c) => (
            <span key={c}>{c}</span>
          ))}
          <span aria-hidden="true">✓</span>
        </div>
        {ex.sets.map((s, k) => {
          const type = setTypeOf(s);
          if (type !== 'warmup') n++;
          const p = prev ? matchingSet(prev.sets, ex.sets, k) : undefined;
          return (
            <SetRow
              key={k}
              s={s}
              n={n}
              def={def}
              prevSet={p}
              prs={prsOf(s, bests)}
              allowWarmup={ex.sets.slice(0, k).every((x) => setTypeOf(x) === 'warmup')}
              locked={s.done ? ex.sets.slice(k + 1).some((x) => x.done) : ex.sets.slice(0, k).some((x) => !x.done)}
              onChange={(ns) => setAt(k, ns)}
              onRemove={() => {
                onChange({ ...ex, sets: warmupsFirst(ex.sets.filter((_, i) => i !== k)) });
                offerUndo('Serie eliminata', () => onChange(ex));
              }}
              onDone={() => {
                const next = { ...ex, sets: ex.sets.map((x, i) => (i === k ? { ...s, done: !s.done } : x)) };
                if (s.done) onChange(next);
                else onSetDone(next);
              }}
            />
          );
        })}
      </div>
      <button
        type="button"
        className="add-set"
        onClick={() => {
          const last = ex.sets.at(-1);
          onChange({ ...ex, sets: [...ex.sets, { type: last && setTypeOf(last) !== 'warmup' ? setTypeOf(last) : 'normal', reps: last?.reps ?? 0, kg: last?.kg, seconds: last?.seconds, done: false }] });
        }}
      >
        <GlyphPlus /> Aggiungi serie
      </button>
      {bests.e1rm > 0 && <p className="muted small">Record: {bests.kg} kg · 1RM stimato {Math.round(bests.e1rm)} kg</p>}
      {info && <ExerciseDetail id={ex.exerciseId} onClose={() => setInfo(false)} />}
    </div>
  );
}

export function WorkoutLogger({ value: w, onChange, date, onAbandon }: { value: WorkoutModule; onChange: (w: WorkoutModule) => void; date: ISODate; onAbandon?: () => void }) {
  const store = useStore();
  const { settings, history } = store;
  const timer = useRestTimer();
  const [picking, setPicking] = useState(false);
  const [replacing, setReplacing] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const offerUndo = useUndo();
  const [, tick] = useState(0);
  const set = (p: Partial<WorkoutModule>) => onChange({ ...w, ...p });
  const running = !!w.startedAt && !w.finishedAt;
  const letters = supersetLetters(w.exercises);

  useEffect(() => {
    store.ensureAllLoaded();
  }, [store]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const setExercises = (exercises: WorkoutExercise[]) => set({ exercises });
  // Hold an exercise's header and drag it, like the cards of the day page.
  const order = w.exercises.map((_, i) => String(i));
  const { drag, settling, onPointerDown } = useBlockDrag(order, (o) => setExercises(keepSupersets(o.map((k) => w.exercises[Number(k)]))), { attr: 'ex', handle: '.exercise-head' });
  /** Sets for an exercise just added or swapped in: last session's sets when there is one. */
  const freshSets = (exerciseId: string, fallback?: WorkoutSet[]): WorkoutSet[] => {
    const prev = previousSession(history, exerciseId, w.id, date);
    if (prev?.sets.length) return prev.sets.map((s) => ({ type: setTypeOf(s), reps: s.reps, kg: s.kg, seconds: s.seconds, done: false }));
    return fallback?.length ? fallback.map((s) => ({ type: setTypeOf(s), reps: s.reps, done: false })) : [{ type: 'normal', reps: 0, done: false }];
  };
  const volume = workoutVolume(w);
  const sets = workingSets(w);

  return (
    <div className={`workout${drag ? ' is-dragging' : ''}`} onPointerDown={onPointerDown}>
      <div className="workout-bar hevy-bar">
        <div className="stat">
          <span className="stat-cap">Durata</span>
          <span className="stat-val accent">{running ? fmtClock(Date.now() - w.startedAt!) : w.durationMin ? `${w.durationMin}′` : '–'}</span>
        </div>
        <div className="stat">
          <span className="stat-cap">Volume</span>
          <span className="stat-val">{Math.round(volume).toLocaleString('it-IT')} kg</span>
        </div>
        <div className="stat">
          <span className="stat-cap">Serie</span>
          <span className="stat-val">{sets}</span>
        </div>
      </div>
      {w.exercises.map((ex, i) => {
        const id = String(i);
        const me = drag?.id === id;
        const shift = drag && !me ? drag.shifts[id] ?? 0 : 0;
        return (
        <div
          key={i}
          data-ex={id}
          className={`blk ex-blk${me ? ' dragging' : ''}${drag && !me ? ' shifting' : ''}${settling ? ' settling' : ''}`}
          style={me ? { transform: `translate3d(0, ${drag!.dy}px, 0) scale(1.02)` } : shift ? { transform: `translate3d(0, ${shift}px, 0)` } : undefined}
        >
        <ExerciseBlock
          ex={ex}
          index={i}
          count={w.exercises.length}
          workout={w}
          date={date}
          letter={ex.supersetId ? letters.get(ex.supersetId) : undefined}
          onChange={(e) => setExercises(w.exercises.map((x, k) => (k === i ? e : x)))}
          onMove={(d) => setExercises(move(w.exercises, i, d))}
          onRemove={() => setExercises(unlink(w.exercises, i).filter((_, k) => k !== i))}
          onReplace={() => setReplacing(i)}
          onLink={() => setExercises(linkNext(w.exercises, i))}
          onUnlink={() => setExercises(unlink(w.exercises, i))}
          onSetDone={(e) => {
            // One update: the ticked set and, on the first set, the start time.
            onChange({ ...w, startedAt: w.startedAt ?? Date.now(), exercises: w.exercises.map((x, k) => (k === i ? e : x)) });
            // In a superset, rest only after the last exercise of the group.
            const next = w.exercises[i + 1];
            if (ex.supersetId && next?.supersetId === ex.supersetId) return;
            timer.start(ex.restSec ?? 90, exerciseDef(ex.exerciseId, settings.exercises).name);
          }}
        />
        </div>
        );
      })}

      <button type="button" className="add-ex" onClick={() => setPicking(true)}>
        <GlyphPlus /> Aggiungi esercizi
      </button>

      <div className="workout-actions bottom">
        {running ? (
          <button type="button" className="btn" onClick={() => setFinishing(true)}>
            Termina
          </button>
        ) : date === today() ? (
          <button type="button" className="btn" onClick={() => set({ startedAt: Date.now(), finishedAt: undefined })}>
            {w.finishedAt ? 'Riprendi' : 'Inizia allenamento'}
          </button>
        ) : null}
      </div>

      {finishing && (
        <FinishFlow
          w={w}
          date={date}
          onClose={() => setFinishing(false)}
          onSave={(patch) => {
            timer.stop();
            onChange({ ...w, ...patch });
          }}
          onAbandon={() => {
            setFinishing(false);
            onAbandon?.();
          }}
        />
      )}
      {picking && (
        <ExercisePicker
          multiple
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            setPicking(false);
            setExercises([
              ...w.exercises,
              ...ids.map((exerciseId) => ({ exerciseId, sets: freshSets(exerciseId), restSec: 90 })),
            ]);
          }}
        />
      )}
      {replacing !== null && (
        <ExercisePicker
          onClose={() => setReplacing(null)}
          onPick={([exerciseId]) => {
            const i = replacing;
            setReplacing(null);
            const old = w.exercises[i];
            if (!exerciseId || !old || exerciseId === old.exerciseId) return;
            // Same place, rest and superset; the sets come from the new exercise's last session.
            setExercises(w.exercises.map((x, k) => (k === i ? { ...x, exerciseId, sets: freshSets(exerciseId, x.sets), notes: undefined } : x)));
            offerUndo(`Sostituito con ${exerciseDef(exerciseId, settings.exercises).name}`, () => setExercises(w.exercises));
          }}
        />
      )}
    </div>
  );
}

