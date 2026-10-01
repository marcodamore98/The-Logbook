import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { addDays, formatLong, fromISO, shiftMinutes, today } from '../lib/dates';
import { useStore } from '../lib/store/StoreContext';
import { dayIntake } from '../lib/nutrition/foods';
import { workingSets, workoutVolume } from '../lib/training/analytics';
import type { BodyGoals, BodyLog, DayEntry, ISODate } from '../lib/types';
import { fmt } from './charts';
import { GlyphClose, IconBolt, IconFlame, IconFood, IconHeart, IconScale, IconShift, IconSleep, IconSteps, IconTarget, IconWater, IconWorkout } from './icons';
import { NumberInput, useCollapsible, Chevron } from './ui';

type FieldDef = { key: keyof BodyLog; label: string; unit: string; step: number; goal?: keyof BodyGoals; Icon: (p: { size?: number }) => React.ReactElement };

const FIELDS: FieldDef[] = [
  { key: 'weightKg', label: 'Peso', unit: 'kg', step: 0.1, goal: 'weightKg', Icon: IconScale },
  { key: 'bodyFatPct', label: 'Massa grassa', unit: '%', step: 0.1, Icon: IconTarget },
  { key: 'sleepH', label: 'Sonno', unit: 'h', step: 0.25, goal: 'sleepH', Icon: IconSleep },
  { key: 'restingHr', label: 'FC a riposo', unit: 'bpm', step: 1, Icon: IconHeart },
  { key: 'steps', label: 'Passi', unit: '', step: 500, goal: 'steps', Icon: IconSteps },
  { key: 'waterL', label: 'Acqua', unit: 'L', step: 0.25, goal: 'waterL', Icon: IconWater },
];

const NUTRITION: FieldDef[] = [
  { key: 'kcalIn', label: 'Calorie assunte', unit: 'kcal', step: 50, goal: 'kcalIn', Icon: IconFood },
  { key: 'kcalOut', label: 'Calorie attive', unit: 'kcal', step: 50, Icon: IconFlame },
  { key: 'proteinG', label: 'Proteine', unit: 'g', step: 5, goal: 'proteinG', Icon: IconBolt },
];

