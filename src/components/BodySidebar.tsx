import { memo, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { addDays, formatLong, fromISO, shiftMinutes, today } from '../lib/dates';
import { useStore } from '../lib/store/StoreContext';
import { dayIntake } from '../lib/nutrition/foods';
import { workoutVolume } from '../lib/training/analytics';
import type { BodyGoals, BodyLog, DayEntry, ISODate } from '../lib/types';
import { fmt } from './charts';
import { GlyphClose, IconScale, IconShift, IconSleep, IconSteps, IconSurgery, IconTarget, IconWater, IconWorkout } from './icons';
import { NumberInput, useCollapsible, Chevron } from './ui';
import { BodyFatCalc } from './BodyFatCalc';
import { clinicalTotals, surgeryTotals } from '../lib/worklog';

type FieldDef = { key: keyof BodyLog; label: string; unit: string; step: number; goal?: keyof BodyGoals; Icon: (p: { size?: number }) => React.ReactElement };

const FIELDS: FieldDef[] = [
  { key: 'weightKg', label: 'Peso', unit: 'kg', step: 0.1, goal: 'weightKg', Icon: IconScale },
  { key: 'bodyFatPct', label: 'Massa grassa', unit: '%', step: 0.1, Icon: IconTarget },
  { key: 'sleepH', label: 'Sonno', unit: 'h', step: 0.25, goal: 'sleepH', Icon: IconSleep },
  { key: 'steps', label: 'Passi', unit: '', step: 500, goal: 'steps', Icon: IconSteps },
  { key: 'waterL', label: 'Acqua', unit: 'L', step: 0.25, goal: 'waterL', Icon: IconWater },
];


function focusDate(pathname: string): ISODate {
  const m = pathname.match(/\/giorno\/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : today();
}

function avg(nums: (number | undefined)[]): number | undefined {
  const v = nums.filter((n): n is number => typeof n === 'number' && !isNaN(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
}

/** Weight over the last 30 days: lime line with a soft area, 7-day average dashed, tap/hover readout. */
function WeightChart({ points, goal }: { points: { date: ISODate; kg: number }[]; goal?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="muted small">Inserisci il peso per qualche giorno per vedere l'andamento.</p>;
  const W = 300, H = 110, P = 8;
  const kgs = points.map((p) => p.kg);
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const min = lo - 0.4;
  const max = hi + 0.4;
  const t0 = fromISO(points[0].date).getTime();
  const t1 = fromISO(points.at(-1)!.date).getTime() || t0 + 1;
  const x = (d: ISODate) => P + ((fromISO(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (kg: number) => P + (1 - (kg - min) / (max - min)) * (H - 2 * P);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.at(-1)!.date).toFixed(1)},${H} L${x(points[0].date).toFixed(1)},${H} Z`;
  // 7-day moving average: mean of the weights in the 7 days up to each point.
  const ma = points.map((p) => {
    const from = addDays(p.date, -6);
    const win = points.filter((q) => q.date >= from && q.date <= p.date).map((q) => q.kg);
    return { date: p.date, kg: win.reduce((a, b) => a + b, 0) / win.length };
  });
  const maPath = ma.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const h = hover !== null ? points[hover] : points.at(-1)!;
  const dm = (d: ISODate) => fromISO(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  const mid = points[Math.floor(points.length / 2)];
  return (
    <div className="wchart">
      <div className="wchart-top">
        <span>Max {fmt(hi, 1)} kg</span>
        <span>Min {fmt(lo, 1)} kg</span>
        {goal ? <span>Obiettivo {fmt(goal, 1)} kg</span> : null}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Andamento del peso negli ultimi 30 giorni"
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          points.forEach((p, i) => Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px) && (best = i));
          setHover(best);
        }}
      >
        <defs>
          <linearGradient id="wfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className="wfill-a" />
            <stop offset="100%" className="wfill-b" />
          </linearGradient>
        </defs>
        {[0.2, 0.5, 0.8].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="wgrid" />
        ))}
        <path d={area} fill="url(#wfill)" />
        <path d={maPath} className="wma" />
        <path d={line} className="wline" />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={hover === i || (hover === null && i === points.length - 1) ? 4.5 : 2.2} className={`wdot${hover === i || (hover === null && i === points.length - 1) ? ' on' : ''}`} />
        ))}
      </svg>
      <div className="wchart-x">
        <span>{dm(points[0].date)}</span>
        <span>{dm(mid.date)}</span>
        <span className="wchart-now">
          {hover === null && h.date === points.at(-1)!.date ? 'Ultimo' : dm(h.date)} ({fmt(h.kg, 1)})
        </span>
      </div>
      <div className="wchart-legend">
        <span><i className="l-line" /> peso</span>
        <span><i className="l-ma" /> media 7 giorni</span>
      </div>
    </div>
  );
}

/** One body value as a tile: goal on top, big editable number, name below. */
function BodyTile({ f, value, goal, onChange, children }: { f: FieldDef; value?: number; goal?: number; onChange: (v: number | undefined) => void; children?: React.ReactNode }) {
  return (
    <label className={`btile btile-${f.key}`}>
      <span className="btile-top">
        <span className="btile-goal">{goal ? `Ob. ${fmt(goal, 1)}${f.unit ? ` ${f.unit}` : ''}` : ' '}</span>
        <f.Icon size={22} />
      </span>
      <span className="btile-val">
        <NumberInput value={value} step={f.step} placeholder="–" onChange={onChange} />
        {f.unit && <small>{f.unit}</small>}
      </span>
      <span className="btile-label">{f.label}</span>
      {children}
    </label>
  );
}

function BodySidebarPanel({ onClose }: { onClose?: () => void }) {
  const store = useStore();
  const { settings } = store;
  const loc = useLocation();
  const date = focusDate(loc.pathname);
  const day = store.day(date);
  const goals = settings.goals ?? {};
  const [goalsOpen, toggleGoals] = useCollapsible('side.goals', false);
  const [calcOpen, setCalcOpen] = useState(false);

  useEffect(() => {
    store.loadRange(addDays(date, -35), date);
  }, [date]);

  const setBody = (p: Partial<BodyLog>) => store.updateDay(date, (d) => ({ ...d, body: { ...d.body, ...p } }));
  const body = day.body ?? {};

  const recent = useMemo(() => {
    const out: DayEntry[] = [];
    for (let i = 0; i < 30; i++) out.push(store.day(addDays(date, -i)));
    return out;
  }, [store, date]);
  const weights = recent
    .filter((d) => d.body?.weightKg)
    .map((d) => ({ date: d.date, kg: d.body!.weightKg! }))
    .reverse();
  // Most recent tape measurements, to prefill the calculator.
  const lastMeasures = recent.find((d) => d.body?.waistCm)?.body ?? {};
  const last7 = recent.slice(0, 7);
  const prev7 = recent.slice(7, 14);
  const w7 = avg(last7.map((d) => d.body?.weightKg));
  const wPrev = avg(prev7.map((d) => d.body?.weightKg));
  const kcal7 = avg(last7.map((d) => dayIntake(d).kcal));
  const steps7 = avg(last7.map((d) => d.body?.steps));
  const sleep7 = avg(last7.map((d) => d.body?.sleepH));

  const hoursToday = [day.shift, day.guardia].reduce((n, sh) => {
    if (!sh) return n;
    return settings.shiftTypes.find((t) => t.id === sh.shiftTypeId)?.countsAsWork === false ? n : n + shiftMinutes(sh.start, sh.end) / 60;
  }, 0);
  const workouts = day.modules.filter((m) => m.kind === 'workout');
  const surgeries = surgeryTotals(day.modules).patients;
  const clinical = clinicalTotals(day.modules).activities;
  const study = day.modules.reduce((n, m) => n + (m.kind === 'study' ? m.durationMin : 0), 0);
  const intake = dayIntake(day);
  const balance = intake.kcal !== undefined && body.kcalOut !== undefined ? intake.kcal - body.kcalOut : undefined;

  return (
    <aside className="sidebar" aria-label="Riepilogo del giorno">
      <div className="side-head">
        <div>
          <h2 className="side-title">Riepilogo del giorno</h2>
          <span className="side-date">
            {date === today() ? 'Oggi · ' : ''}
            {formatLong(date)}
          </span>
        </div>
        {onClose && (
          <button className="icon-btn small" aria-label="Chiudi" onClick={onClose}>
            <GlyphClose />
          </button>
        )}
      </div>

      <section className="side-section side-card">
        <h3 className="sub">In breve</h3>
        <div className="brief-shift">
          <IconShift size={30} />
          <span>
            <small>Turno</small>
            <strong>
              {day.shift || day.guardia
                ? [day.shift, day.guardia]
                    .filter((sh): sh is NonNullable<typeof sh> => !!sh)
                    .map((sh) => `${settings.shiftTypes.find((t) => t.id === sh.shiftTypeId)?.name ?? 'Turno'} ${sh.start}–${sh.end}`)
                    .join(' · ')
                : 'Nessun turno'}
            </strong>
          </span>
          {hoursToday > 0 && <em>{fmt(hoursToday, 1)} h</em>}
        </div>
        <div className="brief-tiles">
          <div className="brief-tile">
            <IconSurgery size={28} />
            <span>
              <small>Lavoro</small>
              <strong>{[surgeries && `${surgeries} ${surgeries === 1 ? 'intervento' : 'interventi'}`, clinical && `${clinical} ${clinical === 1 ? 'prestazione' : 'prestazioni'}`, study && `${study}′ studio`].filter(Boolean).join(' · ') || 'Niente registrato'}</strong>
            </span>
          </div>
          <div className="brief-tile">
            <IconWorkout size={28} />
            <span>
              <small>Sport</small>
              <strong>
                {workouts.length
                  ? workouts.map((w) => (w.kind === 'workout' ? `${w.title ?? 'Allenamento'} · ${fmt(workoutVolume(w))} kg` : '')).join(' / ')
                  : 'Nessuno'}
              </strong>
            </span>
          </div>
        </div>
        {!loc.pathname.startsWith('/giorno') && (
          <Link className="link-quiet small" to={`/giorno/${date}`}>
            apri la giornata
          </Link>
        )}
      </section>

      <section className="side-section side-card">
        <h3 className="sub">Corpo</h3>
        <div className="btiles">
          {FIELDS.filter((f) => f.key !== 'waterL').map((f) => (
            <BodyTile key={f.key} f={f} value={body[f.key]} goal={f.goal ? goals[f.goal] : undefined} onChange={(v) => setBody({ [f.key]: v })}>
              {f.key === 'bodyFatPct' && (
                <button
                  type="button"
                  className="btile-calc"
                  onClick={(e) => {
                    e.preventDefault();
                    setCalcOpen(true);
                  }}
                >
                  Calcola →
                </button>
              )}
            </BodyTile>
          ))}
        </div>
        <div className="water-box">
          <div className="water-head">
            <IconWater size={24} />
            <strong>Acqua</strong>
            {goals.waterL ? <span className="muted small">/ {fmt(goals.waterL, 1)} L</span> : null}
            <span className="water-val">
              <NumberInput value={body.waterL} step={0.25} placeholder="0" onChange={(v) => setBody({ waterL: v })} />
              <small>L</small>
            </span>
          </div>
          {goals.waterL ? (
            <span className="water-bar">
              <span style={{ width: `${Math.min(100, ((body.waterL ?? 0) / goals.waterL) * 100)}%` }} />
            </span>
          ) : null}
          <div className="side-water">
            <span className="sw-glasses" aria-hidden="true">
              {Array.from({ length: Math.max(8, Math.ceil((goals.waterL ?? 2) / 0.25)) }, (_, i) => (
                <i key={i} className={i < Math.round((body.waterL ?? 0) / 0.25) ? 'full' : ''} />
              ))}
            </span>
            <button type="button" onClick={() => setBody({ waterL: Math.round(((body.waterL ?? 0) + 0.25) * 100) / 100 })}>
              + 250 ml
            </button>
          </div>
        </div>
        {calcOpen && <BodyFatCalc last={lastMeasures} onUse={setBody} onClose={() => setCalcOpen(false)} />}
      </section>

      <section className="side-section side-card">
        <h3 className="sub">Bilancio energetico</h3>
        <KcalRing eaten={intake.kcal ?? 0} goal={goals.kcalIn} burned={body.kcalOut} />
        <div className="bal-tiles">
          {intake.fromLog ? (
            <>
              <div className="bal-tile">
                <small>Assunte</small>
                <strong>{fmt(intake.kcal ?? 0)}</strong>
                <span>kcal</span>
              </div>
              <div className="bal-tile prot">
                <small>Proteine</small>
                <strong>{fmt(intake.protein ?? 0)} g</strong>
                <span>{goals.proteinG ? `/ ${fmt(goals.proteinG)} g` : ' '}</span>
              </div>
            </>
          ) : (
            <>
              <label className="bal-tile">
                <small>Assunte</small>
                <NumberInput value={body.kcalIn} step={50} placeholder="–" onChange={(v) => setBody({ kcalIn: v })} />
                <span>kcal</span>
              </label>
              <label className="bal-tile prot">
                <small>Proteine</small>
                <NumberInput value={body.proteinG} step={5} placeholder="–" onChange={(v) => setBody({ proteinG: v })} />
                <span>{goals.proteinG ? `g / ${fmt(goals.proteinG)}` : 'g'}</span>
              </label>
            </>
          )}
          <label className="bal-tile act">
            <small>Attive</small>
            <NumberInput value={body.kcalOut} step={50} placeholder="–" onChange={(v) => setBody({ kcalOut: v })} />
            <span>kcal</span>
          </label>
        </div>
        <Link className="link-lime small" to={`/alimentazione/${date}`}>
          {intake.fromLog ? 'apri il diario alimentare ›' : 'oppure registra i pasti nel diario alimentare ›'}
        </Link>
        {balance !== undefined && (
          <p className="small">
            Bilancio: <strong>{balance > 0 ? '+' : ''}{fmt(balance)} kcal</strong> <span className="muted">(assunte − attive)</span>
          </p>
        )}
      </section>

      <section className="side-section side-card">
        <div className="wsec-head">
          <h3 className="sub">Peso · 30 giorni</h3>
          {weights.length > 1 && (
            <span className="wdelta">
              {weights.at(-1)!.kg - weights[0].kg > 0 ? '+' : ''}
              {fmt(weights.at(-1)!.kg - weights[0].kg, 1)} kg
            </span>
          )}
        </div>
        <WeightChart points={weights} goal={goals.weightKg} />
        <dl className="side-stats">
          <div>
            <dt>Media 7 gg</dt>
            <dd>{w7 ? `${fmt(w7, 1)} kg` : '—'}</dd>
          </div>
          <div>
            <dt>Variazione</dt>
            <dd>{w7 && wPrev ? `${w7 - wPrev > 0 ? '+' : ''}${fmt(w7 - wPrev, 1)} kg` : '—'}</dd>
          </div>
          <div>
            <dt>Kcal medie</dt>
            <dd>{kcal7 ? fmt(kcal7) : '—'}</dd>
          </div>
          <div>
            <dt>Passi medi</dt>
            <dd>{steps7 ? fmt(steps7) : '—'}</dd>
          </div>
          <div>
            <dt>Sonno medio</dt>
            <dd>{sleep7 ? `${fmt(sleep7, 1)} h` : '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="side-section">
        <button className="side-toggle" onClick={toggleGoals} aria-expanded={goalsOpen}>
          <h3 className="sub">Obiettivi</h3>
          <Chevron open={goalsOpen} />
        </button>
        {goalsOpen && (
          <div className="side-grid">
            {(
              [
                ['weightKg', 'Peso obiettivo', 'kg', 0.5],
                ['kcalIn', 'Calorie giornaliere', 'kcal', 50],
                ['proteinG', 'Proteine', 'g', 5],
                ['carbsG', 'Carboidrati', 'g', 5],
                ['fatG', 'Grassi', 'g', 5],
                ['steps', 'Passi', '', 500],
                ['sleepH', 'Sonno', 'h', 0.5],
                ['waterL', 'Acqua', 'L', 0.25],
              ] as [keyof BodyGoals, string, string, number][]
            ).map(([k, label, unit, step]) => (
              <label key={k} className="side-field">
                <span className="side-label">{label}</span>
                <span className="side-input">
                  <NumberInput value={goals[k]} step={step} onChange={(v) => store.saveSettings({ ...settings, goals: { ...goals, [k]: v } })} />
                  <span className="unit">{unit}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

/** Calories left today as a small lime ring next to the big number. */
function KcalRing({ eaten, goal, burned }: { eaten: number; goal?: number; burned?: number }) {
  if (!goal) return null;
  const target = goal + (burned ?? 0);
  const left = target - eaten;
  const pct = Math.min(1, eaten / target);
  const C = 2 * Math.PI * 15.9;
  return (
    <div className="kcal-ring">
      <svg viewBox="0 0 36 36" width="76" height="76" aria-hidden="true">
        <circle cx="18" cy="18" r="15.9" className="kr-track" />
        <circle cx="18" cy="18" r="15.9" className={`kr-fill${left < 0 ? ' over' : ''}`} strokeDasharray={`${pct * C} ${C}`} transform="rotate(-90 18 18)" />
      </svg>
      <span className="kr-text">
        <strong>{fmt(Math.abs(left))}</strong>
        <span className="kr-cap">{left >= 0 ? 'kcal rimanenti' : 'kcal oltre'}</span>
        <span className="muted small">
          {fmt(eaten)} mangiate / {fmt(target)}
        </span>
      </span>
    </div>
  );
}

/** Memoised: it must not re-render on every frame while its drawer is being dragged. */
export const BodySidebar = memo(BodySidebarPanel);
