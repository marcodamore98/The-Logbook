import { confirmDelete } from '../components/Confirm';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from '../components/charts';
import { GlyphTrash, IconRun } from '../components/icons';
import { PlanBuilder } from '../components/running/PlanBuilder';
import { TreadmillBuilder } from '../components/running/TreadmillBuilder';
import { RunSummary, type RunResult } from '../components/running/RunSummary';
import { Card, Field, uid } from '../components/ui';
import { fromISO, today } from '../lib/dates';
import { useRunSession } from '../lib/running/engine';
import { fmtDuration, fmtKm, fmtPace, fmtPaceSec, KIND_LABEL, stepLabel } from '../lib/running/geo';
import { presetPlans } from '../lib/running/plans';
import { doneMeters, fmtIncline, fmtKmh, kmhOf, lapMeters, paceFromKmh, treadmillPresets, treadmillSettings } from '../lib/running/treadmill';
import { useStore } from '../lib/store/StoreContext';
import type { RunModule, RunPlan, RunStep } from '../lib/types';

export default function RunPage() {
  const store = useStore();
  const { settings } = store;
  const [mode, setMode] = useState<'continuous' | 'intervals' | 'treadmill'>('continuous');
  const tm = mode === 'treadmill';
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [planName, setPlanName] = useState<string>('Personalizzata');
  const [useGps, setUseGps] = useState(true);
  const plans: RunPlan[] = useMemo(
    () => (tm ? [...treadmillPresets(), ...(settings.runPlans ?? []).filter((p) => p.treadmill)] : [...presetPlans(), ...(settings.runPlans ?? []).filter((p) => !p.treadmill)]),
    [settings.runPlans, tm],
  );

  const activeSteps = mode !== 'continuous' ? steps : undefined;
  const gps = useGps && !tm; // no GPS indoors: the distance comes from speed × time
  const run = useRunSession(activeSteps, gps);
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
    };
    await store.updateDay(today(), (d) => ({ ...d, modules: [...d.modules, m] }));
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
  };
  const choosePlan = (id: string) => {
    const p = plans.find((x) => x.id === id);
    if (!p) return;
    setSteps(p.steps.map((s) => ({ ...s, id: uid() })));
    setPlanName(p.name);
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
        <IconRun size={44} />
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
          <button role="tab" aria-selected={mode === 'intervals'} className={mode === 'intervals' ? 'on' : ''} disabled={active} onClick={() => { if (tm) { setSteps([]); setPlanName('Personalizzata'); } setMode('intervals'); }}>
            A intervalli
          </button>
          <button role="tab" aria-selected={tm} className={tm ? 'on' : ''} disabled={active} onClick={() => { if (!tm) { setSteps([]); setPlanName('Personalizzata'); } setMode('treadmill'); }}>
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
            <Field label="Sessione preimpostata o salvata">
              <select value={plans.find((p) => p.name === planName)?.id ?? ''} onChange={(e) => choosePlan(e.target.value)}>
                <option value="">Personalizzata (da zero)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            {tm ? (
              <TreadmillBuilder steps={steps} onChange={(s) => { setSteps(s); setPlanName('Personalizzata'); }} />
            ) : (
              <PlanBuilder steps={steps} onChange={(s) => { setSteps(s); setPlanName('Personalizzata'); }} />
            )}
            <div className="row">
              <button className="btn-ghost small" disabled={!steps.length} onClick={savePlan}>
                Salva questa sessione
              </button>
              {plans.filter((p) => isSaved(p.id) && p.name === planName).map((p) => (
                <button key={p.id} className="btn-ghost small" onClick={async () => (await confirmDelete(`“${p.name}”`)) && store.saveSettings({ ...settings, runPlans: (settings.runPlans ?? []).filter((x) => x.id !== p.id) })}>
                  <GlyphTrash /> Elimina “{p.name}”
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      <section ref={liveRef} className={`card run-live phase-${state.phase}${state.stepKind ? ` kind-${state.stepKind}` : ''}`}>
        {mode !== 'continuous' && cur && state.phase !== 'idle' && state.phase !== 'done' && (
          <div className="run-step" aria-live="polite">
            <span className="run-step-top">
              <span className="run-step-kind">{tm ? `Serie ${state.stepIdx + 1}` : KIND_LABEL[cur.kind]}</span>
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
                ? ` · poi ${tm ? `serie ${state.stepIdx + 2}: ${treadmillSettings(steps[state.stepIdx + 1])}` : stepLabel(steps[state.stepIdx + 1])}`
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
          <button className="btn run-btn" disabled={mode !== 'continuous' && steps.length === 0} onClick={() => { run.start(); setTimeout(() => liveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>
            Avvia
          </button>
        )}
        {state.phase === 'running' && (
          <div className="run-controls">
            <button className="btn run-btn run-main" onClick={run.pause}>❚❚ Pausa</button>
            <div className="run-sub">
              {mode !== 'continuous' && <button className="btn-ghost" onClick={run.skip}>⏭ Salta fase</button>}
              <button className="btn-ghost run-stop" onClick={() => window.confirm('Terminare la corsa?') && run.stop()}>■ Termina</button>
            </div>
          </div>
        )}
        {state.phase === 'paused' && (
          <div className="run-controls">
            <button className="btn run-btn run-main" onClick={run.resume}>▶ Riprendi</button>
            <div className="run-sub">
              <button className="btn-ghost run-stop" onClick={() => window.confirm('Terminare la corsa?') && run.stop()}>■ Termina</button>
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
