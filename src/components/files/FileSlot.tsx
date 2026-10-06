import { useEffect, useRef, useState } from 'react';
import { GlyphClip, GlyphTrash } from '../icons';
import { uid } from '../ui';
import { useStore } from '../../lib/store/StoreContext';
import type { FileRef } from '../../lib/types';
import { compress } from '../../lib/image';

const MAX_BYTES = 8 * 1024 * 1024;

/** Opens a stored document in the browser's viewer. */
export async function openFile(repo: ReturnType<typeof useStore>['repo'], f: FileRef) {
  const data = await repo.resolveFile(f.src);
  if (!data) return window.alert('File non trovato: potrebbe essere stato caricato da un altro dispositivo.');
  const blob = await (await fetch(data)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** One PDF attachment: paperclip button to add it, then name, open, replace and remove. */
export function FileSlot({ label, doneLabel, crown, file, onChange }: { label: string; doneLabel?: string; crown?: boolean; file?: FileRef; onChange: (f: FileRef | undefined) => void }) {
  const { repo } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
      window.alert('Scegli un file PDF.');
      if (input.current) input.current.value = '';
      return;
    }
    if (f.size > MAX_BYTES) {
      window.alert('Il file supera 8 MB: riducilo o comprimilo prima di caricarlo.');
      if (input.current) input.current.value = '';
      return;
    }
    setBusy(true);
    try {
      const id = uid();
      const { src, path } = await repo.uploadFile(id, f);
      if (file) repo.deleteFile(file.path);
      onChange({ id, name: f.name, src, path, size: f.size });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className={`file-slot${file ? ' has-file' : ''}`}>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pick(e.target.files)} />
      {file ? (
        <>
          <button type="button" className="file-open" onClick={() => openFile(repo, file)}>
            <GlyphClip crown={crown} />
            <span className="file-text">
              <strong>{doneLabel ?? label}</strong>
              <span className="muted small">{file.name}</span>
            </span>
          </button>
          <button type="button" className="icon-btn small" aria-label={`Sostituisci: ${doneLabel ?? label}`} disabled={busy} onClick={() => input.current?.click()}>
            ↻
          </button>
          <button
            type="button"
            className="icon-btn small"
            aria-label={`Rimuovi: ${doneLabel ?? label}`}
            onClick={() => {
              if (!window.confirm(`Rimuovere “${doneLabel ?? label}”?`)) return;
              repo.deleteFile(file.path);
              onChange(undefined);
            }}
          >
            <GlyphTrash />
          </button>
        </>
      ) : (
        <button type="button" className="file-add" disabled={busy} onClick={() => input.current?.click()}>
          <GlyphClip crown={crown} />
          <span>{busy ? 'Caricamento…' : label}</span>
        </button>
      )}
    </div>
  );
}

/** Every program file of a course: the older single PDF and the newer list (PDF or photos). */
export const programOf = (m: { program?: FileRef; programFiles?: FileRef[] }): FileRef[] => [...(m.program ? [m.program] : []), ...(m.programFiles ?? [])];

const isImage = (f: FileRef) => /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);

function Thumb({ f }: { f: FileRef }) {
  const { repo } = useStore();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let alive = true;
    repo.resolveFile(f.src).then((u) => alive && setUrl(u)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [repo, f.src]);
  return url ? <img className="file-thumb" src={url} alt="" /> : <span className="file-thumb" aria-hidden="true" />;
}

/** The course program: one or more PDFs or photos (e.g. a picture of the printed programme). */
export function ProgramFiles({ files, onChange }: { files: FileRef[]; onChange: (f: FileRef[]) => void }) {
  const { repo } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(list: FileList | null) {
    const picked = [...(list ?? [])];
    if (!picked.length) return;
    setBusy(true);
    const added: FileRef[] = [];
    try {
      for (const f of picked) {
        const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
        const img = f.type.startsWith('image/');
        if (!pdf && !img) {
          window.alert(`“${f.name}” non è un PDF né un’immagine.`);
          continue;
        }
        if (pdf && f.size > MAX_BYTES) {
          window.alert(`“${f.name}” supera 8 MB: riducilo prima di caricarlo.`);
          continue;
        }
        const blob = img ? await compress(f) : f;
        const name = img ? f.name.replace(/\.[^.]+$/, '') + '.jpg' : f.name;
        const id = uid();
        const { src, path } = await repo.uploadFile(id, blob);
        added.push({ id, name, src, path, size: blob.size });
      }
      if (added.length) onChange([...files, ...added]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="program-files">
      <input ref={input} type="file" accept="application/pdf,.pdf,image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
      {files.map((f, i) => (
        <div key={f.id} className="file-slot has-file">
          <button type="button" className="file-open" onClick={() => openFile(repo, f)}>
            {isImage(f) ? <Thumb f={f} /> : <span className="pdf-badge" aria-hidden="true">PDF</span>}
            <span className="file-text">
              <strong>{files.length > 1 ? `Programma ${i + 1}` : 'Programma'}</strong>
              <span className="muted small">{isImage(f) ? 'Immagine' : f.name}</span>
            </span>
          </button>
          <button
            type="button"
            className="icon-btn small"
            aria-label="Rimuovi dal programma"
            onClick={() => {
              if (!window.confirm('Rimuovere questo file del programma?')) return;
              repo.deleteFile(f.path);
              onChange(files.filter((x) => x.id !== f.id));
            }}
          >
            <GlyphTrash />
          </button>
        </div>
      ))}
      <button type="button" className="file-add" disabled={busy} onClick={() => input.current?.click()}>
        <GlyphClip />
        <span>{busy ? 'Caricamento…' : files.length ? 'Aggiungi altre pagine o foto' : 'Aggiungi il programma (PDF o foto)'}</span>
      </button>
    </div>
  );
}
