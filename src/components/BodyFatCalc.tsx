import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { BodyLog } from '../lib/types';
import { useStore } from '../lib/store/StoreContext';
import { fmt } from './charts';
import { NumberInput } from './ui';

type Sex = 'f' | 'm';

/** US Navy body-fat estimate (circumferences in cm). */
export function navyBodyFat(sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipCm?: number): number | undefined {
  const log = Math.log10;
  if (sex === 'm') {
    if (waistCm <= neckCm) return undefined;
    return 495 / (1.0324 - 0.19077 * log(waistCm - neckCm) + 0.15456 * log(heightCm)) - 450;
  }
  if (!hipCm || waistCm + hipCm <= neckCm) return undefined;
  return 495 / (1.29579 - 0.35004 * log(waistCm + hipCm - neckCm) + 0.221 * log(heightCm)) - 450;
}

/** Sheet that estimates body fat from a few tape measurements and writes it into the day. */
export function BodyFatCalc({ last, onUse, onClose }: { last: BodyLog; onUse: (p: Partial<BodyLog>) => void; onClose: () => void }) {
  const store = useStore();
  const { settings } = store;
  const profile = settings.profile ?? {};
  const setProfile = (p: Partial<typeof profile>) => store.saveSettings({ ...settings, profile: { ...profile, ...p } });
  const [m, setM] = useState({ neckCm: last.neckCm, waistCm: last.waistCm, hipCm: last.hipCm });
  const sex = profile.sex;
  const h = profile.heightCm;
  const raw = sex && h && m.neckCm && m.waistCm ? navyBodyFat(sex, h, m.neckCm, m.waistCm, m.hipCm) : undefined;
  const pct = raw !== undefined && raw > 2 && raw < 70 ? Math.round(raw * 10) / 10 : undefined;

  const field = (label: string, hint: string, value: number | undefined, set: (v: number | undefined) => void) => (
    <label className="bf-field">
      <span className="bf-label">{label}</span>
      <span className="bf-input">
        <NumberInput value={value} step={0.5} onChange={set} />
        <span className="unit">cm</span>
      </span>
      <span className="bf-hint">{hint}</span>
    </label>
  );

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet bf-calc" role="dialog" aria-label="Calcolo massa grassa" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="bf-head">
          <div>
            <h2 className="sheet-title">Calcola la massa grassa</h2>
            <p className="muted small">Metodo US Navy: metro da sarta, al mattino, a digiuno. Stima con margine di circa ±3–4%, utile soprattutto per l'andamento.</p>
          </div>
          <button type="button" className="icon-btn small" aria-label="Chiudi" onClick={onClose}>
            ✕
          </button>
        </div>
        <span className="bf-label">Sesso biologico</span>
        <div className="segmented bf-sex" role="radiogroup" aria-label="Formula">
          {(
            [
              ['f', 'Donna'],
              ['m', 'Uomo'],
            ] as [Sex, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={sex === id} className={sex === id ? 'on' : ''} onClick={() => setProfile({ sex: id })}>
              {label}
            </button>
          ))}
        </div>
        <div className="bf-grid">
          {field('Altezza', 'viene ricordata', h, (v) => setProfile({ heightCm: v }))}
          {field('Collo', 'appena sotto la laringe', m.neckCm, (v) => setM({ ...m, neckCm: v }))}
          {field('Vita', sex === 'm' ? "all'altezza dell'ombelico" : 'nel punto più stretto', m.waistCm, (v) => setM({ ...m, waistCm: v }))}
          {sex !== 'm' && field('Fianchi', 'nel punto più largo dei glutei', m.hipCm, (v) => setM({ ...m, hipCm: v }))}
        </div>
        <div className="bf-result" aria-live="polite">
          <span className="bf-cap">
            <i aria-hidden="true" /> Stima calcolata
          </span>
          {pct !== undefined ? (
            <span className="bf-big">
              <strong>{fmt(pct, 1)}%</strong> <span>massa grassa stimata</span>
            </span>
          ) : (
            <span className="muted">{sex ? 'Inserisci le misure' : 'Scegli la formula e inserisci le misure'}</span>
          )}
        </div>
        <button
          className="lime-banner"
          disabled={pct === undefined}
          onClick={() => {
            onUse({ bodyFatPct: pct, ...m });
            onClose();
          }}
        >
          <span>Usa questo valore</span>
          <span aria-hidden="true">›</span>
        </button>
        <button className="btn-ghost cancel-banner" onClick={onClose}>
          Annulla
        </button>
      </div>
    </div>,
    document.body,
  );
}
