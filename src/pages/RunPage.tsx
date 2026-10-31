import { confirmAction, confirmDelete } from '../components/Confirm';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from '../components/charts';
import { GlyphTrash, IconRun, NavRun } from '../components/icons';
import { PlanBuilder } from '../components/running/PlanBuilder';
import { TreadmillBuilder } from '../components/running/TreadmillBuilder';
import { ImportProgram } from '../components/running/ImportProgram';
import { RunSummary, type RunResult } from '../components/running/RunSummary';
import { Card, Field, uid } from '../components/ui';
import { Sym } from '../components/icons';
import { fromISO, today } from '../lib/dates';
import { runSession, useRunSession } from '../lib/running/engine';
import { fmtDuration, fmtKm, fmtPace, fmtPaceSec, KIND_LABEL, stepLabel } from '../lib/running/geo';
import { presetPlans } from '../lib/running/plans';
import { atLevel, changes, DEFAULT_MAX_INCLINE, levelLabel } from '../lib/running/program';
import { doneMeters, fmtIncline, fmtKmh, kmhOf, lapMeters, paceFromKmh, treadmillPresets, treadmillSettings } from '../lib/running/treadmill';
import { useStore } from '../lib/store/StoreContext';
import type { RunModule, RunPlan, RunStep } from '../lib/types';

