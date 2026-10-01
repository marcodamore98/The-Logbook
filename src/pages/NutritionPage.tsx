import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Columns, fmt } from '../components/charts';
import { GlyphNext, GlyphPlus, GlyphPrev, GlyphTrash, IconBreakfast, IconDinner, IconLunch, IconSnack, IconWater } from '../components/icons';
import { FoodSheet } from '../components/nutrition/FoodSheet';
import { Card, NumberInput } from '../components/ui';
import { addDays, formatLong, fromISO, today } from '../lib/dates';
import { dayIntake, MEALS, totalsOf } from '../lib/nutrition/foods';
import { useStore } from '../lib/store/StoreContext';
import type { FoodEntry, FoodLog, MealId, MealPlanItem } from '../lib/types';

/** Calories ring: eaten vs goal, single hue, remaining in the centre. */
function Ring({ eaten, goal, burned }: { eaten: number; goal?: number; burned?: number }) {
  const target = (goal ?? 0) + (burned ?? 0);
  const pct = target ? Math.min(1, eaten / target) : 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  const over = target > 0 && eaten > target;
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 120 120" width="150" height="150" role="img" aria-label={`Calorie: ${eaten} di ${target || '—'}`}>
        <circle cx="60" cy="60" r={R} className="ring-track" />
        <circle
          cx="60"
          cy="60"
          r={R}
          className={`ring-fill${over ? ' over' : ''}`}
          strokeDasharray={`${pct * C} ${C}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="ring-center">
        {target ? (
          <>
            <strong>{fmt(Math.abs(target - eaten))}</strong>
            <span>{over ? 'kcal in più' : 'kcal rimanenti'}</span>
          </>
        ) : (
          <>
            <strong>{fmt(eaten)}</strong>
            <span>kcal</span>
          </>
        )}
      </div>
    </div>
  );
}

function MacroBar({ label, value, goal }: { label: string; value: number; goal?: number }) {
  return (
    <div className="macro">
      <span className="macro-label">{label}</span>
      <span className="meter">
        <span className="meter-fill" style={{ width: `${goal ? Math.min(100, (value / goal) * 100) : 0}%` }} />
      </span>
      <span className="macro-value">
        {fmt(value)}
        {goal ? ` / ${fmt(goal)}` : ''} g
      </span>
    </div>
  );
}

function MealIcon({ id }: { id: MealId }) {
  const I = { breakfast: IconBreakfast, lunch: IconLunch, dinner: IconDinner, snack: IconSnack }[id];
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

  useEffect(() => {
    store.loadRange(addDays(date, -7), date);
  }, [date]);

  const setLog = (fn: (l: FoodLog) => FoodLog) => store.updateDay(date, (d) => ({ ...d, food: fn(d.food ?? { meals: {} }) }));
  const all = Object.values(log.meals).flat().filter(Boolean) as FoodEntry[];
  const t = totalsOf(all);
  const burned = day.body?.kcalOut;
  const water = day.body?.waterL ?? 0;

  const week = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6)).map((d) => ({
    label: fromISO(d).toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 3),
    full: fromISO(d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' }),
    value: dayIntake(store.day(d)).kcal ?? 0,
  }));

  return (
    <div className="page nutrition-page">
      <header className="page-head">
        <button className="icon-btn" aria-label="Giorno precedente" onClick={() => nav(`/alimentazione/${addDays(date, -1)}`)}>
          <GlyphPrev />
        </button>
        <div className="page-title">
          <h1 className="capitalize">{formatLong(date)}</h1>
          <Link to={`/giorno/${date}`} className="link-quiet">
            pagina del giorno
          </Link>
        </div>
        <button className="icon-btn" aria-label="Giorno successivo" onClick={() => nav(`/alimentazione/${addDays(date, 1)}`)}>
          <GlyphNext />
        </button>
      </header>

      <section className="card nutrition-summary">
        <Ring eaten={t.kcal} goal={goals.kcalIn} burned={burned} />
        <div className="summary-side">
          <div className="summary-nums">
            <div>
              <strong>{fmt(t.kcal)}</strong>
              <span>mangiate</span>
            </div>
            <div>
              <strong>{goals.kcalIn ? fmt(goals.kcalIn) : '—'}</strong>
              <span>obiettivo</span>
            </div>
            <div>
              <strong>{burned ? fmt(burned) : '—'}</strong>
              <span>attive</span>
            </div>
          </div>
          <MacroBar label="Proteine" value={t.protein} goal={goals.proteinG} />
          <MacroBar label="Carboidrati" value={t.carbs} goal={goals.carbsG} />
          <MacroBar label="Grassi" value={t.fat} goal={goals.fatG} />
          {!goals.kcalIn && <p className="muted small">Imposta gli obiettivi di calorie e macronutrienti nella barra “Corpo” → Obiettivi.</p>}
        </div>
      </section>

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
                  meals[meal] = [...(meals[meal] ?? []), ...items.map((it) => ({ ...it, id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) }))];
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
        return (
          <Card
            key={m.id}
            id={`meal.${m.id}`}
            icon={<MealIcon id={m.id} />}
            className="meal"
            title={m.label}
            summary={entries.length ? `${entries.length} alimenti` : undefined}
            actions={
              <>
                <span className="meal-kcal">
                  {fmt(mt.kcal)} kcal · P {fmt(mt.protein)} g
                </span>
                <button className="icon-btn" aria-label={`Aggiungi a ${m.label}`} onClick={() => setAdding(m.id)}>
                  <GlyphPlus />
                </button>
              </>
            }
          >
            {entries.length === 0 ? (
              <div className="row">
                <button className="btn-ghost small" onClick={() => setAdding(m.id)}>
                  <GlyphPlus /> Aggiungi alimento
                </button>
                {yesterday.length > 0 && (
                  <button
                    className="btn-ghost small"
                    onClick={() => setLog((l) => ({ ...l, meals: { ...l.meals, [m.id]: yesterday.map((e) => ({ ...e, id: crypto.randomUUID?.() ?? `${e.id}-c` })) } }))}
                  >
                    Copia da ieri ({yesterday.length})
                  </button>
                )}
              </div>
            ) : (
              <ul className="food-list">
                {entries.map((e) => (
                  <li key={e.id}>
                    <button className="food-entry" onClick={() => setEditing(editing === e.id ? null : e.id)}>
                      <span className="food-name">
                        {e.name}
                        {e.brand && <span className="muted"> · {e.brand}</span>}
                      </span>
                      <span className="food-meta">
                        {e.grams ? `${fmt(e.grams)} g · ` : ''}P {fmt(e.protein, 1)} · C {fmt(e.carbs, 1)} · G {fmt(e.fat, 1)}
                      </span>
                      <span className="food-kcal">{fmt(e.kcal)}</span>
                    </button>
                    {editing === e.id && (
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
                                      x.id === e.id ? { ...x, grams: g, kcal: Math.round(x.kcal * k), protein: scale(x.protein), carbs: scale(x.carbs), fat: scale(x.fat), fiber: x.fiber !== undefined ? scale(x.fiber) : undefined } : x,
                                    ),
                                  },
                                }));
                              }}
                            />
                            <span className="unit">g</span>
                          </label>
                        )}
                        <select
                          value={m.id}
                          aria-label="Sposta in"
                          onChange={(ev) => {
                            const to = ev.target.value as MealId;
                            setLog((l) => ({
                              ...l,
                              meals: { ...l.meals, [m.id]: (l.meals[m.id] ?? []).filter((x) => x.id !== e.id), [to]: [...(l.meals[to] ?? []), e] },
                            }));
                          }}
                        >
                          {MEALS.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.label}
                            </option>
                          ))}
                        </select>
                        <button className="icon-btn small" aria-label="Elimina" onClick={() => setLog((l) => ({ ...l, meals: { ...l.meals, [m.id]: (l.meals[m.id] ?? []).filter((x) => x.id !== e.id) } }))}>
                          <GlyphTrash />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      <section className="card water">
        <div className="card-head">
          <IconWater />
          <h2>Acqua</h2>
          <span className="muted small">
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
                onClick={() => store.updateDay(date, (d) => ({ ...d, body: { ...d.body, waterL: full ? i * 0.25 : (i + 1) * 0.25 } }))}
              >
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                  <path d="M6 3h12l-1.6 17a1.5 1.5 0 0 1-1.5 1.4H9.1a1.5 1.5 0 0 1-1.5-1.4z" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  {full && <path d="M7.2 9h9.6l-1 11a1 1 0 0 1-1 .9H9.2a1 1 0 0 1-1-.9z" className="water-fill" />}
                </svg>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Ultimi 7 giorni</h2>
          {goals.kcalIn ? <span className="muted small">obiettivo {fmt(goals.kcalIn)} kcal</span> : null}
        </div>
        <Columns buckets={week} unit=" kcal" />
      </section>

      {adding && (
        <FoodSheet
          meal={adding}
          onClose={() => setAdding(null)}
          onAdd={(meal, e) => {
            setLog((l) => ({ ...l, meals: { ...l.meals, [meal]: [...(l.meals[meal] ?? []), e] } }));
            setAdding(null);
          }}
        />
      )}
    </div>
  );
}
