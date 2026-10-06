import { useSwipeNav } from '../components/useSwipeNav';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { GlyphDownload, GlyphNext, GlyphPrev, IconClinical, IconCourse, IconFlame, IconOuting, IconRun, IconScale, IconShift, IconSurgery, IconTodo, IconWorkout } from '../components/icons';
import { BarList, Columns, fmt, Kpis, Progress, Stack, Trend, type Bucket } from '../components/charts';
import { PrintButton } from '../components/PrintDialog';
import { Card, Empty } from '../components/ui';
import {
  addDays,
  addMonths,
  endOfMonth,
  formatMonth,
  fromISO,
  isoWeek,
  MONTHS,
  rangeDays,
  startOfMonth,
  startOfWeek,
  today,
  WEEKDAYS_SHORT,
} from '../lib/dates';
import { fmtPaceSec } from '../lib/running/geo';
import { computeStats, metricOf, surgeryCsv, type Count, type Metric, type Stats } from '../lib/stats';
import { useStore } from '../lib/store/StoreContext';
import type { DayEntry, ISODate, Settings } from '../lib/types';
import { CLINICAL_ROLES, SURGICAL_ROLES, type VocabItem } from '../lib/vocab';

type Period = 'week' | 'month' | 'year';

function bounds(p: Period, anchor: ISODate): [ISODate, ISODate] {
  if (p === 'week') {
    const s = startOfWeek(anchor);
    return [s, addDays(s, 6)];
  }
  if (p === 'month') return [startOfMonth(anchor), endOfMonth(anchor)];
  const y = anchor.slice(0, 4);
  return [`${y}-01-01`, `${y}-12-31`];
}

function shift(p: Period, anchor: ISODate, n: number): ISODate {
  if (p === 'week') return addDays(anchor, 7 * n);
  if (p === 'month') return addMonths(anchor, n);
  return `${Number(anchor.slice(0, 4)) + n}-01-01`;
}

