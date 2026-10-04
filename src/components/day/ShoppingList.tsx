import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store/StoreContext';
import type { ShopItem } from '../../lib/types';
import { useUndo } from '../Undo';
import { DragGrip, uid } from '../ui';
import { useSortableList } from '../useBlockDrag';

/**
 * Shopping list inside "Da ricordare": just ticks and names. One list shared by every day,
 * so what you write on Monday is still there when you shop on Tuesday.
 * Enter adds the next item, Backspace on an empty item removes it.
 */
export function ShoppingList({ addSignal }: { addSignal: number }) {
  const store = useStore();
  const offerUndo = useUndo();
  const items = store.settings.shopping ?? [];
  const [draft, setDraft] = useState('');
  const refs = useRef(new Map<string, HTMLInputElement>());
  const newRef = useRef<HTMLInputElement>(null);
  const focusNext = useRef<string | 'new' | null>(null);

  const save = (next: ShopItem[]) => store.saveSettings({ ...store.settings, shopping: next });

  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    (id === 'new' ? newRef.current : refs.current.get(id))?.focus();
  });

  // The "+" in the card header jumps to the new-item field.
  useEffect(() => {
    if (addSignal) newRef.current?.focus();
  }, [addSignal]);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    save([...items, { id: uid(), text, done: false }]);
    setDraft('');
    focusNext.current = 'new';
  };

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const shown = [...open, ...done];
  // Hold an item and drag it up or down (ticked ones stay at the bottom).
  const sort = useSortableList(shown, (list) => save([...list.filter((i) => !i.done), ...list.filter((i) => i.done)]), { attr: 'shop', handle: '.shop-item' });

  return (
    <div className="shop">
      <ul className="shop-list" {...sort.container}>
        {shown.map((it, k) => (
          <li key={it.id} {...sort.item(k)} className={`shop-item${it.done ? ' done' : ''} ${sort.item(k).className}`}>
            <DragGrip />
            <input type="checkbox" checked={it.done} aria-label={it.done ? 'Da comprare' : 'Comprato'} onChange={(e) => save(items.map((x) => (x.id === it.id ? { ...x, done: e.target.checked } : x)))} />
            <input
              ref={(el) => {
                if (el) refs.current.set(it.id, el);
                else refs.current.delete(it.id);
              }}
              className="grow"
              value={it.text}
              aria-label="Articolo"
              enterKeyHint="next"
              onChange={(e) => save(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  focusNext.current = 'new';
                  newRef.current?.focus();
                } else if (e.key === 'Backspace' && !it.text) {
                  e.preventDefault();
                  const at = open.findIndex((x) => x.id === it.id);
                  focusNext.current = at > 0 ? open[at - 1].id : 'new';
                  save(items.filter((x) => x.id !== it.id));
                }
              }}
              onBlur={() => {
                if (!it.text.trim()) save(items.filter((x) => x.id !== it.id));
              }}
            />
          </li>
        ))}
        <li className="shop-item shop-new no-print">
          <span className="shop-plus" aria-hidden="true">
            +
          </span>
          <input
            ref={newRef}
            className="grow"
            value={draft}
            placeholder="Aggiungi…"
            aria-label="Nuovo articolo"
            enterKeyHint="done"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
          />
        </li>
      </ul>
      {done.length > 0 && (
        <button type="button" className="shop-clear no-print" onClick={() => {
            save(open);
            offerUndo(done.length === 1 ? 'Articolo tolto' : `${done.length} articoli tolti`, () => store.saveSettings({ ...store.settings, shopping: items }));
          }}>
          Togli gli spuntati ({done.length})
        </button>
      )}
    </div>
  );
}