export default function RunPage() {
  const store = useStore();
  const { settings } = store;
  // A run already going (or finished and not saved yet) brings back what it was started with.
  const cfg = runSession.config;
  const [mode, setMode] = useState<'continuous' | 'intervals' | 'treadmill'>(cfg?.mode ?? 'continuous');
  const tm = mode === 'treadmill';
  const [steps, setSteps] = useState<RunStep[]>(cfg?.steps ?? []);
  const [planName, setPlanName] = useState<string>(cfg?.planName ?? 'Personalizzata');
  // The programme the steps come from, and at which level (treadmill: it follows the judgements).
  const [planId, setPlanId] = useState<string | undefined>(cfg?.planId);
  const [importing, setImporting] = useState(false);
  const maxIncline = settings.treadmillMaxIncline ?? DEFAULT_MAX_INCLINE;
  const levels = settings.runLevels ?? {};
  const [useGps, setUseGps] = useState(cfg ? cfg.useGps : true);
  const plans: RunPlan[] = useMemo(
    () => (tm ? [...treadmillPresets(), ...(settings.runPlans ?? []).filter((p) => p.treadmill)] : [...presetPlans(), ...(settings.runPlans ?? []).filter((p) => !p.treadmill)]),
    [settings.runPlans, tm],
  );

  const activeSteps = mode !== 'continuous' ? steps : undefined;
  const gps = useGps && !tm; // no GPS indoors: the distance comes from speed × time
  const run = useRunSession();
  const { state } = run;
  const liveRef = useRef<HTMLElement>(null);
  const active = state.phase === 'running' || state.phase === 'paused';

  const save = async (r: RunResult) => {
    const m: RunModule = {
      kind: 'run',
      id: uid(),
      title: r.title,
      mode,
      planName: mode !== 'continuous' && planName !== 'Personalizzata' ? planName : undefined,
      steps: mode !== 'continuous' ? steps : undefined,
      distanceM: r.distanceM,
      durationSec: Math.round(state.elapsed),
      startedAt: Date.now() - state.elapsed * 1000,
      track: run.finalTrack(),
      maxSpeedKmh: r.maxSpeedKmh,
      splits: r.splits,
      laps: mode !== 'continuous' && laps.length ? laps : undefined,
      notes: r.notes,
      ...(adaptive && planId ? { planId, level: levels[planId] ?? 0, ...(r.feel ? { feel: r.feel } : {}) } : {}),
    };
    await store.updateDay(today(), (d) => ({ ...d, modules: [...d.modules, m] }));
    // The judgement moves the programme one notch for next time.
    if (adaptive && planId && r.feel && r.feel !== 'ok') {
      const next = (levels[planId] ?? 0) + (r.feel === 'easy' ? 1 : -1);
      await store.saveSettings({ ...store.settings, runLevels: { ...(store.settings.runLevels ?? {}), [planId]: next } });
      const p = plans.find((x) => x.id === planId);
      if (p) setSteps(atLevel(p.steps, next, maxIncline));
    }
    run.reset();
  };

  // History
  useEffect(() => store.ensureAllLoaded(), []);
  const history = useMemo(
    () =>
      store.allDays
        .flatMap((d) => d.modules.filter((m): m is RunModule => m.kind === 'run').map((m) => ({ date: d.date, m })))
        .sort((a, b) => b.date.localeCompare(a.date) || (b.m.startedAt ?? 0) - (a.m.startedAt ?? 0)),
    [store.allDays],
  );
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const wk = history.filter((h) => h.date >= weekAgo);
  const wkKm = wk.reduce((n, h) => n + h.m.distanceM, 0) / 1000;
  const wkSec = wk.reduce((n, h) => n + h.m.durationSec, 0);

  const savePlan = () => {
    const name = window.prompt('Nome della sessione', plans.some((p) => p.name === planName && !isSaved(p.id)) ? '' : planName === 'Personalizzata' ? '' : planName)?.trim();
    if (!name) return;
    const plan: RunPlan = { id: uid(), name, steps: steps.map((s) => ({ ...s })), treadmill: tm || undefined };
    store.saveSettings({ ...settings, runPlans: [...(settings.runPlans ?? []), plan] });
    setPlanName(name);
    setPlanId(plan.id);
  };
  const choosePlan = (id: string) => {
    const p = plans.find((x) => x.id === id);
    setPlanId(p?.id);
    if (!p) return;
    setSteps(p.treadmill ? atLevel(p.steps, levels[p.id] ?? 0, maxIncline) : p.steps.map((s) => ({ ...s, id: uid() })));
    setPlanName(p.name);
  };
  const edited = (s: RunStep[]) => {
    setSteps(s);
    setPlanName('Personalizzata');
    setPlanId(undefined);
  };
  const plan = plans.find((p) => p.id === planId);
  const level = planId ? levels[planId] ?? 0 : 0;
  // Only a treadmill programme left as chosen follows the judgements.
  const adaptive = tm && !!plan;
  const preview = (feel: 'easy' | 'hard') => (plan ? changes(atLevel(plan.steps, level, maxIncline), atLevel(plan.steps, level + (feel === 'easy' ? 1 : -1), maxIncline)) : []);
  const resetLevel = async () => {
    if (!plan || !(await confirmAction('Tornare al programma originale?', { detail: `“${plan.name}” torna com’è scritto, senza gli adattamenti dei tuoi giudizi.`, action: 'Torna all’originale' }))) return;
    const { [plan.id]: _, ...rest } = levels;
    await store.saveSettings({ ...settings, runLevels: rest });
    setSteps(atLevel(plan.steps, 0, maxIncline));
  };
  const importPlan = async (p: RunPlan) => {
    await store.saveSettings({ ...settings, runPlans: [...(settings.runPlans ?? []), p] });
    setImporting(false);
    setPlanId(p.id);
    setPlanName(p.name);
    setSteps(atLevel(p.steps, 0, maxIncline));
  };
  const isSaved = (id: string) => (settings.runPlans ?? []).some((p) => p.id === id);

  const cur = activeSteps?.[state.stepIdx];
  const stepTotal = cur ? cur.value : 0;
  const stepPct = cur && state.stepLeft !== null ? Math.min(100, Math.max(0, (1 - state.stepLeft / stepTotal) * 100)) : 0;
  // Treadmill: distance estimated from each step's pace × time run so far.
  const tmMeters = tm ? doneMeters(state.laps, cur, state.stepLeft) : 0;
  const laps = tm ? state.laps.map((l) => ({ ...l, meters: lapMeters(l) })) : state.laps;
  const stepText =
    cur && state.stepLeft !== null ? (cur.by === 'time' ? fmtDuration(state.stepLeft) : `${Math.ceil(state.stepLeft)} m`) : '';

  return (
    <div className="page run-page">
      <header className="page-head">
        <NavRun size={44} />
        <div className="page-title">
          <h1>Corsa</h1>
          <span className="page-sub">
            Ultimi 7 giorni: {fmt(wkKm, 1)} km · {fmtDuration(wkSec)}
          </span>
        </div>
      </header>

      <Card id="run.setup" icon={<span className="run-disc"><IconRun size={22} /></span>} title="Che corsa fai?" summary={mode === 'continuous' ? 'Continua' : `${tm ? 'Tapis roulant' : 'Intervalli'} · ${planName}`} defaultOpen={true}>
        <div className="segmented kind-switch" role="tablist">
          <button role="tab" aria-selected={mode === 'continuous'} className={mode === 'continuous' ? 'on' : ''} disabled={active} onClick={() => setMode('continuous')}>
            Continua
          </button>
          <button role="tab" aria-selected={mode === 'intervals'} className={mode === 'intervals' ? 'on' : ''} disabled={active} onClick={() => { if (tm) edited([]); setMode('intervals'); }}>
            A intervalli
          </button>
          <button role="tab" aria-selected={tm} className={tm ? 'on' : ''} disabled={active} onClick={() => { if (!tm) edited([]); setMode('treadmill'); }}>
            Tapis roulant
          </button>
        </div>
        {!tm && (
          <label className="check">
            <input type="checkbox" checked={useGps} disabled={active} onChange={(e) => setUseGps(e.target.checked)} /> Usa il GPS
          </label>
        )}
        {mode !== 'continuous' && !active && (
          <>
            <Field label={tm ? 'Programma' : 'Sessione preimpostata o salvata'}>
              <select value={planId ?? ''} onChange={(e) => choosePlan(e.target.value)}>
                <option value="">Personalizzata (da zero)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {tm && levels[p.id] ? ` · ${levelLabel(levels[p.id])}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            {tm && (
              <div className="tm-tools">
                <button type="button" className="btn-ghost small" onClick={() => setImporting(true)}>
                  <Sym name="content_paste" size={18} /> Importa programma
                </button>
                <label className="tm-max">
                  <span>Pendenza max del tapis roulant</span>
                  <select value={maxIncline} onChange={(e) => { const v = Number(e.target.value); store.saveSettings({ ...settings, treadmillMaxIncline: v }); if (plan) setSteps(atLevel(plan.steps, level, v)); }}>
                    {[10, 12, 15, 18, 20, 25, 30].map((v) => (
                      <option key={v} value={v}>
                        {v}%
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {adaptive && (
              <div className={`tm-level${level ? ' on' : ''}`}>
                <Sym name="tune" size={18} />
                <span>
                  {level ? (
                    <>
                      <strong>{level > 0 ? 'Più dura' : 'Più leggera'} dell’originale</strong> ({levelLabel(level)}), adattata ai tuoi giudizi.
                    </>
                  ) : (
                    'Com’è scritto. A fine allenamento dimmi com’è andata: la prossima volta si adatta.'
                  )}
                </span>
                {level !== 0 && (
                  <button type="button" className="link-quiet" onClick={resetLevel}>
                    Originale
                  </button>
                )}
              </div>
            )}
            {tm && plan?.notes && (
              <div className="run-tips">
                <span className="stat-label">Consigli</span>
                <p>{plan.notes}</p>
              </div>
            )}
            {tm ? <TreadmillBuilder steps={steps} onChange={edited} /> : <PlanBuilder steps={steps} onChange={edited} />}
            <div className="row">
              <button className="btn-ghost small" disabled={!steps.length} onClick={savePlan}>
                Salva questa sessione
              </button>
              {plans.filter((p) => isSaved(p.id) && p.name === planName).map((p) => (
                <button key={p.id} className="btn-ghost small" onClick={async () => { if (!(await confirmDelete(`“${p.name}”`))) return; await store.saveSettings({ ...settings, runPlans: (settings.runPlans ?? []).filter((x) => x.id !== p.id) }); edited([]); }}>
                  <GlyphTrash /> Elimina “{p.name}”
                </button>
              ))}
            </div>
          </>
        )}
      </Card>
      {importing && <ImportProgram maxIncline={maxIncline} onSave={importPlan} onClose={() => setImporting(false)} />}

      <section ref={liveRef} className={`card run-live phase-${state.phase}${state.stepKind ? ` kind-${state.stepKind}` : ''}`}>
        {mode !== 'continuous' && cur && state.phase !== 'idle' && state.phase !== 'done' && (
          <div className="run-step" aria-live="polite">
            <span className="run-step-top">
              <span className="run-step-kind">{tm ? cur.label ?? `Serie ${state.stepIdx + 1}` : cur.label ?? KIND_LABEL[cur.kind]}</span>
              <span className="run-step-left">{stepText}</span>
            </span>
            <span className="run-step-bar">
              <span style={{ width: `${stepPct}%` }} />
            </span>
            {tm && (
              <div className="tm-now">
                <div>
                  <strong>{fmtKmh(kmhOf(cur))}</strong>
                  <span>km/h · {paceFromKmh(kmhOf(cur))} /km</span>
                </div>
                <div>
                  <strong>{fmtIncline(cur.incline)}%</strong>
                  <span>pendenza</span>
                </div>
              </div>
            )}
            <span className="muted small">
              {tm ? 'Serie' : 'Fase'} {state.stepIdx + 1} di {steps.length}
              {steps[state.stepIdx + 1]
                ? ` · poi ${tm ? `${steps[state.stepIdx + 1].label?.toLowerCase() ?? `serie ${state.stepIdx + 2}`}: ${treadmillSettings(steps[state.stepIdx + 1])}` : stepLabel(steps[state.stepIdx + 1])}`
                : tm ? ' · ultima serie' : ' · ultima fase'}
            </span>
          </div>
        )}
        {gps && active && (
          <div className="run-now">
            <span className="run-cap">Passo attuale</span>
            <span className="run-now-val">
              {fmtPaceSec(state.pace)} <small>min/km</small>
            </span>
          </div>
        )}
        <div className="run-metrics">
          <div>
            <span className="run-big">{fmtDuration(state.elapsed)}</span>
            <span className="run-cap">tempo</span>
          </div>
          <div>
            <span className="run-big">{tm ? fmtKm(tmMeters) : gps ? fmtKm(state.distance) : '–'}</span>
            <span className="run-cap">{tm ? 'km stimati' : 'km'}</span>
          </div>
          <div>
            <span className="run-big">{tm ? fmtPace(tmMeters, state.elapsed) : gps ? fmtPace(state.distance, state.elapsed) : '–'}</span>
            <span className="run-cap">passo medio</span>
          </div>
        </div>
        {gps && state.phase !== 'idle' && (
          <p className="muted small run-gps">
            {state.gps === 'ok' ? `GPS ok${state.accuracy ? ` (±${Math.round(state.accuracy)} m)` : ''}` : state.gps === 'denied' ? 'GPS non disponibile: controlla i permessi di posizione' : 'Cerco il segnale GPS…'}
          </p>
        )}

        {state.phase === 'idle' && (
          <button className="btn run-btn" disabled={mode !== 'continuous' && steps.length === 0} onClick={() => { run.start({ mode, steps: activeSteps ?? [], useGps: gps, planName, planId }); setTimeout(() => liveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>
            Avvia
          </button>
        )}
        {state.phase === 'running' && (
          <div className="run-controls">
            <button className="btn run-btn run-main" onClick={run.pause}>❚❚ Pausa</button>
            <div className="run-sub">
              {mode !== 'continuous' && <button className="btn-ghost" onClick={run.skip}>⏭ Salta fase</button>}
              <button className="btn-ghost run-stop" onClick={async () => (await confirmAction('Terminare la corsa?', { action: 'Termina' })) && run.stop()}>■ Termina</button>
            </div>
          </div>
        )}
        {state.phase === 'paused' && (
          <div className="run-controls">
            <button className="btn run-btn run-main" onClick={run.resume}>▶ Riprendi</button>
            <div className="run-sub">
              <button className="btn-ghost run-stop" onClick={async () => (await confirmAction('Terminare la corsa?', { action: 'Termina' })) && run.stop()}>■ Termina</button>
            </div>
          </div>
        )}
        {state.phase === 'idle' && !tm && (
          <a className="link-quiet" href="https://www.google.com/maps/search/percorsi+per+correre+vicino+a+me" target="_blank" rel="noreferrer">
            Cerca percorsi vicino a te su Google Maps
          </a>
        )}
        {state.phase === 'idle' && <p className="muted small">Lo schermo resta acceso durante la corsa. Il GPS e i segnali funzionano finché l’app è aperta in primo piano.</p>}
      </section>

      {state.phase === 'done' && (
        <RunSummary
          elapsed={state.elapsed}
          gpsDistanceM={tm ? Math.round(tmMeters) : state.distance}
          useGps={gps || tm}
          track={run.rawTrack()}
          laps={laps}
          mode={mode}
          planName={planName !== 'Personalizzata' ? planName : undefined}
          adapt={adaptive ? preview : undefined}
          previous={history.map((h) => h.m)}
          onSave={save}
          onDiscard={run.reset}
        />
      )}

      <Card id="run.history" icon={null} title="Le tue corse" summary={`${history.length} registrate`} defaultOpen={false}>
        {history.length === 0 ? (
          <p className="muted small">Ancora nessuna corsa.</p>
        ) : (
          <ul className="run-history">
            {history.slice(0, 40).map(({ date, m }) => (
              <li key={m.id} className="run-item">
                <Link className="run-item-main" to={`/giorno/${date}`}>
                  <span className={`run-item-icon ${m.mode === 'continuous' ? 'co' : 'iv'}`} aria-hidden="true">
                    <IconRun size={20} />
                  </span>
                  <span className="route-main">
                    <span className="run-item-meta">
                      {fromISO(date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                      <span className="run-tag">{m.mode === 'intervals' ? 'Intervalli' : m.mode === 'treadmill' ? 'Tapis roulant' : 'Continua'}</span>
                    </span>
                    <strong>{m.title || (m.mode === 'intervals' ? m.planName ?? 'Intervalli' : m.mode === 'treadmill' ? m.planName ?? 'Tapis roulant' : 'Corsa continua')}</strong>
                    <span className="muted small">
                      {fmtKm(m.distanceM)} km · {fmtDuration(m.durationSec)} · <b>{fmtPace(m.distanceM, m.durationSec)} /km</b>
                    </span>
                  </span>
                  <span className="run-item-go" aria-hidden="true">›</span>
                </Link>
                <button className="icon-btn small" aria-label="Elimina corsa" onClick={async () => (await confirmDelete('questa corsa')) && store.updateDay(date, (d) => ({ ...d, modules: d.modules.filter((x) => x.id !== m.id) }))}>
                  <GlyphTrash />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
