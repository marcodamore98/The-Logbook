import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store/StoreContext';
import { allExercises, EQUIPMENT, KINDS, MUSCLES } from '../../lib/training/exercises';
import type { ExerciseDef, ExerciseKind } from '../../lib/types';
import { GlyphClose, GlyphPlus } from '../icons';
import { Field, uid } from '../ui';

/** Searchable exercise library with muscle filter and custom-exercise creation. */
export function ExercisePicker({ onPick, onClose, multiple }: { onPick: (ids: string[]) => void; onClose: () => void; multiple?: boolean }) {
  const { settings, saveSettings } = useStore();
  const custom = settings.exercises ?? [];
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState<ExerciseDef | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return allExercises(custom).filter(
      (e) => (!muscle || e.muscle === muscle || e.secondary?.includes(muscle)) && (!t || e.name.toLowerCase().includes(t) || e.equipment.toLowerCase().includes(t)),
    );
  }, [q, muscle, custom]);

  const choose = (id: string) => {
    if (!multiple) return onPick([id]);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Scegli esercizio" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{creating ? 'Nuovo esercizio' : 'Esercizi'}</h2>
          <button className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <GlyphClose />
          </button>
        </div>
        {creating ? (
          <div className="grid">
            <Field label="Nome" wide>
              <input autoFocus value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} placeholder="es. Panca inclinata alla Technogym" />
            </Field>
            <Field label="Muscolo principale">
              <select value={creating.muscle} onChange={(e) => setCreating({ ...creating, muscle: e.target.value })}>
                {MUSCLES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Attrezzo">
              <select value={creating.equipment} onChange={(e) => setCreating({ ...creating, equipment: e.target.value })}>
                {EQUIPMENT.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Tipo di misura">
              <select value={creating.kind} onChange={(e) => setCreating({ ...creating, kind: e.target.value as ExerciseKind })}>
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="row field-wide">
              <button
                className="btn"
                disabled={!creating.name.trim()}
                onClick={() => {
                  const ex = { ...creating, name: creating.name.trim() };
                  saveSettings({ ...settings, exercises: [...custom, ex] });
                  setCreating(null);
                  choose(ex.id);
                }}
              >
                Salva esercizio
              </button>
              <button className="btn-ghost" onClick={() => setCreating(null)}>
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="picker-tools">
              <input type="search" autoFocus placeholder="Cerca esercizio o attrezzo…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Gruppo muscolare">
                <option value="">Tutti i muscoli</option>
                {MUSCLES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <ul className="ex-list">
              {list.map((e) => (
                <li key={e.id}>
                  <button className={`ex-item${picked.includes(e.id) ? ' on' : ''}`} onClick={() => choose(e.id)}>
                    <span className="ex-name">{e.name}</span>
                    <span className="ex-meta">
                      {e.muscle} · {e.equipment}
                      {e.custom ? ' · personale' : ''}
                    </span>
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="empty">Nessun esercizio trovato.</li>}
            </ul>
            <div className="sheet-foot">
              <button
                className="btn-ghost"
                onClick={() => setCreating({ id: `custom-${uid()}`, name: q, muscle: muscle || 'Petto', equipment: 'Macchina', kind: 'weight_reps', custom: true })}
              >
                <GlyphPlus /> Crea esercizio
              </button>
              {multiple && (
                <button className="btn" disabled={!picked.length} onClick={() => onPick(picked)}>
                  Aggiungi {picked.length || ''}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
