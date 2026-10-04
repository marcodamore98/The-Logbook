import { useState } from 'react';
import { GlyphPlus, GlyphTrash } from '../icons';
import { NumField } from '../ui';
import { fmtDuration, fmtKm, KIND_LABEL } from '../../lib/running/geo';
import { fmtKmh, planMeters, tStep, treadmillRepeats } from '../../lib/running/treadmill';
import type { RunStep } from '../../lib/types';

const KINDS: RunStep['kind'][] = ['warmup', 'work', 'rest', 'cooldown'];

/** Pace as minutes : seconds per km, with the matching km/h for the treadmill display. */
function PaceField({ value, onChange }: { value: number; onChange: (sec: number) => void }) {
  const min = Math.floor(value / 60);
  const sec = Math.round(value % 60);
  return (
    <span className="tm-pace-field">
      <NumField value={min} min={2} max={20} label="Passo, minuti" onChange={(n) => onChange(Math.round(n) * 60 + sec)} />:
      <NumField value={sec} max={59} label="Passo, secondi" onChange={(n) => onChange(min * 60 + Math.round(n))} />
      <small>/km</small>
    </span>
  );
}

function StepRow({ s, onChange, onRemove }: { s: RunStep; onChange: (s: RunStep) => void; onRemove: () => void }) {
  const min = Math.floor(s.value / 60);
  const sec = s.value % 60;
  return (
    <li className={`plan-step tm-step step-${s.kind}`}>
      <div className="tm-step-top">
        <select value={s.kind} onChange={(e) => onChange({ ...s, kind: e.target.value as RunStep['kind'] })} aria-label="Tipo di fase">
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <span className="plan-value">
          <NumField value={min} label="Durata, minuti" onChange={(n) => onChange({ ...s, value: Math.max(5, Math.round(n) * 60 + sec) })} />′
          <NumField value={sec} max={59} label="Durata, secondi" onChange={(n) => onChange({ ...s, value: Math.max(5, min * 60 + Math.round(n)) })} />″
        </span>
        <button type="button" className="icon-btn small" aria-label="Elimina fase" onClick={onRemove}>
          <GlyphTrash />
        </button>
      </div>
      <div className="tm-step-set">
        <label>
          <span className="tm-cap">
            Passo <span className="tm-kmh">· {fmtKmh(s.paceSec ?? 420)} km/h</span>
          </span>
          <PaceField value={s.paceSec ?? 420} onChange={(paceSec) => onChange({ ...s, paceSec })} />
        </label>
        <label>
          <span className="tm-cap">Pendenza</span>
          <span className="tm-incline-field">
            <NumField value={s.incline ?? 0} max={30} label="Pendenza in percentuale" onChange={(incline) => onChange({ ...s, incline: Math.round(incline * 2) / 2 })} />
            <small>%</small>
          </span>
        </label>
      </div>
    </li>
  );
}

/** Builds a treadmill session: generated repeats or any sequence of time / pace / incline steps. */
export function TreadmillBuilder({ steps, onChange }: { steps: RunStep[]; onChange: (s: RunStep[]) => void }) {
  const [n, setN] = useState(6);
  const [workMin, setWorkMin] = useState(2);
  const [workPace, setWorkPace] = useState(330);
  const [restMin, setRestMin] = useState(2);
  const [restPace, setRestPace] = useState(450);
  const [incline, setIncline] = useState(1);
  const [warm, setWarm] = useState(5);
  const [cool, setCool] = useState(5);

  const generate = () =>
    onChange(treadmillRepeats(n, { sec: Math.round(workMin * 60), pace: workPace }, { sec: Math.round(restMin * 60), pace: restPace }, incline, { sec: Math.round(warm * 60), pace: restPace }, { sec: Math.round(cool * 60), pace: restPace + 30 }));

  const total = steps.reduce((t, s) => t + s.value, 0);

  return (
    <div className="plan-builder tm-builder">
      <div className="plan-gen tm-gen">
        <label className="field">
          <span className="field-label">Ripetizioni</span>
          <NumField value={n} min={1} max={50} onChange={(v) => setN(Math.round(v))} />
        </label>
        <label className="field">
          <span className="field-label">Veloce (min)</span>
          <NumField value={workMin} onChange={setWorkMin} />
        </label>
        <label className="field">
          <span className="field-label">Passo veloce</span>
          <PaceField value={workPace} onChange={setWorkPace} />
        </label>
        <label className="field">
          <span className="field-label">Recupero (min)</span>
          <NumField value={restMin} onChange={setRestMin} />
        </label>
        <label className="field">
          <span className="field-label">Passo recupero</span>
          <PaceField value={restPace} onChange={setRestPace} />
        </label>
        <label className="field">
          <span className="field-label">Pendenza (%)</span>
          <NumField value={incline} max={30} onChange={(v) => setIncline(Math.round(v * 2) / 2)} />
        </label>
        <label className="field">
          <span className="field-label">Riscaldamento (min)</span>
          <NumField value={warm} onChange={setWarm} />
        </label>
        <label className="field">
          <span className="field-label">Defaticamento (min)</span>
          <NumField value={cool} onChange={setCool} />
        </label>
        <button type="button" className="btn" onClick={generate}>
          Crea le fasi
        </button>
      </div>

      {steps.length > 0 && (
        <>
          <p className="muted small">
            {steps.length} fasi · {fmtDuration(total)} · circa {fmtKm(planMeters(steps))} km
          </p>
          <ol className="plan-steps">
            {steps.map((s, i) => (
              <StepRow key={s.id} s={s} onChange={(ns) => onChange(steps.map((x, k) => (k === i ? ns : x)))} onRemove={() => onChange(steps.filter((_, k) => k !== i))} />
            ))}
          </ol>
        </>
      )}
      <div className="row">
        <button
          type="button"
          className="btn-ghost small"
          onClick={() => {
            const last = steps[steps.length - 1];
            onChange([...steps, tStep('work', last?.value ?? 120, last?.paceSec ?? 420, last?.incline ?? 1)]);
          }}
        >
          <GlyphPlus /> Aggiungi una fase
        </button>
        {steps.length > 0 && (
          <button type="button" className="btn-ghost small" onClick={() => onChange([])}>
            Svuota
          </button>
        )}
      </div>
    </div>
  );
}
