import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from '../components/charts';
import { GlyphTrash, IconRun } from '../components/icons';
import { PlanBuilder } from '../components/running/PlanBuilder';
import { Card, Field, uid } from '../components/ui';
import { formatLong, today } from '../lib/dates';
import { useRunSession } from '../lib/running/engine';
import { fmtDuration, fmtKm, fmtPace, kmSplits, KIND_LABEL, planSummary, stepLabel } from '../lib/running/geo';
import { presetPlans } from '../lib/running/plans';
import { useStore } from '../lib/store/StoreContext';
import type { RunModule, RunPlan, RunStep } from '../lib/types';

export default function RunPage() {
  const store = useStore();
  const { settings } = store;
  const [mode, setMode] = useState<'continuous' | 'intervals'>('continuous');
  const [steps, setSteps] = useState<RunStep[]>(() => presetPlans()[0].steps.map((s) => ({ ...s })));
  const [planName, setPlanName] = useState<string>(presetPlans()[0].name);
  const [useGps, setUseGps] = useState(true);
  const plans: RunPlan[] = useMemo(() => [...presetPlans(), ...(settings.runPlans ?? [])], [settings.runPlans]);

  const activeSteps = mode === 'intervals' ? steps : undefined;
  const run = useRunSession(activeSteps, useGps);
  const { state } = run;
  const liveRef = useRef<HTMLElement>(null);
  const active = state.phase === 'running' || state.phase === 'paused';

  // Saving
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [manualKm, setManualKm] = useState('');
  const gpsKm = state.distance / 1000;
  const finalKm = manualKm !== '' ? Number(manualKm.replace(',', '.')) : gpsKm;

  const save = async () => {
    const m: RunModule = {
      kind: 'run',
      id: uid(),
      title: title.trim() || undefined,
      mode,
      planName: mode === 'intervals' ? planName : undefined,
      steps: mode === 'intervals' ? steps : undefined,
      distanceM: Math.round(finalKm * 1000),
      durationSec: Math.round(state.elapsed),
      startedAt: Date.now() - state.elapsed * 1000,
      track: run.finalTrack(),
      notes: notes.trim() || undefined,
    };
    await store.updateDay(today(), (d) => ({ ...d, modules: [...d.modules, m] }));
    run.reset();
    setTitle('');
    setNotes('');
    setManualKm('');
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
    const name = window.prompt('Nome della sessione', planName.startsWith('Ripetute') || planName.startsWith('Fartlek') ? '' : planName)?.trim();
    if (!name) return;
    const plan: RunPlan = { id: uid(), name, steps: steps.map((s) => ({ ...s })) };
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

      <Card id="run.setup" icon={null} title="Che corsa fai?" summary={mode === 'continuous' ? 'Continua' : `Intervalli · ${planName}`} defaultOpen={true}>
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={mode === 'continuous'} className={mode === 'continuous' ? 'on' : ''} disabled={active} onClick={() => setMode('continuous')}>
            Continua
          </button>
          <button role="tab" aria-selected={mode === 'intervals'} className={mode === 'intervals' ? 'on' : ''} disabled={active} onClick={() => setMode('intervals')}>
            A intervalli
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={useGps} disabled={active} onChange={(e) => setUseGps(e.target.checked)} /> Usa il GPS (disattivalo per il tapis roulant)
        </label>
        {mode === 'intervals' && !active && (
          <>
            <Field label="Sessione">
              <select value={plans.find((p) => p.name === planName)?.id ?? ''} onChange={(e) => choosePlan(e.target.value)}>
                <option value="">Personalizzata</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <PlanBuilder steps={steps} onChange={(s) => { setSteps(s); setPlanName('Personalizzata'); }} />
            <div className="row">
              <button className="btn-ghost small" disabled={!steps.length} onClick={savePlan}>
                Salva questa sessione
              </button>
              {plans.filter((p) => isSaved(p.id) && p.name === planName).map((p) => (
                <button key={p.id} className="btn-ghost small" onClick={() => window.confirm(`Eliminare “${p.name}”?`) && store.saveSettings({ ...settings, runPlans: (settings.runPlans ?? []).filter((x) => x.id !== p.id) })}>
                  <GlyphTrash /> Elimina “{p.name}”
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      <section ref={liveRef} className={`card run-live phase-${state.phase}${state.stepKind ? ` kind-${state.stepKind}` : ''}`}>
        {mode === 'intervals' && cur && state.phase !== 'idle' && state.phase !== 'done' && (
          <div className="run-step" aria-live="polite">
            <span className="run-step-kind">{KIND_LABEL[cur.kind]}</span>
            <span className="run-step-left">{stepText}</span>
            <span className="run-step-bar">
              <span style={{ width: `${stepPct}%` }} />
            </span>
            <span className="muted small">
              Fase {state.stepIdx + 1} di {steps.length}
              {steps[state.stepIdx + 1] ? ` · poi ${stepLabel(steps[state.stepIdx + 1])}` : ' · ultima fase'}
            </span>
          </div>
        )}
        <div className="run-metrics">
          <div>
            <span className="run-big">{fmtDuration(state.elapsed)}</span>
            <span className="run-cap">tempo</span>
          </div>
          <div>
            <span className="run-big">{useGps ? fmtKm(state.distance) : '–'}</span>
            <span className="run-cap">km</span>
          </div>
          <div>
            <span className="run-big">{useGps ? fmtPace(state.distance, state.elapsed) : '–'}</span>
            <span className="run-cap">min/km</span>
          </div>
        </div>
        {useGps && state.phase !== 'idle' && (
          <p className="muted small run-gps">
            {state.gps === 'ok' ? `GPS ok${state.accuracy ? ` (±${Math.round(state.accuracy)} m)` : ''}` : state.gps === 'denied' ? 'GPS non disponibile: controlla i permessi di posizione' : 'Cerco il segnale GPS…'}
          </p>
        )}

        {state.phase === 'idle' && (
          <button className="btn run-btn" disabled={mode === 'intervals' && steps.length === 0} onClick={() => { run.start(); setTimeout(() => liveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>
            Avvia
          </button>
        )}
        {state.phase === 'running' && (
          <div className="run-controls">
            <button className="btn-ghost run-btn" onClick={run.pause}>Pausa</button>
            {mode === 'intervals' && <button className="btn-ghost" onClick={run.skip}>Salta fase</button>}
            <button className="btn-ghost danger" onClick={() => window.confirm('Terminare la corsa?') && run.stop()}>Fine</button>
          </div>
        )}
        {state.phase === 'paused' && (
          <div className="run-controls">
            <button className="btn run-btn" onClick={run.resume}>Riprendi</button>
            <button className="btn-ghost danger" onClick={() => window.confirm('Terminare la corsa?') && run.stop()}>Fine</button>
          </div>
        )}
        {state.phase === 'done' && (
          <div className="run-save">
            <h3 className="sub">Corsa terminata</h3>
            <div className="grid">
              <Field label="Titolo">
                <input value={title} placeholder="es. Giro del parco" onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label="Distanza (km)">
                <input inputMode="decimal" value={manualKm} placeholder={gpsKm.toFixed(2)} onChange={(e) => setManualKm(e.target.value)} />
              </Field>
              <Field label="Note" wide>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            <div className="row">
              <button className="btn" onClick={save}>Salva nella giornata di oggi</button>
              <button className="btn-ghost" onClick={() => window.confirm('Scartare questa corsa?') && run.reset()}>Scarta</button>
            </div>
          </div>
        )}
        {state.phase === 'idle' && (
          <a className="link-quiet" href="https://www.google.com/maps/search/percorsi+per+correre+vicino+a+me" target="_blank" rel="noreferrer">
            Cerca percorsi vicino a te su Google Maps
          </a>
        )}
        {state.phase === 'idle' && <p className="muted small">Lo schermo resta acceso durante la corsa. Il GPS e i segnali funzionano finché l’app è aperta in primo piano.</p>}
      </section>

      <Card id="run.history" icon={null} title="Le tue corse" summary={`${history.length} registrate`} defaultOpen={false}>
        {history.length === 0 ? (
          <p className="muted small">Ancora nessuna corsa.</p>
        ) : (
          <ul className="run-history">
            {history.slice(0, 40).map(({ date, m }) => (
              <li key={m.id}>
                <div className="route-main">
                  <strong>{m.title || (m.mode === 'intervals' ? m.planName ?? 'Intervalli' : 'Corsa continua')}</strong>
                  <span className="muted small capitalize">
                    {formatLong(date)} · {fmtKm(m.distanceM)} km · {fmtDuration(m.durationSec)} · {fmtPace(m.distanceM, m.durationSec)}/km
                    {m.track && kmSplits(m.track).length ? ` · migliore ${fmtDuration(Math.min(...kmSplits(m.track)))}/km` : ''}
                  </span>
                  {m.mode === 'intervals' && m.steps && <span className="muted small">{planSummary(m.steps)}</span>}
                </div>
                <Link className="btn-ghost small" to={`/giorno/${date}`}>Giorno</Link>
                <button className="icon-btn small" aria-label="Elimina corsa" onClick={() => window.confirm('Eliminare questa corsa?') && store.updateDay(date, (d) => ({ ...d, modules: d.modules.filter((x) => x.id !== m.id) }))}>
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
