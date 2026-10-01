import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store/StoreContext';
import type {
  ClinicalModule,
  Module,
  NoteModule,
  OutingModule,
  PhotoModule,
  StudyModule,
  SurgeryModule,
  WorkoutModule,
} from '../../lib/types';
import {
  APPROACHES,
  CLAVIEN,
  CLINICAL_ACTIVITIES,
  EXERCISES,
  exerciseLabel,
  OUTING_TYPES,
  PROCEDURES,
  SETTINGS_URGENCY,
  STUDY_AREAS,
  STUDY_TYPES,
  SURGICAL_ROLES,
  WORKOUT_TYPES,
} from '../../lib/vocab';
import { GlyphClose, GlyphPlus, GlyphTrash } from '../icons';
import { Field, NumberInput, uid, VocabSelect } from '../ui';

type Props<M> = { value: M; onChange: (m: M) => void };

function SurgeryEditor({ value: m, onChange }: Props<SurgeryModule>) {
  const { settings } = useStore();
  const set = (p: Partial<SurgeryModule>) => onChange({ ...m, ...p });
  return (
    <div className="grid">
      <Field label="Intervento" wide>
        <VocabSelect items={PROCEDURES} value={m.procedureId} onChange={(procedureId) => set({ procedureId })} placeholder="Seleziona intervento…" />
      </Field>
      <Field label="Ruolo">
        <VocabSelect items={SURGICAL_ROLES} value={m.role} onChange={(role) => set({ role })} />
      </Field>
      <Field label="Via d’accesso">
        <VocabSelect items={APPROACHES} value={m.approach} onChange={(approach) => set({ approach })} />
      </Field>
      <Field label="Regime">
        <VocabSelect items={SETTINGS_URGENCY} value={m.setting} onChange={(setting) => set({ setting })} />
      </Field>
      <Field label="Durata (min)">
        <NumberInput value={m.durationMin} onChange={(durationMin) => set({ durationMin })} step={5} />
      </Field>
      <Field label="Complicanze">
        <VocabSelect items={CLAVIEN} value={m.clavien} onChange={(clavien) => set({ clavien })} />
      </Field>
      <Field label="Tutor / primo operatore">
        <select value={m.tutorId ?? ''} onChange={(e) => set({ tutorId: e.target.value || undefined })}>
          <option value="">—</option>
          {settings.colleagues.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note (senza dati identificativi della paziente)" wide>
        <textarea rows={2} value={m.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </div>
  );
}

function ClinicalEditor({ value: m, onChange }: Props<ClinicalModule>) {
  const set = (p: Partial<ClinicalModule>) => onChange({ ...m, ...p });
  return (
    <div className="grid">
      <Field label="Attività" wide>
        <VocabSelect items={CLINICAL_ACTIVITIES} value={m.activityId} onChange={(activityId) => set({ activityId })} />
      </Field>
      <Field label="Numero">
        <NumberInput value={m.count} min={1} onChange={(n) => set({ count: n ?? 1 })} />
      </Field>
      <Field label="Note" wide>
        <textarea rows={2} value={m.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </div>
  );
}

function StudyEditor({ value: m, onChange }: Props<StudyModule>) {
  const set = (p: Partial<StudyModule>) => onChange({ ...m, ...p });
  return (
    <div className="grid">
      <Field label="Titolo / argomento" wide>
        <input value={m.title} onChange={(e) => set({ title: e.target.value })} placeholder="es. Linee guida SIGO emorragia post partum" />
      </Field>
      <Field label="Tipo">
        <VocabSelect items={STUDY_TYPES} value={m.type} onChange={(type) => set({ type })} />
      </Field>
      <Field label="Area">
        <VocabSelect items={STUDY_AREAS} value={m.area} onChange={(area) => set({ area })} />
      </Field>
      <Field label="Durata (min)">
        <NumberInput value={m.durationMin} step={15} onChange={(n) => set({ durationMin: n ?? 0 })} />
      </Field>
      <Field label="Appunti" wide>
        <textarea rows={3} value={m.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </div>
  );
}

function WorkoutEditor({ value: m, onChange }: Props<WorkoutModule>) {
  const set = (p: Partial<WorkoutModule>) => onChange({ ...m, ...p });
  const endurance = ['run', 'bike', 'swim', 'walk'].includes(m.type);
  const setEx = (i: number, ex: WorkoutModule['exercises'][number]) =>
    set({ exercises: m.exercises.map((e, j) => (j === i ? ex : e)) });
  return (
    <div className="grid">
      {m.source === 'hevy' && (
        <p className="field-wide muted small">Importato da Hevy{m.title ? ` · ${m.title}` : ''}. Una nuova importazione aggiorna questa scheda.</p>
      )}
      <Field label="Tipo">
        <VocabSelect items={WORKOUT_TYPES} value={m.type} onChange={(type) => set({ type })} />
      </Field>
      <Field label="Durata (min)">
        <NumberInput value={m.durationMin} step={5} onChange={(n) => set({ durationMin: n ?? 0 })} />
      </Field>
      <Field label="Intensità percepita (RPE 1–10)">
        <NumberInput value={m.rpe} min={1} onChange={(rpe) => set({ rpe: rpe === undefined ? undefined : Math.min(10, rpe) })} />
      </Field>
      {endurance && (
        <Field label="Distanza (km)">
          <NumberInput value={m.distanceKm} step={0.1} onChange={(distanceKm) => set({ distanceKm })} />
        </Field>
      )}
      {!endurance && (
        <div className="field-wide exercises">
          {m.exercises.map((ex, i) => (
            <div key={i} className="exercise">
              <div className="exercise-head">
                <VocabSelect
                  items={EXERCISES.some((e) => e.id === ex.exerciseId) ? EXERCISES : [...EXERCISES, { id: ex.exerciseId, label: exerciseLabel(ex.exerciseId), group: 'Da Hevy' }]}
                  value={ex.exerciseId}
                  onChange={(exerciseId) => setEx(i, { ...ex, exerciseId })}
                />
                <button type="button" className="icon-btn" aria-label="Rimuovi esercizio" onClick={() => set({ exercises: m.exercises.filter((_, j) => j !== i) })}>
                  <GlyphTrash />
                </button>
              </div>
              <div className="sets">
                {ex.sets.map((s, k) => (
                  <span key={k} className={`set${s.warmup ? ' warmup' : ''}`} title={s.warmup ? 'Riscaldamento' : undefined}>
                    <NumberInput value={s.reps} placeholder="rip" onChange={(reps) => setEx(i, { ...ex, sets: ex.sets.map((x, z) => (z === k ? { ...x, reps: reps ?? 0 } : x)) })} />
                    <span className="set-x">×</span>
                    <NumberInput value={s.kg} step={0.5} placeholder="kg" onChange={(kg) => setEx(i, { ...ex, sets: ex.sets.map((x, z) => (z === k ? { ...x, kg } : x)) })} />
                    <button type="button" className="icon-btn small" aria-label="Rimuovi serie" onClick={() => setEx(i, { ...ex, sets: ex.sets.filter((_, z) => z !== k) })}>
                      <GlyphClose />
                    </button>
                  </span>
                ))}
                <button type="button" className="btn-ghost small" onClick={() => setEx(i, { ...ex, sets: [...ex.sets, { ...(ex.sets.at(-1) ?? { reps: 10 }) }] })}>
                  <GlyphPlus /> serie
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={() => set({ exercises: [...m.exercises, { exerciseId: 'squat', sets: [{ reps: 10 }] }] })}>
            <GlyphPlus /> Esercizio
          </button>
        </div>
      )}
      <Field label="Note" wide>
        <textarea rows={2} value={m.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </div>
  );
}

function OutingEditor({ value: m, onChange }: Props<OutingModule>) {
  const set = (p: Partial<OutingModule>) => onChange({ ...m, ...p });
  return (
    <div className="grid">
      <Field label="Titolo" wide>
        <input value={m.title} onChange={(e) => set({ title: e.target.value })} placeholder="es. Sacra di San Michele" />
      </Field>
      <Field label="Tipo">
        <VocabSelect items={OUTING_TYPES} value={m.type} onChange={(type) => set({ type })} />
      </Field>
      <Field label="Luogo">
        <input value={m.place ?? ''} onChange={(e) => set({ place: e.target.value })} />
      </Field>
      <Field label="Con chi" wide>
        <input value={m.people ?? ''} onChange={(e) => set({ people: e.target.value })} />
      </Field>
      <Field label="Racconto" wide>
        <textarea rows={3} value={m.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </div>
  );
}

/** Resizes and re-encodes to JPEG, shrinking until it fits comfortably in a Firestore document. */
async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  let max = 1400;
  let quality = 0.8;
  for (;;) {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('Compressione fallita'))), 'image/jpeg', quality),
    );
    if (blob.size < 350_000 || max <= 640) return blob;
    max = Math.round(max * 0.8);
    quality = Math.max(0.6, quality - 0.05);
  }
}

function StoredImage({ src, alt }: { src: string; alt: string }) {
  const { repo } = useStore();
  const [url, setUrl] = useState(src.startsWith('fs:') ? '' : src);
  useEffect(() => {
    let alive = true;
    repo.resolvePhoto(src).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [repo, src]);
  return url ? <img src={url} alt={alt} loading="lazy" /> : <div className="photo-loading" aria-label="Caricamento foto" />;
}

function PhotoEditor({ value: m, onChange }: Props<PhotoModule>) {
  const { repo } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(m);
  latest.current = m;

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const added = [];
      for (const f of Array.from(files)) {
        const id = uid();
        const { src, path } = await repo.uploadPhoto(id, await compress(f));
        added.push({ id, src, path });
      }
      onChange({ ...latest.current, items: [...latest.current.items, ...added] });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <div className="photos">
        {m.items.map((p) => (
          <figure key={p.id} className="photo">
            <StoredImage src={p.src} alt={p.caption ?? ''} />
            <figcaption>
              <input
                value={p.caption ?? ''}
                placeholder="Didascalia"
                onChange={(e) => onChange({ ...m, items: m.items.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)) })}
              />
              <button
                type="button"
                className="icon-btn small"
                aria-label="Rimuovi foto"
                onClick={() => {
                  repo.deletePhoto(p.path);
                  onChange({ ...m, items: m.items.filter((x) => x.id !== p.id) });
                }}
              >
                <GlyphTrash />
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      <button type="button" className="btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
        <GlyphPlus /> {busy ? 'Caricamento…' : 'Aggiungi immagini'}
      </button>
    </div>
  );
}

function NoteEditor({ value: m, onChange }: Props<NoteModule>) {
  return (
    <div className="grid">
      <Field label="Titolo" wide>
        <input value={m.title ?? ''} onChange={(e) => onChange({ ...m, title: e.target.value })} />
      </Field>
      <Field label="Testo" wide>
        <textarea className="note-text" rows={5} value={m.text} onChange={(e) => onChange({ ...m, text: e.target.value })} />
      </Field>
    </div>
  );
}

export function ModuleEditor({ value, onChange }: Props<Module>) {
  switch (value.kind) {
    case 'surgery':
      return <SurgeryEditor value={value} onChange={onChange} />;
    case 'clinical':
      return <ClinicalEditor value={value} onChange={onChange} />;
    case 'study':
      return <StudyEditor value={value} onChange={onChange} />;
    case 'workout':
      return <WorkoutEditor value={value} onChange={onChange} />;
    case 'outing':
      return <OutingEditor value={value} onChange={onChange} />;
    case 'photos':
      return <PhotoEditor value={value} onChange={onChange} />;
    case 'note':
      return <NoteEditor value={value} onChange={onChange} />;
  }
}
