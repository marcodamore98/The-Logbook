import { useSwipeNav } from '../components/useSwipeNav';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fmt } from '../components/charts';
import { GlyphCheck, GlyphClose, GlyphNext, GlyphPlus, GlyphPrev, GlyphTrash, IconBreakfast, IconDinner, IconLunch, IconSnack, IconWater } from '../components/icons';
import { FoodSheet } from '../components/nutrition/FoodSheet';
import { useUndo } from '../components/Undo';
import { NumberInput } from '../components/ui';
import { addDays, fromISO, today } from '../lib/dates';
import { dayIntake, MEALS, totalsOf } from '../lib/nutrition/foods';
import { useStore } from '../lib/store/StoreContext';
import type { FoodEntry, FoodLog, MealId, MealPlanItem } from '../lib/types';

/** Half-circle gauge like Lifesum: remaining kcal in the middle, eaten on the left, burned on the right. */
function Gauge({ eaten, goal, burned }: { eaten: number; goal?: number; burned?: number }) {
  const target = goal ? goal + (burned ?? 0) : 0;
  const pct = target ? Math.min(1, eaten / target) : 0;
  const over = target > 0 && eaten > target;
  const R = 92;
  const L = Math.PI * R;
  const arc = `M 18 110 A ${R} ${R} 0 0 1 202 110`;
  return (
    <section className="card kcal-gauge">
      <div className="kg-plot">
        <svg viewBox="0 0 220 122" role="img" aria-label={`Calorie: ${fmt(eaten)} di ${target ? fmt(target) : '—'}`}>
          <path d={arc} className="kg-track" />
          {pct > 0 && <path d={arc} className={`kg-fill${over ? ' over' : ''}`} strokeDasharray={`${pct * L} ${L}`} />}
        </svg>
        <div className="kg-center">
          {target ? (
            <>
              <strong>{fmt(Math.abs(target - eaten))}</strong>
              <span>{over ? 'kcal in più' : 'Rimanenti'}</span>
            </>
          ) : (
            <>
              <strong>{fmt(eaten)}</strong>
              <span>kcal assunte</span>
            </>
          )}
        </div>
      </div>
      <div className="kg-sides">
        <span>
          <strong>{fmt(eaten)}</strong>
          Assunte
        </span>
        <span className="kg-goal">{goal ? `Obiettivo ${fmt(goal)} kcal` : 'Nessun obiettivo'}</span>
        <span>
          <strong>{burned ? fmt(burned) : 0}</strong>
          Bruciate
        </span>
      </div>
      {!goal && <p className="muted small kg-hint">Imposta gli obiettivi di calorie e macronutrienti nel “Riepilogo del giorno” (scorri dal bordo destro) → Obiettivi.</p>}
    </section>
  );
}

function MacroCard({ label, value, goal, tone }: { label: string; value: number; goal?: number; tone: string }) {
  return (
    <div className={`macro-card tone-${tone}`}>
      <span className="mc-label">{label}</span>
      <span className="mc-track">
        <span
          style={{
            width: `${goal ? Math.min(100, (value / goal) * 100) : 0}%`,
          }}
        />
      </span>
      <span className="mc-value">
        <strong>{fmt(value)}</strong>
        {goal ? `/${fmt(goal)}` : ''}g
      </span>
    </div>
  );
}

/** Suggested share of the daily calories for each meal. */
const SHARE: Record<MealId, [number, number]> = {
  breakfast: [0.2, 0.3],
  lunch: [0.3, 0.4],
  dinner: [0.25, 0.35],
  snack: [0.05, 0.15],
};

/** Meal for the current time of day, used by the floating "+". */
const mealNow = (): MealId => {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
};

const REVEAL = 108;

/**
 * One food in the log. Swipe left to show "Elimina" (or all the way to delete at once),
 * hold to start selecting several foods, tap to open grams and "Sposta in".
 */
