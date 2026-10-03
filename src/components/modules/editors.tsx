import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store/StoreContext';
import { WorkoutLogger } from '../training/WorkoutLogger';
import type {
  ClinicalModule,
  Module,
  CourseModule,
  NoteModule,
  TravelModule,
  OutingModule,
  PhotoModule,
  StudyModule,
  SurgeryModule,
  ISODate,
} from '../../lib/types';
import {
  APPROACHES,
  CATEGORIES,
  CLAVIEN,
  CLINICAL_ACTIVITIES,
  OUTING_TYPES,
  PROCEDURES,
  SETTINGS_URGENCY,
  STUDY_AREAS,
  STUDY_TYPES,
  SURGICAL_ROLES,
} from '../../lib/vocab';
import { GlyphPlus, GlyphTrash } from '../icons';
import { FileSlot } from '../files/FileSlot';
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
export async function compress(file: File): Promise<Blob> {
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

export function StoredImage({ src, alt }: { src: string; alt: string }) {
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
      <Field label="Titolo">
        <input value={m.title ?? ''} onChange={(e) => onChange({ ...m, title: e.target.value })} />
      </Field>
      <Field label="Categoria">
        <VocabSelect items={CATEGORIES} value={m.category} placeholder="—" onChange={(c) => onChange({ ...m, category: c || undefined })} />
      </Field>
      <Field label="Testo" wide>
        <textarea className="note-text" rows={5} value={m.text} onChange={(e) => onChange({ ...m, text: e.target.value })} />
      </Field>
    </div>
  );
}

function DateRange({ start, end, onChange }: { start: string; end: string; onChange: (s: string, e: string) => void }) {
  return (
    <div className="time-pair">
      <Field label="Dal">
        <input type="date" value={start} onChange={(e) => onChange(e.target.value, end < e.target.value ? e.target.value : end)} />
      </Field>
      <Field label="Al">
        <input type="date" value={end} min={start} onChange={(e) => onChange(start, e.target.value < start ? start : e.target.value)} />
      </Field>
    </div>
  );
}

function CourseEditor({ value: m, onChange }: Props<CourseModule>) {
  return (
    <div className="grid">
      <Field label="Titolo" wide>
        <input value={m.title} placeholder="es. Congresso nazionale SIGO" onChange={(e) => onChange({ ...m, title: e.target.value })} />
      </Field>
      <div className="field field-wide">
        <DateRange start={m.startDate} end={m.endDate} onChange={(startDate, endDate) => onChange({ ...m, startDate, endDate })} />
      </div>
      <div className="field field-wide file-slots">
        <FileSlot label="Aggiungi il programma (PDF)" doneLabel="Programma" file={m.program} onChange={(program) => onChange({ ...m, program })} />
        <FileSlot label="Aggiungi l’attestato" doneLabel="Attestato" crown file={m.certificate} onChange={(certificate) => onChange({ ...m, certificate })} />
      </div>
    </div>
  );
}

function TravelEditor({ value: m, onChange }: Props<TravelModule>) {
  return (
    <div className="grid">
      <Field label="Titolo" wide>
        <input value={m.title} placeholder="es. Weekend a Lisbona" onChange={(e) => onChange({ ...m, title: e.target.value })} />
      </Field>
      <Field label="Destinazione" wide>
        <input value={m.destination ?? ''} onChange={(e) => onChange({ ...m, destination: e.target.value || undefined })} />
      </Field>
      <div className="field field-wide">
        <DateRange start={m.startDate} end={m.endDate} onChange={(startDate, endDate) => onChange({ ...m, startDate, endDate })} />
      </div>
    </div>
  );
}

export function ModuleEditor({ value, onChange, date }: Props<Module> & { date: ISODate }) {
  switch (value.kind) {
    case 'surgery':
      return <SurgeryEditor value={value} onChange={onChange} />;
    case 'clinical':
      return <ClinicalEditor value={value} onChange={onChange} />;
    case 'study':
      return <StudyEditor value={value} onChange={onChange} />;
    case 'workout':
      return <WorkoutLogger value={value} onChange={onChange} date={date} />;
    case 'course':
      return <CourseEditor value={value} onChange={onChange} />;
    case 'travel':
      return <TravelEditor value={value} onChange={onChange} />;
    case 'run':
      return null; // le corse si registrano dalla pagina Corsa
    case 'outing':
      return <OutingEditor value={value} onChange={onChange} />;
    case 'photos':
      return <PhotoEditor value={value} onChange={onChange} />;
    case 'note':
      return <NoteEditor value={value} onChange={onChange} />;
  }
}
