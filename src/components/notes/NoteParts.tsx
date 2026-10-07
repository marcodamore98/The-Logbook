import { useState } from 'react';
import { allFoldersOf, foldersOf, NOTE_TONES, pathLabel } from '../../lib/notes';
import { useStore } from '../../lib/store/StoreContext';
import type { NoteFolder } from '../../lib/types';
import { Sym } from '../icons';
import { SearchPicker } from '../SearchPicker';
import { uid } from '../ui';

const TONE_HEX: Record<string, string> = {
  lime: '#d6f25f',
  lav: '#b9b0f5',
  sage: '#a6e9c4',
  sky: '#b3d8f7',
  terra: '#ffbd9c',
  plum: '#dcbdf5',
  sun: '#f6dc7a',
  rose: '#f7b6c8',
};
export const toneColor = (tone?: string) => TONE_HEX[tone ?? ''] ?? '#dcdad0';
export const TONE_NAMES: Record<string, string> = { lime: 'Lime', lav: 'Lavanda', sage: 'Salvia', sky: 'Cielo', terra: 'Terracotta', plum: 'Glicine', sun: 'Sole', rose: 'Rosa' };

/** Adds a folder to the settings and returns it. */
export function useAddFolder() {
  const store = useStore();
  return (name: string, parentId?: string, tone?: string): NoteFolder => {
    const all = allFoldersOf(store.settings);
    const used = all.filter((f) => !f.deleted).length;
    const f: NoteFolder = { id: uid(), name: name.trim() || 'Nuova cartella', parentId, tone: tone ?? NOTE_TONES[used % NOTE_TONES.length] };
    store.saveSettings({ ...store.settings, noteFolders: [...all, f] });
    return f;
  };
}

/** Full-page folder chooser with search, like the shift and colleague pickers. */
export function FolderPicker({ selected, onPick, onClose, exclude }: { selected?: string; onPick: (id: string | undefined) => void; onClose: () => void; exclude?: Set<string> }) {
  const store = useStore();
  const all = allFoldersOf(store.settings);
  const add = useAddFolder();
  const items = foldersOf(store.settings)
    .filter((f) => !exclude?.has(f.id))
    .map((f) => {
      const full = pathLabel(all, f.id);
      return { id: f.id, label: f.name, sub: full.includes(' › ') ? full.slice(0, full.lastIndexOf(' › ')) : undefined, color: toneColor(f.tone), sort: full };
    })
    .sort((a, b) => a.sort.localeCompare(b.sort, 'it'));
  return (
    <SearchPicker
      title="Cartella"
      placeholder="Cerca o crea una cartella"
      items={items}
      selected={selected ? [selected] : []}
      onPick={onPick}
      onClose={onClose}
      onCreate={(name) => {
        const f = add(name);
        onPick(f.id);
        onClose();
      }}
      extra={
        <button type="button" className={`pick-row${!selected ? ' on' : ''}`} onClick={() => (onPick(undefined), onClose())}>
          <span className="pick-avatar">
            <Sym name="home" size={18} />
          </span>
          <span className="pick-text">
            <span className="pick-label">Nessuna cartella</span>
            <span className="pick-sub">La nota resta in “Tutte le note”</span>
          </span>
        </button>
      }
    />
  );
}

const norm = (s: string) => s.trim().toLowerCase();

/** Topic tags of a note: pills with ✕, a "+" to write one, and suggested tags to add with a tap. */
export function TagEditor({ tags, known, suggestions, onChange, open }: { tags: string[]; known: string[]; suggestions: string[]; onChange: (t: string[]) => void; open?: boolean }) {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const has = (t: string) => tags.some((x) => norm(x) === norm(t));
  const add = (t: string) => {
    const clean = t.replace(/^#/, '').trim();
    if (clean && !has(clean)) onChange([...tags, known.find((k) => norm(k) === norm(clean)) ?? clean]);
  };
  const others = open ? known.filter((k) => !has(k) && !suggestions.some((s) => norm(s) === norm(k))).slice(0, 24) : [];
  return (
    <div className="tag-editor">
      <div className="tag-row">
        <Sym name="sell" size={18} className="tag-ico" />
        {tags.map((t) => (
          <button key={t} type="button" className="tag-pill on" aria-label={`Togli il tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            #{t} <Sym name="close" size={14} />
          </button>
        ))}
        {typing ? (
          <form
            className="tag-new"
            onSubmit={(e) => {
              e.preventDefault();
              add(text);
              setText('');
            }}
          >
            <input
              autoFocus
              value={text}
              list="note-tags-known"
              placeholder="Nuovo tag"
              enterKeyHint="done"
              onChange={(e) => setText(e.target.value)}
              onBlur={() => {
                add(text);
                setText('');
                setTyping(false);
              }}
            />
            <datalist id="note-tags-known">
              {known.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </form>
        ) : (
          <button type="button" className="tag-pill add" onClick={() => setTyping(true)}>
            <Sym name="add" size={16} /> Tag
          </button>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="tag-row tag-suggest">
          <span className="tag-label">Suggeriti</span>
          {suggestions.map((t) => (
            <button key={t} type="button" className="tag-pill sug" onClick={() => add(t)}>
              <Sym name="add" size={14} /> {t}
            </button>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="tag-row tag-suggest">
          <span className="tag-label">I tuoi tag</span>
          {others.map((t) => (
            <button key={t} type="button" className="tag-pill sug" onClick={() => add(t)}>
              <Sym name="add" size={14} /> {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
