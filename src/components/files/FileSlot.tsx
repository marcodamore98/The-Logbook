import { useRef, useState } from 'react';
import { GlyphClip, GlyphTrash } from '../icons';
import { uid } from '../ui';
import { useStore } from '../../lib/store/StoreContext';
import type { FileRef } from '../../lib/types';

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
