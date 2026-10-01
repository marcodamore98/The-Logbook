import { useRef, useState } from 'react';
import { GlyphClose, GlyphEdit, GlyphPlus, GlyphTrash } from '../icons';
import { compress, StoredImage } from '../modules/editors';
import { uid } from '../ui';
import { diaryOf } from '../../lib/diary';
import { useStore } from '../../lib/store/StoreContext';
import type { DayEntry, DiaryEntry as Diary, PhotoItem } from '../../lib/types';

/**
 * The diary of one day: free text and photos, nothing else. It is read-only until
 * "Modifica" is pressed, so it can't be changed or wiped by a stray tap.
 */
export function DiaryEntryView({ day, onSave, placeholder = 'Come è andata oggi?' }: { day: DayEntry; onSave: (d: Diary) => void; placeholder?: string }) {
  const { repo } = useStore();
  const saved = diaryOf(day);
  const [draft, setDraft] = useState<Diary | null>(null);
  const [busy, setBusy] = useState(false);
  const added = useRef<PhotoItem[]>([]);
  const removed = useRef<PhotoItem[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const editing = draft !== null;
  const empty = !saved.text.trim() && saved.photos.length === 0;

  const start = () => {
    added.current = [];
    removed.current = [];
    setDraft({ text: saved.text, photos: [...saved.photos] });
  };

  const save = () => {
    if (!draft) return;
    removed.current.forEach((p) => repo.deletePhoto(p.path));
    onSave({ text: draft.text.trimEnd(), photos: draft.photos });
    setDraft(null);
  };

  const cancel = () => {
    const dirty = draft!.text !== saved.text || added.current.length > 0 || removed.current.length > 0;
    if (dirty && !window.confirm('Annullare le modifiche al diario?')) return;
    added.current.forEach((p) => repo.deletePhoto(p.path));
    setDraft(null);
  };

  async function addPhotos(files: FileList | null) {
    if (!files?.length || !draft) return;
    setBusy(true);
    try {
      const items: PhotoItem[] = [];
      for (const f of Array.from(files)) {
        const id = uid();
        const { src, path } = await repo.uploadPhoto(id, await compress(f));
        items.push({ id, src, path });
      }
      added.current.push(...items);
      setDraft((d) => (d ? { ...d, photos: [...d.photos, ...items] } : d));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const removePhoto = (p: PhotoItem) => {
    if (!window.confirm('Togliere questa foto dal diario?')) return;
    if (added.current.some((a) => a.id === p.id)) {
      repo.deletePhoto(p.path);
      added.current = added.current.filter((a) => a.id !== p.id);
    } else removed.current.push(p);
    setDraft((d) => (d ? { ...d, photos: d.photos.filter((x) => x.id !== p.id) } : d));
  };

  const photos = editing ? draft.photos : saved.photos;

  return (
    <div className={`diary-entry${editing ? ' editing' : ''}`}>
      {editing ? (
        <textarea
          className="diary-text"
          rows={9}
          autoFocus
          value={draft.text}
          placeholder={placeholder}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        />
      ) : saved.text.trim() ? (
        <p className="diary-read">{saved.text}</p>
      ) : (
        <p className="diary-empty">{empty ? 'Nessuna pagina scritta per questo giorno.' : 'Nessun testo, solo foto.'}</p>
      )}

      {photos.length > 0 && (
        <div className="photos">
          {photos.map((p) => (
            <figure key={p.id} className="photo">
              <StoredImage src={p.src} alt={p.caption ?? ''} />
              {editing ? (
                <figcaption>
                  <input
                    value={p.caption ?? ''}
                    placeholder="Didascalia"
                    onChange={(e) => setDraft({ ...draft, photos: draft.photos.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)) })}
                  />
                  <button type="button" className="icon-btn small" aria-label="Rimuovi foto" onClick={() => removePhoto(p)}>
                    <GlyphTrash />
                  </button>
                </figcaption>
              ) : (
                p.caption && <figcaption className="photo-caption">{p.caption}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {editing ? (
        <>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
          <div className="diary-actions">
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
              <GlyphPlus /> {busy ? 'Caricamento…' : 'Aggiungi foto'}
            </button>
            <span className="grow" />
            <button type="button" className="btn-ghost" onClick={cancel}>
              <GlyphClose /> Annulla
            </button>
            <button type="button" className="btn" disabled={busy} onClick={save}>
              Salva
            </button>
          </div>
        </>
      ) : (
        <div className="diary-actions no-print">
          <button type="button" className="btn-ghost" onClick={start}>
            <GlyphEdit /> {empty ? 'Scrivi' : 'Modifica'}
          </button>
        </div>
      )}
    </div>
  );
}
