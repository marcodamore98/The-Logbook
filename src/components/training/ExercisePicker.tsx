import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store/StoreContext';
import { allExercises, EQUIPMENT, KINDS, MUSCLES } from '../../lib/training/exercises';
import type { ExerciseDef, ExerciseKind } from '../../lib/types';
import { ExAvatar } from './ExAvatar';
import { ExerciseDetail } from './ExerciseDetail';
import { Field, uid } from '../ui';

/** Searchable exercise library with muscle filter and custom-exercise creation. */
export function ExercisePicker({ onPick, onClose, multiple }: { onPick: (ids: string[]) => void; onClose: () => void; multiple?: boolean }) {
  const { settings, saveSettings, history } = useStore();
  const custom = settings.exercises ?? [];
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equip, setEquip] = useState('');
  const [filter, setFilter] = useState<null | 'muscle' | 'equipment'>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState<ExerciseDef | null>(null);

  const list = useMemo(() => {
    // Every typed word must appear somewhere, in any order and ignoring accents: "french cavi" → "French press ai cavi".
    const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const words = norm(q).split(/\s+/).filter(Boolean);
    return allExercises(custom).filter(
      (e) => (!muscle || e.muscle === muscle || e.secondary?.includes(muscle)) && (!equip || e.equipment === equip) && (!words.length || words.every((w) => norm(`${e.name} ${e.equipment} ${e.muscle}`).includes(w))),
    );
  }, [q, muscle, equip, custom]);

  // Most recently used first, as the "recent exercises" shortcut.
  const recent = useMemo(() => {
    const last = (id: string) => history.get(id)?.[0]?.date ?? '';
    return list.filter((e) => last(e.id)).sort((a, b) => last(b.id).localeCompare(last(a.id))).slice(0, 12);
  }, [list, history]);
  const showRecent = !q.trim() && !muscle && !equip && recent.length > 0;
  const rest = useMemo(() => [...list].sort((a, b) => a.name.localeCompare(b.name, 'it')), [list]);

  const choose = (id: string) => {
    if (!multiple) return onPick([id]);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const row = (e: ExerciseDef) => (
    <li key={e.id}>
      <div className={`ex-row${picked.includes(e.id) ? ' on' : ''}`}>
        <button className="ex-row-main" onClick={() => choose(e.id)}>
          <ExAvatar muscle={e.muscle} size={44} />
          <span className="ex-row-text">
            <span className="ex-name">{e.name}</span>
            <span className="ex-meta">
              {e.muscle}
              {e.custom ? ' · personale' : ''}
            </span>
          </span>
          {picked.includes(e.id) && <span className="ex-picked">✓</span>}
        </button>
        <button className="icon-btn small ex-info" aria-label={`Dettagli di ${e.name}`} onClick={() => setInfo(e.id)}>
          ⓘ
        </button>
      </div>
    </li>
  );

  const MUSCLE_GROUPS: [string, string[]][] = [
    ['Parte superiore', ['Petto', 'Dorsali', 'Trapezi', 'Lombari', 'Spalle', 'Bicipiti', 'Tricipiti', 'Avambracci', 'Addome']],
    ['Parte inferiore', ['Quadricipiti', 'Femorali', 'Glutei', 'Polpacci', 'Adduttori', 'Abduttori']],
    ['Altro', ['Cardio', 'Corpo intero']],
  ];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet picker-sheet" role="dialog" aria-label="Scegli esercizio" onClick={(e) => e.stopPropagation()}>
        <div className="picker-bar">
          <button className="link-btn" onClick={creating ? () => setCreating(null) : onClose}>
            Annulla
          </button>
          <h2>{creating ? 'Nuovo esercizio' : 'Aggiungi esercizio'}</h2>
          {creating ? (
            <button
              className="link-btn strong"
              disabled={!creating.name.trim()}
              onClick={() => {
                const ex = { ...creating, name: creating.name.trim() };
                saveSettings({ ...settings, exercises: [...custom, ex] });
                setCreating(null);
                choose(ex.id);
              }}
            >
              Salva
            </button>
          ) : (
            <button className="link-btn strong" onClick={() => setCreating({ id: `custom-${uid()}`, name: q, muscle: muscle || 'Petto', equipment: equip || 'Macchina', kind: 'weight_reps', custom: true })}>
              Crea
            </button>
          )}
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
          </div>
        ) : (
          <>
            <input className="picker-search" type="search" placeholder="Cerca esercizio" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="picker-filters">
              <button className={`filter-btn${equip ? ' on' : ''}`} onClick={() => setFilter('equipment')}>
                {equip || "Tutta l'attrezzatura"}
              </button>
              <button className={`filter-btn${muscle ? ' on' : ''}`} onClick={() => setFilter('muscle')}>
                {muscle || 'Tutti i muscoli'}
              </button>
            </div>
            <div className="ex-scroll">
              {showRecent && (
                <>
                  <h3 className="list-title">Esercizi recenti</h3>
                  <ul className="ex-list">{recent.map(row)}</ul>
                  <h3 className="list-title">Tutti gli esercizi</h3>
                </>
              )}
              <ul className="ex-list">
                {rest.map(row)}
                {rest.length === 0 && <li className="empty">Nessun esercizio trovato.</li>}
              </ul>
            </div>
            {multiple && (
              <div className="sheet-foot">
                <span className="muted small">{picked.length ? `${picked.length} selezionati` : 'Tocca per selezionare'}</span>
                <button className="btn" disabled={!picked.length} onClick={() => onPick(picked)}>
                  Aggiungi {picked.length || ''}
                </button>
              </div>
            )}
          </>
        )}

        {filter && (
          <div className="subsheet" role="dialog" aria-label={filter === 'muscle' ? 'Gruppo muscolare' : 'Attrezzatura'}>
            <div className="grabber" />
            <h3>{filter === 'muscle' ? 'Gruppo muscolare' : 'Attrezzatura'}</h3>
            <div className="subsheet-body">
              {filter === 'muscle' ? (
                MUSCLE_GROUPS.map(([title, items]) => (
                  <section key={title}>
                    <h4 className="list-title">{title}</h4>
                    <div className="tile-grid">
                      {items.map((m) => (
                        <button key={m} className={`pick-tile${muscle === m ? ' on' : ''}`} onClick={() => setMuscle(muscle === m ? '' : m)}>
                          <ExAvatar muscle={m} size={44} />
                          <span>{m}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="tile-grid">
                  {EQUIPMENT.map((m) => (
                    <button key={m} className={`pick-tile${equip === m ? ' on' : ''}`} onClick={() => setEquip(equip === m ? '' : m)}>
                      <ExAvatar muscle={m === 'Altro' ? 'Corpo intero' : 'Quadricipiti'} size={44} />
                      <span>{m}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="subsheet-foot">
              <button
                className="btn-ghost"
                onClick={() => {
                  setMuscle('');
                  setEquip('');
                }}
              >
                Cancella i filtri
              </button>
              <button className="btn" onClick={() => setFilter(null)}>
                Mostra {list.length} risultati
              </button>
            </div>
          </div>
        )}
        {info && <ExerciseDetail id={info} onClose={() => setInfo(null)} />}
      </div>
    </div>
  );
}