function focusDate(pathname: string): ISODate {
  const m = pathname.match(/\/giorno\/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : today();
}

function avg(nums: (number | undefined)[]): number | undefined {
  const v = nums.filter((n): n is number => typeof n === 'number' && !isNaN(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
}

/** Weight over the last 30 days: a single 2px line with markers and a hover readout. */
function WeightSpark({ points }: { points: { date: ISODate; kg: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="muted small">Inserisci il peso per qualche giorno per vedere l'andamento.</p>;
  const W = 260, H = 70, P = 6;
  const min = Math.min(...points.map((p) => p.kg)) - 0.3;
  const max = Math.max(...points.map((p) => p.kg)) + 0.3;
  const t0 = fromISO(points[0].date).getTime();
  const t1 = fromISO(points.at(-1)!.date).getTime() || t0 + 1;
  const x = (d: ISODate) => P + ((fromISO(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (kg: number) => P + (1 - (kg - min) / (max - min)) * (H - 2 * P);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const h = hover !== null ? points[hover] : points.at(-1)!;
  return (
    <div className="spark">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Andamento del peso negli ultimi 30 giorni"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          points.forEach((p, i) => Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px) && (best = i));
          setHover(best);
        }}
      >
        <path d={path} className="spark-line" />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={hover === i ? 4 : 2.5} className="spark-dot" />
        ))}
      </svg>
      <span className="spark-read">
        {fromISO(h.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}: <strong>{fmt(h.kg, 1)} kg</strong>
      </span>
    </div>
  );
}

function Meter({ value, goal, unit }: { value?: number; goal?: number; unit: string }) {
  if (!goal) return null;
  const pct = Math.min(100, ((value ?? 0) / goal) * 100);
  return (
    <span className="meter" title={`${fmt(value ?? 0)} / ${fmt(goal)} ${unit}`}>
      <span className="meter-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function BodySidebar({ onClose }: { onClose?: () => void }) {
  const store = useStore();
  const { settings } = store;
  const loc = useLocation();
  const date = focusDate(loc.pathname);
  const day = store.day(date);
  const goals = settings.goals ?? {};
  const [goalsOpen, toggleGoals] = useCollapsible('side.goals', false);

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
  const surgeries = day.modules.filter((m) => m.kind === 'surgery' && m.procedureId).length;
  const clinical = day.modules.reduce((n, m) => n + (m.kind === 'clinical' ? m.count : 0), 0);
  const study = day.modules.reduce((n, m) => n + (m.kind === 'study' ? m.durationMin : 0), 0);
  const intake = dayIntake(day);
  const balance = intake.kcal !== undefined && body.kcalOut !== undefined ? intake.kcal - body.kcalOut : undefined;

  const input = (f: FieldDef) => (
    <label key={f.key} className="side-field">
      <span className="side-label">
        <f.Icon size={24} />
        {f.label}
        {f.goal && goals[f.goal] ? <span className="muted"> / {fmt(goals[f.goal]!, 1)}</span> : null}
      </span>
      <span className="side-input">
        <NumberInput value={body[f.key]} step={f.step} onChange={(v) => setBody({ [f.key]: v })} />
        <span className="unit">{f.unit}</span>
      </span>
      {f.goal && f.key !== 'weightKg' && <Meter value={body[f.key]} goal={goals[f.goal]} unit={f.unit} />}
    </label>
  );

  return (
    <aside className="sidebar" aria-label="Corpo e riepilogo">
      <div className="side-head">
        <div>
          <span className="side-kicker">{date === today() ? 'Oggi' : 'Giorno'}</span>
          <h2 className="side-date">{formatLong(date)}</h2>
        </div>
        {onClose && (
          <button className="icon-btn small" aria-label="Chiudi" onClick={onClose}>
            <GlyphClose />
          </button>
        )}
      </div>

      <section className="side-section">
        <h3 className="sub">Riepilogo</h3>
        <ul className="side-summary">
          <li>
            <IconShift size={22} />
            <span>
              {day.shift || day.guardia
                ? [day.shift, day.guardia]
                    .filter((sh): sh is NonNullable<typeof sh> => !!sh)
                    .map((sh) => `${settings.shiftTypes.find((t) => t.id === sh.shiftTypeId)?.name ?? 'Turno'} · ${sh.start}–${sh.end}`)
                    .join(' + ')
                : 'Nessun turno'}
            </span>
            {hoursToday > 0 && <span className="muted">{fmt(hoursToday, 1)} h</span>}
          </li>
          {(surgeries > 0 || clinical > 0 || study > 0) && (
            <li className="muted small">
              {[surgeries && `${surgeries} interventi`, clinical && `${clinical} prestazioni`, study && `${study}′ di studio`].filter(Boolean).join(' · ')}
            </li>
          )}
          <li>
            <IconWorkout size={22} />
            <span>
              {workouts.length
                ? workouts
                    .map((w) => (w.kind === 'workout' ? `${w.title ?? 'Allenamento'} · ${fmt(workoutVolume(w))} kg · ${workingSets(w)} serie` : ''))
                    .join(' / ')
                : 'Nessun allenamento'}
            </span>
          </li>
        </ul>
        {!loc.pathname.startsWith('/giorno') && (
          <Link className="link-quiet small" to={`/giorno/${date}`}>
            apri la giornata
          </Link>
        )}
      </section>

      <section className="side-section">
        <h3 className="sub">Corpo</h3>
        <div className="side-grid">{FIELDS.map(input)}</div>
      </section>

      <section className="side-section">
        <h3 className="sub">Calorie</h3>
        {intake.fromLog ? (
          <>
            <div className="side-grid">
              <div className="side-field">
                <span className="side-label">Assunte (diario)</span>
                <strong>{fmt(intake.kcal ?? 0)} kcal</strong>
                <Meter value={intake.kcal} goal={goals.kcalIn} unit="kcal" />
              </div>
              <div className="side-field">
                <span className="side-label">Proteine (diario)</span>
                <strong>{fmt(intake.protein ?? 0)} g</strong>
                <Meter value={intake.protein} goal={goals.proteinG} unit="g" />
              </div>
              {input(NUTRITION[1])}
            </div>
            <Link className="link-quiet small" to={`/alimentazione/${date}`}>
              apri il diario alimentare
            </Link>
          </>
        ) : (
          <>
            <div className="side-grid">{NUTRITION.map(input)}</div>
            <Link className="link-quiet small" to={`/alimentazione/${date}`}>
              oppure registra i pasti nel diario alimentare
            </Link>
          </>
        )}
        {balance !== undefined && (
          <p className="small">
            Bilancio: <strong>{balance > 0 ? '+' : ''}{fmt(balance)} kcal</strong> <span className="muted">(assunte − attive)</span>
          </p>
        )}
      </section>

      <section className="side-section">
        <h3 className="sub">Peso · 30 giorni</h3>
        <WeightSpark points={weights} />
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
