import { useState } from 'react';
import { GlyphPlus, GlyphTrash } from '../icons';
import { NumField } from '../ui';
import { KIND_LABEL, planSummary } from '../../lib/running/geo';
import { repeats, step } from '../../lib/running/plans';
import type { RunStep } from '../../lib/types';

const KINDS: RunStep['kind'][] = ['warmup', 'work', 'rest', 'cooldown'];

/** value in the unit shown to the user: time → minutes:seconds as seconds, distance → metres. */
function StepRow({ s, onChange, onRemove }: { s: RunStep; onChange: (s: RunStep) => void; onRemove: () => void }) {
  const min = Math.floor(s.value / 60);
  const sec = s.value % 60;
  return (
    <li className={`plan-step step-${s.kind}`}>
      <select value={s.kind} onChange={(e) => onChange({ ...s, kind: e.target.value as RunStep['kind'] })} aria-label="Tipo di fase">
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
      <select value={s.by} onChange={(e) => onChange({ ...s, by: e.target.value as RunStep['by'], value: e.target.value === 'time' ? 60 : 400 })} aria-label="A tempo o a distanza">
        <option value="time">a tempo</option>
        <option value="distance">a distanza</option>
      </select>
      {s.by === 'time' ? (
        <span className="plan-value">
          <NumField value={min} label="Minuti" onChange={(n) => onChange({ ...s, value: Math.round(n) * 60 + sec })} />′
          <NumField value={sec} max={59} label="Secondi" onChange={(n) => onChange({ ...s, value: min * 60 + Math.round(n) })} />″
        </span>
      ) : (
        <span className="plan-value">
          <NumField value={s.value} label="Metri" onChange={(n) => onChange({ ...s, value: Math.round(n) })} /> m
        </span>
      )}
      <button type="button" className="icon-btn small" aria-label="Elimina fase" onClick={onRemove}>
        <GlyphTrash />
      </button>
    </li>
  );
}

/** Builds an interval session: warm-up, repeats of work/rest, cool-down, or any custom sequence. */
export function PlanBuilder({ steps, onChange }: { steps: RunStep[]; onChange: (s: RunStep[]) => void }) {
  const [n, setN] = useState(6);
  const [workBy, setWorkBy] = useState<RunStep['by']>('distance');
  const [workV, setWorkV] = useState(400);
  const [restSec, setRestSec] = useState(90);
  const [warm, setWarm] = useState(10);
  const [cool, setCool] = useState(5);

  const generate = () => onChange(repeats(n, { by: workBy, value: workV }, { by: 'time', value: restSec }, warm * 60, cool * 60));

  return (
    <div className="plan-builder">
      <div className="plan-gen">
        <label className="field">
          <span className="field-label">Ripetizioni</span>
          <NumField value={n} min={1} max={50} onChange={(v) => setN(Math.round(v))} />
        </label>
        <label className="field">
          <span className="field-label">Corsa veloce</span>
          <span className="plan-inline">
            <NumField value={workBy === 'time' ? workV / 60 : workV} onChange={(v) => setWorkV(workBy === 'time' ? Math.round(v * 60) : Math.round(v))} />
            <select value={workBy} onChange={(e) => { const by = e.target.value as RunStep['by']; setWorkBy(by); setWorkV(by === 'time' ? 60 : 400); }}>
              <option value="distance">metri</option>
              <option value="time">minuti</option>
            </select>
          </span>
        </label>
        <label className="field">
          <span className="field-label">Recupero (secondi)</span>
          <NumField value={restSec} onChange={(v) => setRestSec(Math.round(v))} />
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
          <p className="muted small">{planSummary(steps)}</p>
          <ol className="plan-steps">
            {steps.map((s, i) => (
              <StepRow key={s.id} s={s} onChange={(ns) => onChange(steps.map((x, k) => (k === i ? ns : x)))} onRemove={() => onChange(steps.filter((_, k) => k !== i))} />
            ))}
          </ol>
        </>
      )}
      <div className="row">
        <button type="button" className="btn-ghost small" onClick={() => onChange([...steps, step('work', 'time', 60)])}>
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
