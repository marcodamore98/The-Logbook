import { confirmDelete } from '../Confirm';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store/StoreContext';
import { allFoldersOf, areaFor, bodyOf, folderOfNote, folderPath, hasContent, plainOf, setNoteReturn } from '../../lib/notes';
import { FolderPicker, toneColor } from '../notes/NoteParts';
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
  STUDY_TYPES,
} from '../../lib/vocab';
import { GlyphPlus, GlyphTrash, Sym } from '../icons';
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

function StudyEditor({ value: m, onChange, date }: Props<StudyModule> & { date: ISODate }) {
  const set = (p: Partial<StudyModule>) => onChange({ ...m, ...p });
  const store = useStore();
  const nav = useNavigate();
  const all = allFoldersOf(store.settings);
  const folderId = folderOfNote(all, m);
  const path = folderPath(all, folderId);
  const [picking, setPicking] = useState(false);
  const open = () => {
    setNoteReturn(`/giorno/${date}`);
    nav(`/appunti/${date}/${m.id}`);
  };
  const text = plainOf(bodyOf(m));
  const files = m.attachments ?? [];
  const count = (k: string) => files.filter((f) => f.kind === k).length;
  return (
    <div className="grid">
      <Field label="Titolo / argomento" wide>
        <input value={m.title} onChange={(e) => set({ title: e.target.value })} placeholder="es. Linee guida SIGO emorragia post partum" />
      </Field>
      <Field label="Tipo">
        <VocabSelect items={STUDY_TYPES.filter((t) => !['course', 'congress', 'webinar'].includes(t.id))} value={m.type} onChange={(type) => set({ type })} />
      </Field>
      <Field label="Cartella">
        <button type="button" className="folder-field" onClick={() => setPicking(true)}>
          <span className="nm-dot" style={{ background: toneColor(path.at(-1)?.tone) }} aria-hidden="true" />
          <span className="ff-path">{path.length ? path.map((f) => f.name).join(' › ') : 'Nessuna cartella'}</span>
          <Sym name="chevron_right" size={18} />
        </button>
      </Field>
      <Field label="Durata">
        <DurationField unit="min" label="Durata dello studio" value={m.durationMin} onChange={(n) => set({ durationMin: n })} />
      </Field>
      <Field label="Appunti" wide>
        <button type="button" className="note-peek" onClick={open}>
          <span className={`np-text${text ? '' : ' muted'}`}>{text ? text.slice(0, 220) : 'Scrivi gli appunti di questa sessione: testo formattato, foto, scansioni, PDF e registrazioni vocali.'}</span>
          {(files.length > 0 || (m.tags?.length ?? 0) > 0) && (
            <span className="np-meta">
              {count('image') > 0 && <span><Sym name="image" size={15} /> {count('image')}</span>}
              {count('pdf') > 0 && <span><Sym name="picture_as_pdf" size={15} /> {count('pdf')}</span>}
              {count('audio') > 0 && <span><Sym name="mic" size={15} /> {count('audio')}</span>}
              {(m.tags ?? []).slice(0, 4).map((t) => (
                <span key={t} className="np-tag">#{t}</span>
              ))}
            </span>
          )}
          <span className="np-go">
            <Sym name="edit_note" size={18} /> {text || files.length ? 'Apri gli appunti' : 'Scrivi gli appunti'} ›
          </span>
        </button>
      </Field>
      {picking && <FolderPicker selected={folderId} onPick={(id) => set({ folderId: id ?? '', area: areaFor(all, id) })} onClose={() => setPicking(false)} />}
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
          <Sym name="location_on" size={18} />
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
                onClick={async () => {
                  if (!(await confirmDelete('questa foto'))) return;
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
  const store = useStore();
  const synced = store.gcal.connected && store.settings.gcal.enabled;
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
              <Sym name="link" size={18} />
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
              <Sym name="location_on" size={18} />
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
      <label className="field field-wide ecm-row">
        <Sym name="star" size={22} />
        <span>Crediti formativi</span>
        <span className="ecm-pill">
          <NumberInput value={m.ecm} step={0.5} placeholder="–" onChange={(ecm) => onChange({ ...m, ecm })} />
          <small>ECM</small>
        </span>
      </label>
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
          <span className="bell-disc">
            <Sym name="notifications" size={20} className="bell" />
          </span>
          <span className="remind-text">
            <strong>Promemoria evento</strong>
            <small>{m.startTime ? 'Avvisami 30 e 5 minuti prima' : 'Avvisami 30 e 5 minuti prima (serve l’ora di inizio)'}</small>
          </span>
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
        <div className="cert-slot">
          <FileSlot label="Aggiungi l’attestato di partecipazione (PDF)" doneLabel="Attestato" crown file={m.certificate} onChange={(certificate) => onChange({ ...m, certificate })} />
        </div>
      </div>
      {synced && (
        <p className="field field-wide gcal-note">
          <Sym name="sync" size={16} />
          Sincronizzato automaticamente con Google Calendar
        </p>
      )}
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
            onClick={async () => {
              if (value.kind === k) return;
              // Changing what the card is throws away what was written in it: ask first.
              const strip = (x: object) => JSON.stringify({ ...x, id: undefined, createdAt: undefined });
              const filled = strip(value) !== strip(metaOf(value.kind).create(date));
              const from = group.labels[group.kinds.indexOf(value.kind)];
              if (filled && !(await confirmDelete(`la scheda ${from}`, { detail: value.kind === 'study' && hasContent(value) ? `Diventa una scheda ${group.labels[i]} vuota; gli appunti vanno nel Cestino dell’Archivio.` : `Diventa una scheda ${group.labels[i]} vuota e quello che c’era scritto si perde.` }))) return;
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
      return <StudyEditor value={value} onChange={onChange} date={date} />;
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
