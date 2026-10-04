import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store/StoreContext';
import { WorkoutLogger } from '../training/WorkoutLogger';
import type {
  Module,
  CourseModule,
  NoteModule,
  TravelModule,
  OutingModule,
  PhotoModule,
  StudyModule,
  ISODate,
} from '../../lib/types';
import {
  CATEGORIES,
  OUTING_TYPES,
  STUDY_AREAS,
  STUDY_TYPES,
} from '../../lib/vocab';
import { GlyphPlus, GlyphTrash } from '../icons';
import { FileSlot, ProgramFiles, programOf } from '../files/FileSlot';
import { compress } from '../../lib/image';
import { mapsUrl, webUrl } from '../../lib/links';

export { compress };
import { metaOf } from './meta';
import { ClinicalEditor, SurgeryEditor } from './WorkLogEditors';
import { useUndo } from '../Undo';
import { Field, NumberInput, TimeTile, uid, VocabSelect } from '../ui';
import { DurationField } from '../WheelPicker';

type Props<M> = { value: M; onChange: (m: M) => void };

function StudyEditor({ value: m, onChange }: Props<StudyModule>) {
  const set = (p: Partial<StudyModule>) => onChange({ ...m, ...p });
  return (
    <div className="grid">
      <Field label="Titolo / argomento" wide>
        <input value={m.title} onChange={(e) => set({ title: e.target.value })} placeholder="es. Linee guida SIGO emorragia post partum" />
      </Field>
      <Field label="Tipo">
        <VocabSelect items={STUDY_TYPES.filter((t) => !['course', 'congress', 'webinar'].includes(t.id))} value={m.type} onChange={(type) => set({ type })} />
      </Field>
      <Field label="Area">
        <VocabSelect items={STUDY_AREAS} value={m.area} onChange={(area) => set({ area })} />
      </Field>
      <Field label="Durata">
        <DurationField unit="min" label="Durata dello studio" value={m.durationMin} onChange={(n) => set({ durationMin: n })} />
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
        <span className="icon-input">
          <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" />
            <circle cx="12" cy="10" r="2.3" />
          </svg>
          <input value={m.place ?? ''} onChange={(e) => set({ place: e.target.value })} />
        </span>
      </Field>
      <Field label="Con chi" wide>
        <PeoplePills value={m.people ?? ''} onChange={(people) => set({ people })} />
      </Field>
      <Field label="Racconto" wide>
        <textarea rows={3} value={m.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </div>
  );
}

/** Resizes and re-encodes to JPEG, shrinking until it fits comfortably in a Firestore document. */
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

export const COURSE_TYPES: { id: NonNullable<CourseModule['type']>; label: string }[] = [
  { id: 'course', label: 'Corso' },
  { id: 'congress', label: 'Congresso' },
  { id: 'webinar', label: 'Webinar' },
];

async function askNotifications() {
  try {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  } catch {
    /* not supported */
  }
}

function CourseEditor({ value: m, onChange }: Props<CourseModule>) {
  const webinar = m.type === 'webinar';
  const link = m.link?.trim();
  return (
    <div className="grid">
      <div className="field field-wide">
        <div className="chips" role="radiogroup" aria-label="Tipo">
          {COURSE_TYPES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={(m.type ?? 'course') === t.id} className={`chip${(m.type ?? 'course') === t.id ? ' chip-on' : ''}`} onClick={() => onChange({ ...m, type: t.id, ...(t.id === 'webinar' ? { endDate: m.startDate } : {}) })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Titolo" wide>
        <input value={m.title} placeholder="es. Congresso nazionale SIGO" onChange={(e) => onChange({ ...m, title: e.target.value })} />
      </Field>
      {webinar ? (
        <div className="field field-wide">
          <span className="field-label">Link per accedere</span>
          <div className="link-row">
            <span className="icon-input">
              <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
              </svg>
              <input type="url" inputMode="url" autoComplete="off" value={m.link ?? ''} placeholder="https://… (Zoom, Teams, Meet)" onChange={(e) => onChange({ ...m, link: e.target.value || undefined })} />
            </span>
            {link && (
              <a className="btn link-open" href={webUrl(link)} target="_blank" rel="noopener noreferrer">
                Collegati
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="field field-wide">
          <span className="field-label">Luogo</span>
          <div className="link-row">
            <span className="icon-input">
              <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" />
                <circle cx="12" cy="10" r="2.3" />
              </svg>
              <input value={m.place ?? ''} placeholder="es. Centro congressi, Roma" onChange={(e) => onChange({ ...m, place: e.target.value || undefined })} />
            </span>
            {m.place?.trim() && (
              <a className="btn-ghost link-open" href={mapsUrl(m.place)} target="_blank" rel="noopener noreferrer">
                Maps
              </a>
            )}
          </div>
        </div>
      )}
      <Field label="Crediti ECM">
        <NumberInput value={m.ecm} step={0.5} onChange={(ecm) => onChange({ ...m, ecm })} />
      </Field>
      <div className={`field field-wide tile-grid${webinar ? ' pair' : ''}`}>
        {webinar ? (
          <TimeTile type="date" label="Giorno" value={m.startDate} onChange={(v) => v && onChange({ ...m, startDate: v, endDate: v })} />
        ) : (
          <>
            <TimeTile type="date" label="Dal" value={m.startDate} onChange={(v) => v && onChange({ ...m, startDate: v, endDate: m.endDate < v ? v : m.endDate })} />
            <TimeTile type="date" label="Al" value={m.endDate} min={m.startDate} onChange={(v) => v && onChange({ ...m, endDate: v < m.startDate ? m.startDate : v })} />
          </>
        )}
        <TimeTile clearable label="Ora di inizio" value={m.startTime ?? ''} onChange={(v) => onChange({ ...m, startTime: v || undefined, endTime: undefined })} />
      </div>
      <div className="field field-wide">
        <label className={`switch-row remind-box${m.startTime ? '' : ' disabled'}`}>
          <svg className="bell" viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
          </svg>
          <span>{m.startTime ? 'Avvisami 30 e 5 minuti prima' : 'Avvisami 30 e 5 minuti prima (serve l’ora di inizio)'}</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            disabled={!m.startTime}
            checked={!!m.remind && !!m.startTime}
            onChange={(e) => {
              if (e.target.checked) askNotifications();
              onChange({ ...m, remind: e.target.checked });
            }}
          />
        </label>
      </div>
      <div className="field field-wide file-slots">
        <span className="field-label">Programma</span>
        <ProgramFiles files={programOf(m)} onChange={(programFiles) => onChange({ ...m, program: undefined, programFiles })} />
        <span className="field-label">Attestato (PDF)</span>
        <FileSlot label="Aggiungi l’attestato (PDF)" doneLabel="Attestato" crown file={m.certificate} onChange={(certificate) => onChange({ ...m, certificate })} />
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

/** Pairs of cards that share one entry in "Aggiungi scheda": a switch at the top changes what the card is. */
const KIND_GROUPS: { kinds: Module['kind'][]; labels: string[] }[] = [
  { kinds: ['surgery', 'clinical'], labels: ['Chirurgica', 'Clinica'] },
  { kinds: ['study', 'course'], labels: ['Studio', 'Corsi e congressi'] },
  { kinds: ['travel', 'outing'], labels: ['Viaggio', 'Gita / uscita'] },
];

export function ModuleEditor({ value, onChange, date }: Props<Module> & { date: ISODate }) {
  const offerUndo = useUndo();
  const group = KIND_GROUPS.find((g) => g.kinds.includes(value.kind));
  const editor = <KindEditor value={value} onChange={onChange} date={date} />;
  if (!group) return editor;
  return (
    <>
      <div className="segmented kind-switch" role="tablist">
        {group.kinds.map((k, i) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={value.kind === k}
            className={value.kind === k ? 'on' : ''}
            onClick={() => {
              if (value.kind === k) return;
              onChange({ ...metaOf(k).create(date), id: value.id } as Module);
              offerUndo(`Scheda cambiata in ${group.labels[i]}`, () => onChange(value));
            }}
          >
            {group.labels[i]}
          </button>
        ))}
      </div>
      {editor}
    </>
  );
}

function KindEditor({ value, onChange, date }: Props<Module> & { date: ISODate }) {
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

/** Names as pills with ×; type a name and press Invio (or leave the field) to add it. */
function PeoplePills({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const names = value.split(',').map((x) => x.trim()).filter(Boolean);
  const [draft, setDraft] = useState('');
  const add = () => {
    const n = draft.trim();
    if (n) onChange([...names, n].join(', '));
    setDraft('');
  };
  return (
    <div className="people-pills">
      {names.map((n, k) => (
        <button key={`${n}-${k}`} type="button" className="person-pill" aria-label={`Rimuovi ${n}`} onClick={() => onChange(names.filter((_, j) => j !== k).join(', '))}>
          {n} <span aria-hidden="true">×</span>
        </button>
      ))}
      <input
        className="people-add"
        value={draft}
        placeholder="+ Aggiungi"
        enterKeyHint="done"
        onChange={(e) => setDraft(e.target.value.replace(',', ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}