function title(p: Period, anchor: ISODate) {
  if (p === 'week') {
    const s = startOfWeek(anchor);
    return `Settimana ${isoWeek(s)} · dal ${fromISO(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
  }
  if (p === 'month') return formatMonth(anchor);
  return anchor.slice(0, 4);
}

const PREV_WORD: Record<Period, string> = { week: 'la settimana prima', month: 'il mese prima', year: 'l’anno prima' };

/** Same sections as the day page. */
const STATS_PRINT = [
  { id: 'lavoro', label: 'Lavoro (turni, chirurgia, clinica)' },
  { id: 'formazione', label: 'Formazione' },
  { id: 'sport', label: 'Sport (palestra e corsa)' },
  { id: 'salute', label: 'Salute (alimentazione e corpo)' },
  { id: 'agenda', label: 'Impegni e promemoria' },
  { id: 'personale', label: 'Tempo libero' },
];

/** Values of an ordered vocabulary (roles), in its order, with zeros kept so the ramp stays stable. */
function ordered(list: VocabItem[], counts: Count[]): Count[] {
  return list.map((v) => ({ label: v.label, value: counts.find((c) => c.label === v.label)?.value ?? 0 }));
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;
const shortDate = (d: ISODate) => fromISO(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

export default function StatsPage() {
  const store = useStore();
  const settings = store.settings;
  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState(today());
  const [days, setDays] = useState<DayEntry[]>([]);
  const [prevDays, setPrevDays] = useState<DayEntry[]>([]);
  const [from, to] = bounds(period, anchor);

  useEffect(() => {
    let alive = true;
    store.repo.getRange(from, to).then((d) => alive && setDays(d));
    return () => {
      alive = false;
    };
  }, [store.repo, from, to]);

  const [pFrom, pTo] = bounds(period, shift(period, anchor, -1));
  useEffect(() => {
    let alive = true;
    store.repo.getRange(pFrom, pTo).then((d) => alive && setPrevDays(d));
    return () => {
      alive = false;
    };
  }, [store.repo, pFrom, pTo]);

  const stats = useMemo(() => computeStats(days, settings), [days, settings]);
  const prev = useMemo(() => computeStats(prevDays, settings), [prevDays, settings]);

  /** Sum of a metric per day (week, month) or per month (year). */
  const series = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d]));
    return (metric: Metric): Bucket[] => {
      if (period === 'year') {
        return MONTHS.map((m, i) => {
          const mStart = `${from.slice(0, 4)}-${String(i + 1).padStart(2, '0')}-01`;
          const value = rangeDays(mStart, endOfMonth(mStart)).reduce((n, d) => n + metricOf(byDate.get(d), metric, settings), 0);
          return { label: m.slice(0, 3), full: `${m} ${from.slice(0, 4)}`, value };
        });
      }
      return rangeDays(from, to).map((d) => {
        const dt = fromISO(d);
        return {
          label: period === 'week' ? WEEKDAYS_SHORT[(dt.getDay() + 6) % 7] : String(dt.getDate()),
          full: dt.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }),
          value: metricOf(byDate.get(d), metric, settings),
        };
      });
    };
  }, [days, period, from, to, settings]);

  /** Year view: one Stats per month, for month-by-month trends (e.g. share of procedures as first operator). */
  const monthly = useMemo(() => {
    if (period !== 'year') return [];
    return MONTHS.map((m, i) => {
      const key = `${from.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`;
      return { label: m.slice(0, 3), stats: computeStats(days.filter((d) => d.date.startsWith(key)), settings) };
    });
  }, [period, days, from, settings]);

  function exportCsv() {
    const blob = new Blob([surgeryCsv(days, settings)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `logbook-chirurgico_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const swipeRef = useSwipeNav<HTMLDivElement>(() => setAnchor(shift(period, anchor, -1)), () => setAnchor(shift(period, anchor, 1)), `${period}:${from}`);
  const chartTitle = period === 'year' ? 'mese per mese' : 'giorno per giorno';
  const ctx: Ctx = { s: stats, p: prev, settings, series, monthly, chartTitle };

  return (
    <div ref={swipeRef} className="page stats-page swipe-page">
      <div className="segmented kind-switch no-print" role="tablist">
        {(['week', 'month', 'year'] as Period[]).map((p) => (
          <button key={p} role="tab" aria-selected={period === p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>
            {p === 'week' ? 'Settimana' : p === 'month' ? 'Mese' : 'Anno'}
          </button>
        ))}
      </div>
      <header className="page-head period-strip">
        <button className="icon-btn no-print" aria-label="Periodo precedente" onClick={() => setAnchor(shift(period, anchor, -1))}>
          <GlyphPrev />
        </button>
        <div className="page-title">
          <h1 className="capitalize">{title(period, anchor)}</h1>
        </div>
        <PrintButton sections={STATS_PRINT} title={`Statistiche ${title(period, anchor)}`} />
        <button className="icon-btn no-print" aria-label="Periodo successivo" onClick={() => setAnchor(shift(period, anchor, 1))}>
          <GlyphNext />
        </button>
      </header>
      <p className="stats-hint no-print">Tocca una sezione per ridurla o aprirla. Le frecce ▲▼ confrontano con {PREV_WORD[period]}.</p>

      <div className="stats-sections">
        <ShiftsCard {...ctx} />
        <SurgeryCard {...ctx} onCsv={exportCsv} />
        <ClinicalCard {...ctx} />
        <TrainingCard {...ctx} />
        <GymCard {...ctx} />
        <RunCard {...ctx} />
        <NutritionCard {...ctx} />
        <BodyCard {...ctx} />
        <AgendaCard {...ctx} />
        <LeisureCard {...ctx} />
      </div>
    </div>
  );
}

interface Ctx {
  s: Stats;
  p: Stats;
  settings: Settings;
  series: (m: Metric) => Bucket[];
  monthly: { label: string; stats: Stats }[];
  chartTitle: string;
}

function Section({ id, kicker, icon, title, summary, print, actions, children }: { id: string; kicker: string; icon: ReactNode; title: string; summary: string; print: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <Card id={`stats.${id}`} className="stats-card" kicker={kicker} icon={icon} title={title} summary={summary} print={print} actions={actions}>
      {children}
    </Card>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <h3 className="sub">{children}</h3>;
}

/* ---------------- Lavoro ---------------- */

function ShiftsCard({ s, p, series, chartTitle }: Ctx) {
  const w = s.work;
  return (
    <Section id="turni" kicker="Lavoro" icon={<IconShift />} title="Turni" print="lavoro" summary={w.shifts ? `${fmt(w.hours, 1)} h · ${plural(w.shifts, 'turno', 'turni')}` : 'Nessun turno'}>
      {w.shifts === 0 && w.byType.length === 0 ? (
        <Empty>Nessun turno nel periodo.</Empty>
      ) : (
        <>
          <Kpis
            items={[
              { label: 'Ore', value: fmt(w.hours, 1), unit: 'h', hi: true, delta: { cur: w.hours, prev: p.work.hours, better: 'none', fmtv: (v) => `${fmt(v, 1)} h` } },
              { label: 'Turni', value: fmt(w.shifts), delta: { cur: w.shifts, prev: p.work.shifts, better: 'none' } },
              { label: 'Notti', value: fmt(w.nights) },
            ]}
          />
          <Sub>Ore di turno, {chartTitle}</Sub>
          <Columns buckets={series('hours')} unit=" h" title="Ore di turno" />
          <Sub>Per tipo di turno</Sub>
          <BarList data={w.byType} max={6} />
          {w.colleagues.length > 0 && (
            <>
              <Sub>Colleghi con cui hai lavorato di più</Sub>
              <BarList data={w.colleagues} max={5} />
            </>
          )}
        </>
      )}
    </Section>
  );
}

function SurgeryCard({ s, p, series, monthly, chartTitle, onCsv }: Ctx & { onCsv: () => void }) {
  const g = s.surgery;
  const firstPct = pct(g.firstOp, g.total);
  const prevFirstPct = p.surgery.total ? pct(p.surgery.firstOp, p.surgery.total) : undefined;
  const autonomy = monthly.filter((m) => m.stats.surgery.total > 0).map((m) => ({ label: m.label, value: pct(m.stats.surgery.firstOp, m.stats.surgery.total) }));
  return (
    <Section
      id="chirurgia"
      kicker="Lavoro"
      icon={<IconSurgery />}
      title="Attività chirurgica"
      print="lavoro"
      summary={g.patients ? `${plural(g.patients, 'intervento', 'interventi')} · ${firstPct}% da primo` : 'Nessun intervento'}
      actions={
        <button className="btn-ghost small no-print" onClick={onCsv} disabled={!g.total} title="Logbook chirurgico in CSV (Excel)">
          <GlyphDownload /> CSV
        </button>
      }
    >
      {g.total === 0 ? (
        <Empty>Nessun intervento nel periodo.</Empty>
      ) : (
        <>
          <Kpis
            items={[
              { label: 'Interventi', value: fmt(g.patients), hi: true, note: plural(g.total, 'procedura', 'procedure'), delta: { cur: g.patients, prev: p.surgery.patients } },
              { label: 'Da primo operatore', value: `${firstPct}`, unit: '%', note: `${g.firstOp} proc., ${g.firstSolo} senza tutor`, delta: { cur: firstPct, prev: prevFirstPct, fmtv: (v) => `${fmt(v)} pt` } },
              { label: 'Tempo operatorio', value: fmt(g.minutes / 60, 1), unit: 'h' },
              { label: 'Complicanze', value: fmt(g.complications), note: `${fmt((g.complications / Math.max(1, g.patients)) * 100, 1)}% dei pazienti` },
            ]}
          />
          <Sub>Interventi, {chartTitle}</Sub>
          <Columns buckets={series('surgery')} unit="" title="Interventi" digits={0} />
          <Sub>Ruolo nelle procedure</Sub>
          <Stack data={ordered(SURGICAL_ROLES, g.byRole)} ordinal label="Ruolo nelle procedure, dal più autonomo" />
          {autonomy.length >= 2 && (
            <>
              <Sub>Autonomia: procedure da primo operatore, mese per mese</Sub>
              <Trend title="Percentuale da primo operatore" better="up" minSpan={20} noun="mesi" format={(v) => `${fmt(v)}%`} points={autonomy} />
            </>
          )}
          <Sub>Per area</Sub>
          <BarList data={g.byGroup} max={6} />
          <Sub>Procedure più frequenti</Sub>
          <BarList data={g.byProcedure} max={8} />
          <Sub>Via d’accesso</Sub>
          <BarList data={g.byApproach} max={6} />
          {g.bySetting.length > 1 && (
            <>
              <Sub>Regime (pazienti)</Sub>
              <BarList data={g.bySetting} />
            </>
          )}
        </>
      )}
    </Section>
  );
}

function ClinicalCard({ s, p, series, chartTitle }: Ctx) {
  const c = s.clinical;
  return (
    <Section id="clinica" kicker="Lavoro" icon={<IconClinical />} title="Attività clinica" print="lavoro" summary={c.patients ? `${plural(c.patients, 'paziente', 'pazienti')} · ${plural(c.total, 'prestazione', 'prestazioni')}` : 'Nessuna prestazione'}>
      {c.total === 0 ? (
        <Empty>Nessuna prestazione nel periodo.</Empty>
      ) : (
        <>
          <Kpis
            items={[
              { label: 'Pazienti', value: fmt(c.patients), hi: true, delta: { cur: c.patients, prev: p.clinical.patients } },
              { label: 'Prestazioni', value: fmt(c.total), delta: { cur: c.total, prev: p.clinical.total } },
            ]}
          />
          <Sub>Pazienti, {chartTitle}</Sub>
          <Columns buckets={series('clinical')} unit="" title="Pazienti visti" digits={0} />
          {c.byRole.length > 0 && (
            <>
              <Sub>Ruolo</Sub>
              <Stack data={ordered(CLINICAL_ROLES, c.byRole)} ordinal label="Ruolo nelle prestazioni, dal più autonomo" />
            </>
          )}
          <Sub>Per prestazione</Sub>
          <BarList data={c.byActivity} max={8} />
        </>
      )}
    </Section>
  );
}

/* ---------------- Formazione ---------------- */

function TrainingCard({ s, p, series, chartTitle }: Ctx) {
  const h = s.study.minutes / 60;
  const c = s.courses;
  const events = c.course + c.congress + c.webinar;
  return (
    <Section id="formazione" kicker="Formazione" icon={<IconCourse />} title="Studio, corsi e congressi" print="formazione" summary={h || events ? `${fmt(h, 1)} h di studio · ${plural(events, 'evento', 'eventi')}` : 'Nessuna attività'}>
      {h === 0 && events === 0 ? (
        <Empty>Nessuno studio o corso nel periodo.</Empty>
      ) : (
        <>
          <Kpis
            items={[
              { label: 'Studio', value: fmt(h, 1), unit: 'h', hi: true, delta: { cur: h, prev: p.study.minutes / 60, fmtv: (v) => `${fmt(v, 1)} h` } },
              { label: 'Corsi e congressi', value: fmt(events), note: events ? [c.course && plural(c.course, 'corso', 'corsi'), c.congress && plural(c.congress, 'congresso', 'congressi'), c.webinar && plural(c.webinar, 'webinar', 'webinar')].filter(Boolean).join(' · ') : undefined },
              { label: 'Crediti ECM', value: fmt(c.ecm, 1) },
            ]}
          />
          {h > 0 && (
            <>
              <Sub>Ore di studio, {chartTitle}</Sub>
              <Columns buckets={series('study')} unit=" h" title="Ore di studio" />
              <Sub>Per area</Sub>
              <BarList data={s.study.byArea.map((x) => ({ ...x, value: x.value / 60 }))} unit=" h" max={6} />
              <Sub>Per tipo</Sub>
              <BarList data={s.study.byType.map((x) => ({ ...x, value: x.value / 60 }))} unit=" h" max={6} />
            </>
          )}
        </>
      )}
    </Section>
  );
}

/* ---------------- Sport ---------------- */

function GymCard({ s, p, series, chartTitle }: Ctx) {
  const w = s.workout;
  return (
    <Section id="palestra" kicker="Sport" icon={<IconWorkout />} title="Palestra" print="sport" summary={w.sessions ? `${plural(w.sessions, 'allenamento', 'allenamenti')} · ${fmt(w.volumeKg / 1000, 1)} t` : 'Nessun allenamento'}>
      {w.sessions === 0 ? (
        <Empty>Nessun allenamento nel periodo.</Empty>
      ) : (
        <>
          <Kpis
            items={[
              { label: 'Allenamenti', value: fmt(w.sessions), hi: true, delta: { cur: w.sessions, prev: p.workout.sessions } },
              { label: 'Tempo', value: fmt(w.minutes / 60, 1), unit: 'h' },
              { label: 'Volume', value: fmt(w.volumeKg / 1000, 1), unit: 't', note: plural(w.sets, 'serie', 'serie'), delta: { cur: w.volumeKg, prev: p.workout.volumeKg, fmtv: (v) => `${fmt(v / 1000, 1)} t` } },
            ]}
          />
          {w.volumeKg > 0 && (
            <>
              <Sub>Volume sollevato, {chartTitle}</Sub>
              <Columns buckets={series('volume')} unit=" kg" title="Volume sollevato" digits={0} />
            </>
          )}
          {s.muscles.length > 0 && (
            <>
              <Sub>Serie per muscolo</Sub>
              <BarList data={s.muscles} max={10} />
            </>
          )}
          {w.byExercise.length > 0 && (
            <>
              <Sub>Esercizi con più volume</Sub>
              <BarList data={w.byExercise} unit=" kg" max={6} />
            </>
          )}
          {w.byType.length > 1 && (
            <>
              <Sub>Tipo di allenamento</Sub>
              <BarList data={w.byType} />
            </>
          )}
        </>
      )}
    </Section>
  );
}

function RunCard({ s, p, series, chartTitle }: Ctx) {
  const r = s.run;
  const pace = (v: number) => `${fmtPaceSec(v)}/km`;
  return (
    <Section id="corsa" kicker="Sport" icon={<IconRun />} title="Corsa" print="sport" summary={r.sessions ? `${fmt(r.km, 1)} km · ${plural(r.sessions, 'corsa', 'corse')}` : 'Nessuna corsa'}>
      {r.sessions === 0 ? (
        <Empty>Nessuna corsa nel periodo.</Empty>
      ) : (
        <>
          <Kpis
            items={[
              { label: 'Distanza', value: fmt(r.km, 1), unit: 'km', hi: true, delta: { cur: r.km, prev: p.run.km, fmtv: (v) => `${fmt(v, 1)} km` } },
              { label: 'Corse', value: fmt(r.sessions), delta: { cur: r.sessions, prev: p.run.sessions } },
              { label: 'Passo medio', value: fmtPaceSec(r.paceSecKm), unit: '/km', delta: { cur: r.paceSecKm, prev: p.run.paceSecKm, better: 'down', fmtv: (v) => `${Math.round(v)} s` } },
            ]}
          />
          <Sub>Chilometri, {chartTitle}</Sub>
          <Columns buckets={series('run')} unit=" km" title="Chilometri di corsa" />
          <Sub>Passo di ogni corsa</Sub>
          <Trend title="Passo medio per corsa" better="down" minSpan={30} format={(v) => fmtPaceSec(v)} points={r.runs.map((x) => ({ label: shortDate(x.date), value: x.paceSecKm }))} />
          {r.runs.filter((x) => x.workPaceSecKm).length >= 2 && (
            <>
              <Sub>Passo delle ripetute</Sub>
              <Trend title="Passo delle ripetute" better="down" minSpan={30} format={(v) => fmtPaceSec(v)} points={r.runs.filter((x) => x.workPaceSecKm).map((x) => ({ label: shortDate(x.date), value: x.workPaceSecKm! }))} />
            </>
          )}
          <Sub>Record del periodo</Sub>
          <dl className="side-stats records">
            <div><dt>Corsa più lunga</dt><dd>{fmt(r.longestKm, 1)} km</dd></div>
            {r.bestPaceSecKm && <div><dt>Miglior passo (≥ 1 km)</dt><dd>{pace(r.bestPaceSecKm)}</dd></div>}
            {r.bestKmSec && <div><dt>Km più veloce</dt><dd>{pace(r.bestKmSec)}</dd></div>}
            {r.maxKmh && <div><dt>Velocità massima</dt><dd>{fmt(r.maxKmh, 1)} km/h</dd></div>}
          </dl>
          {r.byMode.length > 1 && (
            <>
              <Sub>Tipo di corsa</Sub>
              <Stack data={r.byMode} label="Tipo di corsa" />
            </>
          )}
        </>
      )}
    </Section>
  );
}

/* ---------------- Salute ---------------- */

function NutritionCard({ s, p, settings }: Ctx) {
  const n = s.nutrition;
  const goals = settings.goals ?? {};
  return (
    <Section id="alimentazione" kicker="Salute" icon={<IconFlame />} title="Alimentazione" print="salute" summary={n.days ? `${fmt(n.kcal ?? 0)} kcal al giorno in media` : 'Nessun pasto registrato'}>
      {n.days === 0 ? (
        <Empty>Nessun giorno con pasti registrati nel periodo.</Empty>
      ) : (
        <>
          <Kpis
            items={[
              { label: 'Kcal medie', value: fmt(n.kcal ?? 0), hi: true, note: goals.kcalIn ? `obiettivo ${fmt(goals.kcalIn)}` : undefined, delta: { cur: n.kcal, prev: p.nutrition.kcal, better: 'none', fmtv: (v) => fmt(v) } },
              { label: 'Proteine medie', value: fmt(n.protein ?? 0), unit: 'g', note: goals.proteinG ? `obiettivo ${fmt(goals.proteinG)} g` : undefined, delta: { cur: n.protein, prev: p.nutrition.protein, fmtv: (v) => `${fmt(v)} g` } },
              { label: 'Giorni registrati', value: fmt(n.days) },
            ]}
          />
          {(goals.kcalIn || goals.proteinG) && (
            <>
              <Sub>Obiettivi rispettati</Sub>
              <div className="progress-list">
                {goals.kcalIn ? <Progress label="Calorie entro ±10%" value={n.daysOnKcal} of={n.days} /> : null}
                {goals.proteinG ? <Progress label="Proteine raggiunte" value={n.daysOnProtein} of={n.days} /> : null}
              </div>
            </>
          )}
          {n.carbs !== undefined && n.fat !== undefined && (
            <>
              <Sub>Da dove vengono le calorie</Sub>
              <Stack
                unit=" kcal"
                label="Ripartizione delle calorie fra i macronutrienti"
                data={[
                  { label: 'Carboidrati', value: Math.round(n.carbs * 4) },
                  { label: 'Proteine', value: Math.round((n.protein ?? 0) * 4) },
                  { label: 'Grassi', value: Math.round(n.fat * 9) },
                ]}
              />
            </>
          )}
        </>
      )}
    </Section>
  );
}

function BodyCard({ s, p, settings }: Ctx) {
  const b = s.body;
  const goal = settings.goals?.weightKg;
  const any = b.weight || b.steps || b.sleepH;
  const weightBetter = !b.weight || !goal ? 'none' : goal > b.weight ? 'up' : 'down';
  return (
    <Section id="corpo" kicker="Salute" icon={<IconScale />} title="Corpo" print="salute" summary={b.weight ? `peso medio ${fmt(b.weight, 1)} kg` : any ? 'passi e sonno' : 'Nessun dato'}>
      {!any ? (
        <Empty>Nessun peso, passo o sonno registrato nel periodo.</Empty>
      ) : (
        <>
          <Kpis
            items={[
              ...(b.weight ? [{ label: 'Peso medio', value: fmt(b.weight, 1), unit: 'kg', hi: true, note: goal ? `obiettivo ${fmt(goal, 1)} kg` : undefined, delta: { cur: b.weight, prev: p.body.weight, better: weightBetter, fmtv: (v: number) => `${fmt(v, 1)} kg` } as const }] : []),
              ...(b.steps ? [{ label: 'Passi al giorno', value: fmt(b.steps), delta: { cur: b.steps, prev: p.body.steps, fmtv: (v: number) => fmt(v) } }] : []),
              ...(b.sleepH ? [{ label: 'Sonno medio', value: fmt(b.sleepH, 1), unit: 'h', delta: { cur: b.sleepH, prev: p.body.sleepH, better: 'none', fmtv: (v: number) => `${fmt(v, 1)} h` } as const }] : []),
            ]}
          />
          {b.weights.length >= 2 && (
            <>
              <Sub>Andamento del peso</Sub>
              <Trend title="Peso" better="none" minSpan={2} noun="pesate" format={(v) => `${fmt(v, 1)} kg`} points={b.weights.map((w) => ({ label: shortDate(w.date), value: w.kg }))} />
            </>
          )}
        </>
      )}
    </Section>
  );
}

/* ---------------- Agenda e tempo libero ---------------- */

function AgendaCard({ s }: Ctx) {
  const c = s.categories;
  const appts = c.appointments.reduce((n, x) => n + x.value, 0);
  return (
    <Section id="agenda" kicker="Agenda" icon={<IconTodo />} title="Impegni e promemoria" print="agenda" summary={appts || c.todosTotal ? `${plural(appts, 'impegno', 'impegni')} · ${c.todosDone}/${c.todosTotal} promemoria` : 'Nessun impegno'}>
      {appts === 0 && c.todosTotal === 0 ? (
        <Empty>Nessun impegno o promemoria nel periodo.</Empty>
      ) : (
        <>
          <Kpis
            items={[
              { label: 'Impegni', value: fmt(appts), hi: true },
              ...(c.todosTotal ? [{ label: 'Promemoria fatti', value: `${pct(c.todosDone, c.todosTotal)}`, unit: '%', note: `${c.todosDone} su ${c.todosTotal}` }] : []),
            ]}
          />
          {appts > 0 && (
            <>
              <Sub>Impegni per categoria</Sub>
              <BarList data={c.appointments} max={6} />
            </>
          )}
          {c.todosTotal > 0 && (
            <>
              <Sub>Promemoria per categoria</Sub>
              <BarList data={c.todos} max={6} />
            </>
          )}
        </>
      )}
    </Section>
  );
}

function LeisureCard({ s, p }: Ctx) {
  const o = s.outings;
  return (
    <Section id="personale" kicker="Tempo libero" icon={<IconOuting />} title="Gite, uscite e ricordi" print="personale" summary={o.total || s.photos ? `${plural(o.total, 'uscita', 'uscite')} · ${plural(s.photos, 'foto', 'foto')}` : 'Nessuna uscita'}>
      {o.total === 0 && s.photos === 0 && s.mood === undefined ? (
        <Empty>Nessuna uscita o foto nel periodo.</Empty>
      ) : (
        <>
          <Kpis
            items={[
              { label: 'Uscite e gite', value: fmt(o.total), hi: true, delta: { cur: o.total, prev: p.outings.total } },
              { label: 'Foto nel diario', value: fmt(s.photos) },
              ...(s.mood !== undefined ? [{ label: 'Umore medio', value: fmt(s.mood, 1), unit: '/5' }] : []),
            ]}
          />
          {o.byType.length > 0 && (
            <>
              <Sub>Per tipo</Sub>
              <BarList data={o.byType} max={6} />
            </>
          )}
        </>
      )}
    </Section>
  );
}
