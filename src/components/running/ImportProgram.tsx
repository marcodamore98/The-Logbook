import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sym } from '../icons';
import { Field } from '../ui';
import { fmtDuration, fmtKm } from '../../lib/running/geo';
import { atLevel, parseProgram, phaseLines } from '../../lib/running/program';
import { planMeters } from '../../lib/running/treadmill';
import type { RunPlan } from '../../lib/types';

/**
 * "Importa programma": the text of a treadmill programme (a table copied from a chat, or lines
 * like "0:00-2:00 4,5 km/h 5% Riscaldamento") becomes phases, with a preview before saving.
 */
export function ImportProgram({ maxIncline, onSave, onClose }: { maxIncline: number; onSave: (p: RunPlan) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const parsed = useMemo(() => (text.trim() ? parseProgram(text) : null), [text]);
  const steps = parsed?.steps ?? [];
  const capped = steps.some((s) => (s.incline ?? 0) > maxIncline);
  const shown = useMemo(() => phaseLines(atLevel(steps, 0, maxIncline)), [steps, maxIncline]);
  const total = steps.reduce((t, s) => t + s.value, 0);

  const save = () => {
    if (!parsed || !steps.length) return;
    onSave({ id: `imp-${Date.now().toString(36)}`, name: name.trim() || parsed.name, steps, treadmill: true, notes: parsed.notes });
  };

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet import-sheet" role="dialog" aria-label="Importa un programma" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>Importa un programma</h2>
          <button type="button" className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <Sym name="close" size={22} />
          </button>
        </div>
        <p className="muted small">Incolla il programma del tapis roulant, anche copiato da una chat o da una tabella: per ogni fase servono i minuti (es. 0:00-2:00), la velocità in km/h, la pendenza in % e, se c’è, il nome.</p>
        <textarea
          className="import-text"
          rows={7}
          value={text}
          placeholder={'Allenamento 10′\n0:00-2:00  4,5 km/h  5%  Riscaldamento\n2:00-4:00  5,0 km/h  9%  Salita\n…'}
          onChange={(e) => setText(e.target.value)}
        />
        {parsed && (
          steps.length ? (
            <>
              <Field label="Nome del programma">
                <input value={name} placeholder={parsed.name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <p className="muted small">
                {steps.length} fasi · {fmtDuration(total)} · circa {fmtKm(planMeters(steps))} km
              </p>
              <ol className="import-phases">
                {shown.map((l, i) => (
                  <li key={i} className={`k-${steps[i].kind}`}>
                    <span className="ip-time">{l.time}</span>
                    <strong className="ip-label">{l.label}</strong>
                    <span className="ip-val">{l.kmh}</span>
                    <span className="ip-val">{l.incline}</span>
                  </li>
                ))}
              </ol>
              {capped && <p className="import-warn">Il tuo tapis roulant arriva al {maxIncline}%: le fasi più ripide useranno il {maxIncline}%.</p>}
              {parsed.warnings.map((w) => (
                <p key={w} className="import-warn">{w}</p>
              ))}
              {parsed.notes && (
                <div className="run-tips">
                  <span className="stat-label">Consigli del programma</span>
                  <p>{parsed.notes}</p>
                </div>
              )}
              <button type="button" className="btn run-btn" onClick={save}>
                Salva il programma
              </button>
            </>
          ) : (
            <p className="import-warn">Non trovo le fasi: ogni fase deve avere almeno i minuti (es. “0:00-2:00” o “2 min”).</p>
          )
        )}
      </div>
    </div>,
    document.body,
  );
}
