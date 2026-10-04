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
import { metaOf } from './meta';
import { ChipChoice, Field, NumberInput, TimeTile, uid, VocabSelect } from '../ui';
import type { VocabItem } from '../../lib/vocab';

type Props<M> = { value: M; onChange: (m: M) => void };

function SurgeryEditor({ value: m, onChange }: Props<SurgeryModule>) {
  const { settings } = useStore();
  const set = (p: Partial<SurgeryModule>) => onChange({ ...m, ...p });
  return (
    <div className="grid">
      <Field label="Intervento / procedura" wide>
        <SearchPick items={PROCEDURES} value={m.procedureId} onChange={(procedureId) => set({ procedureId })} placeholder="Cerca intervento…" />
      </Field>
      <Field label="Ruolo in sala" wide>
        <ChipChoice label="Ruolo in sala" items={SURGICAL_ROLES} value={m.role} onChange={(role) => set({ role })} />
      </Field>
      <Field label="Via d’accesso" wide>
        <ChipChoice label="Via d’accesso" items={APPROACHES} value={m.approach} onChange={(approach) => set({ approach })} />
      </Field>
      <Field label="Regime">
        <VocabSelect items={SETTINGS_URGENCY} value={m.setting} onChange={(setting) => set({ setting })} />
      </Field>
      <Field label="Durata (min)">
        <NumberInput value={m.durationMin} onChange={(durationMin) => set({ durationMin })} step={5} />
      </Field>
      <div className="field field-wide compl-box">
        <label className="switch-row">
          <span>Complicanze</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={!!m.clavien && m.clavien !== 'none'}
            onChange={(e) => set({ clavien: e.target.checked ? 'I' : 'none' })}
          />
        </label>
        {m.clavien && m.clavien !== 'none' && (
          <Field label="Grado Clavien-Dindo">
            <VocabSelect items={CLAVIEN.filter((c) => c.id !== 'none')} value={m.clavien} onChange={(clavien) => set({ clavien })} />
          </Field>
        )}
      </div>
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
        <VocabSelect items={STUDY_TYPES.filter((t) => !['course', 'congress', 'webinar'].includes(t.id))} value={m.type} onChange={(type) => set({ type })} />
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
  return (
    <div className="grid">
      <div className="field field-wide">
        <div className="chips" role="radiogroup" aria-label="Tipo">
          {COURSE_TYPES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={(m.type ?? 'course') === t.id} className={`chip${(m.type ?? 'course') === t.id ? ' chip-on' : ''}`} onClick={() => onChange({ ...m, type: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Titolo" wide>
        <input value={m.title} placeholder="es. Congresso nazionale SIGO" onChange={(e) => onChange({ ...m, title: e.target.value })} />
      </Field>
      <div className="field field-wide tile-grid">
        <TimeTile type="date" label="Dal" value={m.startDate} onChange={(v) => v && onChange({ ...m, startDate: v, endDate: m.endDate < v ? v : m.endDate })} />
        <TimeTile type="date" label="Al" value={m.endDate} min={m.startDate} onChange={(v) => v && onChange({ ...m, endDate: v < m.startDate ? m.startDate : v })} />
        <TimeTile label="Ora di inizio" value={m.startTime ?? ''} onChange={(v) => onChange({ ...m, startTime: v || undefined })} />
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
        <span className="field-label">Documenti allegati (PDF)</span>
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

/** Pairs of cards that share one entry in "Aggiungi scheda": a switch at the top changes what the card is. */
const KIND_GROUPS: { kinds: Module['kind'][]; labels: string[] }[] = [
  { kinds: ['surgery', 'clinical'], labels: ['Chirurgica', 'Clinica'] },
  { kinds: ['study', 'course'], labels: ['Studio', 'Corsi e congressi'] },
  { kinds: ['travel', 'outing'], labels: ['Viaggio', 'Gita / uscita'] },
];

export function ModuleEditor({ value, onChange, date }: Props<Module> & { date: ISODate }) {
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
            onClick={() => value.kind !== k && onChange({ ...metaOf(k).create(date), id: value.id } as Module)}
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

/** Pick one item by typing part of its name (long lists like the procedures). */
function SearchPick({ items, value, onChange, placeholder }: { items: VocabItem[]; value: string | undefined; onChange: (id: string) => void; placeholder?: string }) {
  const label = items.find((i) => i.id === value)?.label ?? '';
  const [text, setText] = useState(label);
  const [open, setOpen] = useState(false);
  const latest = useRef(label);
  latest.current = label;
  useEffect(() => setText(label), [label]);
  const q = text.trim().toLowerCase();
  const hits = open ? items.filter((i) => !q || q === label.toLowerCase() || i.label.toLowerCase().includes(q)).slice(0, 8) : [];
  return (
    <div className="search-pick">
      <span className="icon-input">
        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <input
          value={text}
          placeholder={placeholder}
          onFocus={(e) => {
            setOpen(true);
            e.target.select();
          }}
          onBlur={() => window.setTimeout(() => {
            setOpen(false);
            setText(latest.current);
          }, 150)}
          onChange={(e) => setText(e.target.value)}
        />
      </span>
      {hits.length > 0 && (
        <ul className="search-hits" role="listbox">
          {hits.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                role="option"
                aria-selected={i.id === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(i.id);
                  latest.current = i.label;
                  setText(i.label);
                  setOpen(false);
                  (document.activeElement as HTMLElement | null)?.blur();
                }}
              >
                {i.label}
                {i.group && <small>{i.group}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
