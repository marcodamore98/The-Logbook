import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sym } from './icons';

export interface PickItem {
  id: string;
  label: string;
  /** Second line (times of a shift, role of a colleague). */
  sub?: string;
  group?: string;
  /** Colour dot (shift types); without it the initials are shown. */
  color?: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const initials = (s: string) =>
  s
    .replace(/^(dott\.?ssa|dott\.?|dr\.?ssa|dr\.?|prof\.?ssa|prof\.?)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * Full-page chooser with a search bar, in the style of "Aggiungi alimenti" (instead of the
 * phone's own black list): shift types or colleagues, grouped, with the chosen ones checked.
 * Single choice closes at once; multiple choice stays open until "Fatto".
 */
export function SearchPicker({
  title,
  placeholder,
  items,
  selected,
  multi = false,
  onPick,
  onClose,
  onCreate,
  extra,
}: {
  title: string;
  placeholder: string;
  items: PickItem[];
  selected: string[];
  multi?: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
  /** Offers to add what was typed when nothing matches (new colleague). */
  onCreate?: (name: string) => void;
  /** Rows shown above the list (e.g. "Nessun turno"). */
  extra?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return items.filter((i) => words.every((w) => norm(`${i.label} ${i.sub ?? ''}`).includes(w)));
  }, [items, q]);
  const groups = useMemo(() => {
    const m = new Map<string, PickItem[]>();
    for (const i of shown) {
      const g = i.group ?? '';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(i);
    }
    return [...m.entries()];
  }, [shown]);
  const pick = (id: string) => {
    onPick(id);
    if (!multi) onClose();
  };
  return createPortal(
    <div className="sheet-backdrop food-screen pick-screen">
      <div className="fs-page" role="dialog" aria-label={title}>
        <header className="fs-head">
          <button type="button" className="icon-btn fs-back" aria-label="Indietro" data-back onClick={onClose}>
            <Sym name="arrow_back" size={22} />
          </button>
          <h2 className="pick-title">{title}</h2>
          <button type="button" className="icon-btn fs-close" aria-label="Chiudi" onClick={onClose}>
            <Sym name="close" size={22} />
          </button>
        </header>
        <div className="fs-search">
          <span className="icon-input food-search">
            <Sym name="search" size={18} />
            <input type="search" placeholder={placeholder} value={q} autoFocus onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
          </span>
        </div>
        <div className="fs-body pick-body">
          {!q && extra}
          {groups.map(([g, list]) => (
            <section key={g || 'all'} className="pick-group">
              {g && <h3 className="fs-kicker">{g}</h3>}
              <ul className="pick-list">
                {list.map((i) => {
                  const on = selected.includes(i.id);
                  return (
                    <li key={i.id}>
                      <button type="button" className={`pick-row${on ? ' on' : ''}`} aria-pressed={on} onClick={() => pick(i.id)}>
                        {i.color ? <span className="pick-dot" style={{ '--dot': i.color } as CSSProperties} /> : <span className="pick-avatar">{initials(i.label) || '?'}</span>}
                        <span className="pick-text">
                          <span className="pick-label">{i.label || 'Senza nome'}</span>
                          {i.sub && <span className="pick-sub">{i.sub}</span>}
                        </span>
                        <span className="pick-check" aria-hidden="true">{on ? <Sym name="check" size={16} /> : null}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {!shown.length && (
            <div className="pick-empty">
              <p className="fs-empty">Nessun risultato per “{q}”.</p>
              {onCreate && q.trim() && (
                <button type="button" className="btn" onClick={() => { onCreate(q.trim()); setQ(''); }}>
                  <Sym name="add" size={18} /> Aggiungi “{q.trim()}”
                </button>
              )}
            </div>
          )}
        </div>
        {multi && (
          <div className="pick-foot">
            <button type="button" className="btn pick-done" onClick={onClose}>
              Fatto{selected.length ? ` · ${selected.length}` : ''}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