function FoodRow({
  e,
  selecting,
  selected,
  open,
  onTap,
  onHold,
  onDelete,
  children,
}: {
  e: FoodEntry;
  selecting: boolean;
  selected: boolean;
  open: boolean;
  onTap: () => void;
  onHold: () => void;
  onDelete: () => void;
  children?: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const g = useRef<{
    x: number;
    y: number;
    base: number;
    lock: 'x' | 'y' | null;
    w: number;
  } | null>(null);
  const hold = useRef(0);
  const held = useRef(false);
  useEffect(() => {
    if (selecting) setDx(0);
  }, [selecting]);
  useEffect(() => () => window.clearTimeout(hold.current), []);

  return (
    <li className={`food-item${selected ? ' selected' : ''}`}>
      <div
        className={`food-swipe${dx ? ' open' : ''}`}
        data-no-swipe
        onContextMenu={(ev) => {
          ev.preventDefault();
          if (!held.current && !selecting) onHold();
        }}
        onTouchStart={(ev) => {
          const t = ev.touches[0];
          held.current = false;
          g.current = {
            x: t.clientX,
            y: t.clientY,
            base: dx,
            lock: null,
            w: ev.currentTarget.offsetWidth,
          };
          window.clearTimeout(hold.current);
          hold.current = window.setTimeout(() => {
            if (g.current && !g.current.lock) {
              held.current = true;
              g.current = null;
              setDx(0);
              navigator.vibrate?.(15);
              onHold();
            }
          }, 450);
        }}
        onTouchMove={(ev) => {
          const c = g.current;
          if (!c) return;
          const t = ev.touches[0];
          const mx = t.clientX - c.x;
          const my = t.clientY - c.y;
          if (!c.lock) {
            if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
            window.clearTimeout(hold.current);
            c.lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
            if (c.lock === 'x' && !selecting) setDrag(true);
          }
          if (c.lock === 'x' && !selecting) setDx(Math.min(0, c.base + mx));
        }}
        onTouchEnd={() => {
          window.clearTimeout(hold.current);
          const c = g.current;
          g.current = null;
          setDrag(false);
          if (!c || c.lock !== 'x' || selecting) return;
          if (dx < -c.w * 0.45) {
            setDx(-c.w);
            window.setTimeout(onDelete, 160);
          } else setDx(dx < -REVEAL / 2 ? -REVEAL : 0);
        }}
      >
        <button className="food-swipe-delete" style={{ width: Math.max(REVEAL, -dx) }} tabIndex={dx ? 0 : -1} onClick={onDelete}>
          <GlyphTrash />
          Elimina
        </button>
        <button
          className={`food-entry${open ? ' on' : ''}`}
          style={{
            transform: dx ? `translate3d(${dx}px,0,0)` : undefined,
            transition: drag ? 'none' : undefined,
          }}
          onClick={() => {
            if (held.current) {
              held.current = false;
              return;
            }
            if (dx) return setDx(0);
            onTap();
          }}
        >
          {selecting && (
            <span className="food-check" aria-hidden="true">
              {selected && <GlyphCheck />}
            </span>
          )}
          <span className="food-name">
            {e.name}
            {e.brand && <span className="muted"> · {e.brand}</span>}
          </span>
          <span className="food-meta">
            {e.grams ? `${fmt(e.grams)} g · ` : ''}P {fmt(e.protein, 1)} · C {fmt(e.carbs, 1)} · G {fmt(e.fat, 1)}
          </span>
          <span className="food-kcal">
            {fmt(e.kcal)}
            <small> kcal</small>
          </span>
        </button>
      </div>
      {children}
    </li>
  );
}

/** Calories of the last 7 days, with the goal as a dashed line and the day in view in lime. */
function WeekKcal({ days, goal, current }: { days: { d: string; label: string; value: number }[]; goal?: number; current: string }) {
  const max = Math.max(goal ?? 0, ...days.map((x) => x.value), 1) * 1.08;
  const avg = days.filter((x) => x.value > 0);
  return (
    <section className="card week-kcal">
      <div className="wk-head">
        <div>
          <h2>Ultimi 7 giorni</h2>
          <span className="muted small">Calorie assunte</span>
        </div>
        {avg.length > 0 && <strong>{fmt(Math.round(avg.reduce((n, x) => n + x.value, 0) / avg.length))} kcal media</strong>}
      </div>
      <div className="wk-plot">
        {goal ? (
          <span className="wk-goal" style={{ bottom: `${(goal / max) * 100}%` }}>
            <span>{fmt(goal)}</span>
          </span>
        ) : null}
        {days.map((x) => (
          <div key={x.d} className={`wk-col${x.d === current ? ' on' : ''}`} title={`${fmt(x.value)} kcal`}>
            <span
              className="wk-bar"
              style={{
                height: `${Math.max(x.value ? 3 : 1.5, (x.value / max) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="wk-labels">
        {days.map((x) => (
          <span key={x.d} className={x.d === current ? 'on' : ''}>
            {x.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function MealIcon({ id }: { id: MealId }) {
  const I = {
    breakfast: IconBreakfast,
    lunch: IconLunch,
    dinner: IconDinner,
    snack: IconSnack,
  }[id];
  return <I size={34} />;
}

export default function NutritionPage() {
  const params = useParams();
  const date = params.date ?? today();
  const nav = useNavigate();
  const store = useStore();
  const goals = store.settings.goals ?? {};
  const day = store.day(date);
  const log: FoodLog = day.food ?? { meals: {} };
  const [adding, setAdding] = useState<MealId | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const offerUndo = useUndo();

  useEffect(() => {
    store.loadRange(addDays(date, -7), date);
    setPicked(null);
    setEditing(null);
  }, [date]);

  const setLog = (fn: (l: FoodLog) => FoodLog) => store.updateDay(date, (d) => ({ ...d, food: fn(d.food ?? { meals: {} }) }));
  const all = Object.values(log.meals).flat().filter(Boolean) as FoodEntry[];
  const t = totalsOf(all);
  const burned = day.body?.kcalOut;

  /** Remove foods by id from every meal, with "Annulla" in the snackbar. */
  const remove = (ids: Set<string>) => {
    const before = log.meals;
    setLog((l) => ({
      ...l,
      meals: Object.fromEntries(Object.entries(l.meals).map(([k, v]) => [k, (v ?? []).filter((x) => !ids.has(x.id))])),
    }));
    offerUndo(ids.size === 1 ? 'Alimento eliminato' : `${ids.size} alimenti eliminati`, () => setLog((l) => ({ ...l, meals: before })));
    setEditing(null);
  };
  const moveTo = (ids: Set<string>, to: MealId) => {
    setLog((l) => {
      const moving = Object.values(l.meals)
        .flat()
        .filter((x): x is FoodEntry => !!x && ids.has(x.id));
      const meals = Object.fromEntries(Object.entries(l.meals).map(([k, v]) => [k, (v ?? []).filter((x) => !ids.has(x.id))]));
      return {
        ...l,
        meals: { ...meals, [to]: [...(meals[to] ?? []), ...moving] },
      };
    });
  };
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p ?? []);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n.size ? n : null;
    });
  const water = day.body?.waterL ?? 0;

  const week = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6)).map((d) => ({
    d,
    label: 'DLMMGVS'[fromISO(d).getDay()],
    value: dayIntake(store.day(d)).kcal ?? 0,
  }));

  const swipeRef = useSwipeNav<HTMLDivElement>(
    () => nav(`/alimentazione/${addDays(date, -1)}`),
    () => nav(`/alimentazione/${addDays(date, 1)}`),
    date,
  );

  return (
    <div ref={swipeRef} className="page nutrition-page swipe-page">
      <header className="page-head day-strip">
        <button className="icon-btn" aria-label="Giorno precedente" onClick={() => nav(`/alimentazione/${addDays(date, -1)}`)}>
          <GlyphPrev />
        </button>
        <div className="page-title">
          <h1 className="nut-date">
            {date === today() ? 'Oggi' : fromISO(date).toLocaleDateString('it-IT', { weekday: 'long' })},{' '}
            {fromISO(date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace('.', '')}
          </h1>
        </div>
        <button className="icon-btn" aria-label="Giorno successivo" onClick={() => nav(`/alimentazione/${addDays(date, 1)}`)}>
          <GlyphNext />
        </button>
      </header>

      <Gauge eaten={t.kcal} goal={goals.kcalIn} burned={burned} />

      <div className="macro-cards">
        <MacroCard tone="lime" label="Carboidrati" value={t.carbs} goal={goals.carbsG} />
        <MacroCard tone="lav" label="Proteine" value={t.protein} goal={goals.proteinG} />
        <MacroCard tone="sky" label="Grassi" value={t.fat} goal={goals.fatG} />
      </div>

      <h2 className="log-kicker">Registro alimentare</h2>

      {(store.settings.mealPlans ?? []).length > 0 && (
        <div className="row plan-row">
          <select
            value=""
            aria-label="Applica un piano alimentare"
            onChange={(e) => {
              const plan = store.settings.mealPlans!.find((p) => p.id === e.target.value);
              if (!plan) return;
              const replace = all.length > 0 && window.confirm('Sostituire i pasti già registrati oggi? (Annulla = aggiungi al diario)');
              setLog((l) => {
                const meals = { ...(replace ? {} : l.meals) };
                for (const [meal, items] of Object.entries(plan.meals) as [MealId, MealPlanItem[]][]) {
                  meals[meal] = [
                    ...(meals[meal] ?? []),
                    ...items.map((it) => ({
                      ...it,
                      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
                    })),
                  ];
                }
                return { ...l, meals };
              });
            }}
          >
            <option value="">Applica un piano alimentare…</option>
            {store.settings.mealPlans!.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.targets?.kcal ? ` · ${fmt(p.targets.kcal)} kcal` : ''}
              </option>
            ))}
          </select>
          <span className="muted small">poi modifica le quantità come vuoi</span>
        </div>
      )}

      {MEALS.map((m) => {
        const entries = log.meals[m.id] ?? [];
        const mt = totalsOf(entries);
        const yesterday = store.day(addDays(date, -1)).food?.meals[m.id] ?? [];
        const [lo, hi] = SHARE[m.id];
        return (
          <section key={m.id} className="card meal-card">
            <div className="meal-head">
              <MealIcon id={m.id} />
              <div className="meal-title">
                <h2>{m.label}</h2>
                <span className="meal-sub">
                  {entries.length > 0
                    ? `${fmt(mt.kcal)} kcal · P ${fmt(mt.protein)} · C ${fmt(mt.carbs)} · G ${fmt(mt.fat)}`
                    : goals.kcalIn
                      ? `Consigliato ${fmt(Math.round(goals.kcalIn * lo))} - ${fmt(Math.round(goals.kcalIn * hi))} kcal`
                      : 'Niente registrato'}
                </span>
              </div>
              <button className="meal-add" aria-label={`Aggiungi a ${m.label}`} onClick={() => setAdding(m.id)}>
                <GlyphPlus />
              </button>
            </div>
            {entries.length === 0 && yesterday.length > 0 && (
              <button
                className="btn-ghost small meal-copy"
                onClick={() =>
                  setLog((l) => ({
                    ...l,
                    meals: {
                      ...l.meals,
                      [m.id]: yesterday.map((e) => ({
                        ...e,
                        id: crypto.randomUUID?.() ?? `${e.id}-c`,
                      })),
                    },
                  }))
                }
              >
                Copia da ieri ({yesterday.length})
              </button>
            )}
            {entries.length > 0 && (
              <ul className="food-list">
                {entries.map((e) => (
                  <FoodRow
                    key={e.id}
                    e={e}
                    selecting={!!picked}
                    selected={!!picked?.has(e.id)}
                    open={editing === e.id}
                    onTap={() => (picked ? toggle(e.id) : setEditing(editing === e.id ? null : e.id))}
                    onHold={() => {
                      setEditing(null);
                      toggle(e.id);
                    }}
                    onDelete={() => remove(new Set([e.id]))}
                  >
                    {editing === e.id && !picked && (
                      <div className="food-edit">
                        {e.grams > 0 && (
                          <label className="side-input">
                            <NumberInput
                              value={e.grams}
                              step={5}
                              onChange={(g) => {
                                if (!g) return;
                                const k = g / e.grams;
                                const scale = (n: number) => Math.round(n * k * 10) / 10;
                                setLog((l) => ({
                                  ...l,
                                  meals: {
                                    ...l.meals,
                                    [m.id]: (l.meals[m.id] ?? []).map((x) =>
                                      x.id === e.id
                                        ? {
                                            ...x,
                                            grams: g,
                                            kcal: Math.round(x.kcal * k),
                                            protein: scale(x.protein),
                                            carbs: scale(x.carbs),
                                            fat: scale(x.fat),
                                            fiber: x.fiber !== undefined ? scale(x.fiber) : undefined,
                                          }
                                        : x,
                                    ),
                                  },
                                }));
                              }}
                            />
                            <span className="unit">g</span>
                          </label>
                        )}
                        <select value={m.id} aria-label="Sposta in" onChange={(ev) => moveTo(new Set([e.id]), ev.target.value as MealId)}>
                          {MEALS.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.label}
                            </option>
                          ))}
                        </select>
                        <button className="icon-btn small" aria-label="Elimina" onClick={() => remove(new Set([e.id]))}>
                          <GlyphTrash />
                        </button>
                      </div>
                    )}
                  </FoodRow>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section className="card water">
        <div className="card-head">
          <IconWater />
          <h2>Acqua</h2>
          <span className="water-amount">
            {fmt(water, 2)} L{goals.waterL ? ` / ${fmt(goals.waterL, 1)} L` : ''}
          </span>
        </div>
        <div className="glasses" role="group" aria-label="Bicchieri d'acqua (250 ml)">
          {Array.from({ length: Math.max(8, Math.ceil(water / 0.25) + 1) }, (_, i) => {
            const full = i < Math.round(water / 0.25);
            return (
              <button
                key={i}
                className={`glass${full ? ' full' : ''}`}
                aria-label={full ? 'Togli un bicchiere' : 'Aggiungi un bicchiere'}
                onClick={() =>
                  store.updateDay(date, (d) => ({
                    ...d,
                    body: {
                      ...d.body,
                      waterL: full ? i * 0.25 : (i + 1) * 0.25,
                    },
                  }))
                }
              >
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                  <path d="M6 3h12l-1.6 17a1.5 1.5 0 0 1-1.5 1.4H9.1a1.5 1.5 0 0 1-1.5-1.4z" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  {full && <path d="M7.2 9h9.6l-1 11a1 1 0 0 1-1 .9H9.2a1 1 0 0 1-1-.9z" className="water-fill" />}
                </svg>
              </button>
            );
          })}
          <button
            className="water-add"
            onClick={() =>
              store.updateDay(date, (d) => ({
                ...d,
                body: {
                  ...d.body,
                  waterL: Math.round(((d.body?.waterL ?? 0) + 0.25) * 100) / 100,
                },
              }))
            }
          >
            + 250 ml
          </button>
        </div>
      </section>

      <WeekKcal days={week} goal={goals.kcalIn} current={date} />

      {picked ? (
        <div className="select-bar" role="toolbar" aria-label="Alimenti selezionati">
          <button className="icon-btn" aria-label="Annulla la selezione" onClick={() => setPicked(null)}>
            <GlyphClose />
          </button>
          <strong>{picked.size === 1 ? '1 selezionato' : `${picked.size} selezionati`}</strong>
          <select
            value=""
            aria-label="Sposta in"
            onChange={(ev) => {
              if (!ev.target.value) return;
              moveTo(picked, ev.target.value as MealId);
              setPicked(null);
            }}
          >
            <option value="">Sposta in…</option>
            {MEALS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          <button
            className="select-delete"
            onClick={() => {
              remove(picked);
              setPicked(null);
            }}
          >
            <GlyphTrash />
            Elimina
          </button>
        </div>
      ) : (
        !adding && (
          <button className="fab" aria-label="Aggiungi un alimento" onClick={() => setAdding(date === today() ? mealNow() : 'lunch')}>
            <GlyphPlus />
          </button>
        )
      )}

      {adding && (
        <FoodSheet
          meal={adding}
          onClose={() => setAdding(null)}
          onAdd={(meal, e) => {
            setLog((l) => ({
              ...l,
              meals: { ...l.meals, [meal]: [...(l.meals[meal] ?? []), e] },
            }));
            setAdding(null);
          }}
        />
      )}
    </div>
  );
}
