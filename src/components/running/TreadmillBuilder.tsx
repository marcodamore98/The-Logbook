import { confirmDelete } from '../Confirm';
import { GlyphPlus, GlyphTrash } from '../icons';
import { DragGrip, NumField } from '../ui';
import { useSortableList } from '../useBlockDrag';
import { DurationField } from '../WheelPicker';
import { fmtDuration, fmtKm } from '../../lib/running/geo';
import { kmhOf, paceFromKmh, planMeters, tStep } from '../../lib/running/treadmill';
import type { RunStep } from '../../lib/types';

/** One series: speed (km/h), incline (%) and duration, as set on the treadmill. */
function SeriesRow({ s, n, onChange, onRemove, sortProps }: { s: RunStep; n: number; onChange: (s: RunStep) => void; onRemove: () => void; sortProps: { className: string; style?: React.CSSProperties } }) {
  const kmh = kmhOf(s);
  return (
    <li {...sortProps} className={`plan-step tm-step ${sortProps.className}`}>
      <div className="tm-step-top">
        <DragGrip />
        <strong className="tm-series">Serie {n}</strong>
        <span className="tm-pace">{paceFromKmh(kmh)} /km</span>
        <button type="button" className="icon-btn small" aria-label={`Elimina la serie ${n}`} onClick={async () => (await confirmDelete(`la serie ${n}`)) && onRemove()}>
          <GlyphTrash />
        </button>
      </div>
      <div className="tm-step-set">
        <label>
          <span className="tm-cap">Velocità</span>
          <span className="tm-unit-field">
            <NumField value={kmh} max={30} label="Velocità in km/h" onChange={(v) => onChange({ ...s, kmh: Math.round(v * 10) / 10, paceSec: undefined })} />
            <small>km/h</small>
          </span>
        </label>
        <label>
          <span className="tm-cap">Inclinazione</span>
          <span className="tm-unit-field">
            <NumField value={s.incline ?? 0} max={30} label="Inclinazione in percentuale" onChange={(v) => onChange({ ...s, incline: Math.round(v * 2) / 2 })} />
            <small>%</small>
          </span>
        </label>
        <label>
          <span className="tm-cap">Durata</span>
          <DurationField label={`Serie ${n}: durata`} className="compact" value={s.value} onChange={(v) => onChange({ ...s, value: Math.max(5, v) })} />
        </label>
      </div>
    </li>
  );
}

/** A treadmill session is just a list of series, each with its own speed, incline and duration. */
export function TreadmillBuilder({ steps, onChange }: { steps: RunStep[]; onChange: (s: RunStep[]) => void }) {
  const sort = useSortableList(steps, onChange, { attr: 'tstep', handle: '.plan-step' });
  const total = steps.reduce((t, s) => t + s.value, 0);
  const addSeries = () => {
    const last = steps[steps.length - 1];
    onChange([...steps, last ? { ...tStep(last.value, kmhOf(last), last.incline ?? 0) } : tStep(180, 5, 0)]);
  };

  return (
    <div className="plan-builder tm-builder">
      {steps.length > 0 && (
        <>
          <p className="muted small">
            {steps.length} serie · {fmtDuration(total)} · circa {fmtKm(planMeters(steps))} km
          </p>
          <ol className="plan-steps" {...sort.container}>
            {steps.map((s, i) => (
              <SeriesRow key={s.id} n={i + 1} sortProps={sort.item(i)} s={s} onChange={(ns) => onChange(steps.map((x, k) => (k === i ? ns : x)))} onRemove={() => onChange(steps.filter((_, k) => k !== i))} />
            ))}
          </ol>
        </>
      )}
      <div className="row">
        <button type="button" className={steps.length ? 'btn-ghost small' : 'btn'} onClick={addSeries}>
          <GlyphPlus /> Aggiungi una serie
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
