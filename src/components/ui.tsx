import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Colleague, ShiftType } from '../lib/types';
import { grouped, type VocabItem } from '../lib/vocab';

export function uid(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field${wide ? ' field-wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function VocabSelect({
  items,
  value,
  onChange,
  placeholder,
}: {
  items: VocabItem[];
  value: string | undefined;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const groups = grouped(items);
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {groups.map(([g, list]) =>
        g ? (
          <optgroup key={g} label={g}>
            {list.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </optgroup>
        ) : (
          list.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))
        ),
      )}
    </select>
  );
}

/**
 * Text field for numbers. It keeps what is being typed as text, so the first digit can
 * be deleted (the field goes empty instead of snapping back to 0), and it selects its
 * content on focus so a new number can be typed straight away.
 */
function useDraft(value: number | undefined, commit: (raw: string) => void, fallback: (n: number | undefined) => string) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? fallback(value);
  return {
    value: shown,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/[^0-9.,]/g, '');
      setDraft(v);
      commit(v);
    },
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      const before = el.value;
      el.dataset.fresh = '1';
      el.select();
      // Re-select after the tap settles, unless something was typed meanwhile.
      setTimeout(() => el.value === before && el.select(), 0);
    },
    // The tap that focuses the field would otherwise drop the caret and cancel the selection.
    onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => {
      if (e.currentTarget.dataset.fresh) {
        e.preventDefault();
        delete e.currentTarget.dataset.fresh;
      }
    },
    onBlur: () => setDraft(null),
  };
}

const parse = (raw: string) => (raw.trim() === '' ? undefined : Number(raw.replace(',', '.')));

export function NumberInput({
  value,
  onChange,
  min = 0,
  placeholder,
}: {
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  min?: number;
  step?: number;
  placeholder?: string;
}) {
  const d = useDraft(
    value,
    (raw) => {
      const n = parse(raw);
      if (n === undefined) onChange(undefined);
      else if (Number.isFinite(n)) onChange(Math.max(min, n));
    },
    (n) => (n === undefined ? '' : String(n)),
  );
  return <input type="text" inputMode="decimal" enterKeyHint="next" autoComplete="off" placeholder={placeholder} {...d} />;
}

/** Required number: emptying the field keeps the old value until a new one is typed. */
export function NumField({ value, onChange, min = 0, max, label, className }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label?: string; className?: string }) {
  const d = useDraft(
    value,
    (raw) => {
      const n = parse(raw);
      if (n !== undefined && Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min, n)));
    },
    (n) => String(n ?? ''),
  );
  return <input type="text" inputMode="decimal" enterKeyHint="next" autoComplete="off" aria-label={label} className={className} {...d} />;
}

export function Chips<T extends { id: string }>({
  items,
  selected,
  onToggle,
  label,
}: {
  items: T[];
  selected: string[];
  onToggle: (id: string) => void;
  label: (t: T) => string;
}) {
  return (
    <div className="chips">
      {items.map((i) => (
        <button
          type="button"
          key={i.id}
          className={`chip${selected.includes(i.id) ? ' chip-on' : ''}`}
          aria-pressed={selected.includes(i.id)}
          onClick={() => onToggle(i.id)}
        >
          {label(i)}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function ShiftTypeSelect({
  types,
  value,
  onChange,
  empty = 'Nessun turno',
  pill = false,
}: {
  types: ShiftType[];
  value: string | undefined;
  onChange: (id: string) => void;
  empty?: string;
  /** Compact pill with the shift colour as a dot. */
  pill?: boolean;
}) {
  const groups = new Map<string, ShiftType[]>();
  for (const t of types) {
    const g = t.group ?? 'Altri turni';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(t);
  }
  const select = (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-label="Tipo di turno">
      <option value="">{empty}</option>
      {[...groups.entries()].map(([g, list]) => (
        <optgroup key={g} label={g}>
          {list.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
  if (!pill) return select;
  const color = types.find((t) => t.id === value)?.color;
  return (
    <span className="type-pill" style={color ? ({ '--dot': color } as CSSProperties) : undefined}>
      {select}
    </span>
  );
}

/** Selected colleagues as removable chips, plus a grouped picker to add more. */
export function ColleaguePicker({
  colleagues,
  selected,
  onChange,
}: {
  colleagues: Colleague[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const byRole = new Map<string, Colleague[]>();
  for (const c of colleagues) {
    if (selected.includes(c.id)) continue;
    const r = c.role || 'Altri';
    if (!byRole.has(r)) byRole.set(r, []);
    byRole.get(r)!.push(c);
  }
  return (
    <div className="picker picker-pills">
      {selected.map((id) => {
        const c = colleagues.find((x) => x.id === id);
        return (
          <button type="button" key={id} className="person-pill" aria-label={`Rimuovi ${c?.name ?? id}`} onClick={() => onChange(selected.filter((x) => x !== id))}>
            {c?.name ?? '—'} <span aria-hidden="true">×</span>
          </button>
        );
      })}
      <select className="add-pill" value="" onChange={(e) => e.target.value && onChange([...selected, e.target.value])} aria-label="Aggiungi collega">
        <option value="">+ Aggiungi collega</option>
        {[...byRole.entries()].map(([role, list]) => (
          <optgroup key={role} label={role}>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

const COLLAPSE_KEY = 'logbook.collapsed';

function readCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Open/closed state remembered per card on this device. */
export function useCollapsible(key: string, defaultOpen = true): [boolean, () => void] {
  const [open, setOpen] = useState(() => readCollapsed()[key] ?? defaultOpen);
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify({ ...readCollapsed(), [key]: !o }));
      } catch {
        /* storage unavailable */
      }
      return !o;
    });
  return [open, toggle];
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" className={`chevron${open ? ' open' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** Card with a header that collapses the body; `summary` is shown while closed. */
/** Decoration for every card inside a block (the day page sets the section label and the drag hint). */
export const CardDecor = createContext<{ kicker?: ReactNode; handle?: boolean }>({});
const NO_DECOR = {};

export function Card({
  id,
  icon,
  kicker: kickerProp,
  peek,
  title,
  summary,
  actions,
  defaultOpen = true,
  className = '',
  style,
  children,
  open: controlledOpen,
  onToggle,
  print,
  collapsible = true,
}: {
  id: string;
  icon?: ReactNode;
  /** Small uppercase label above the title. */
  kicker?: ReactNode;
  /** Shown under the head while the card is collapsed (e.g. a congress with its files). */
  peek?: ReactNode;
  title: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  /** Print section this card belongs to (see PrintDialog). */
  print?: string;
  /** false: always open, no arrow. */
  collapsible?: boolean;
}) {
  const decor = useContext(CardDecor);
  const kicker = kickerProp ?? decor.kicker;
  const [stored, toggleStored] = useCollapsible(id, defaultOpen);
  const open = !collapsible || (controlledOpen ?? stored);
  const toggle = onToggle ?? toggleStored;
  return (
    <section className={`card ${className}${open ? '' : ' collapsed'}`} style={style} data-print={print}>
      <div className="card-head">
        {icon}
        {collapsible ? (
          <button type="button" className={`card-title-btn${kicker ? ' has-kicker' : ''}`} onClick={toggle} aria-expanded={open}>
            {kicker && <span className="card-kicker">{kicker}</span>}
            <h2>{title}</h2>
            {!open && summary && <span className="card-summary">{summary}</span>}
          </button>
        ) : kicker ? (
          <div className="card-title-btn has-kicker">
            <span className="card-kicker">{kicker}</span>
            <h2>{title}</h2>
          </div>
        ) : (
          <h2>{title}</h2>
        )}
        {actions}
        {decor.handle && (
          <span className="drag-hint no-print" aria-hidden="true" title="Tieni premuto per spostare">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
              <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
            </svg>
          </span>
        )}
        {collapsible && (
          <button type="button" className="icon-btn small chevron-btn" onClick={toggle} aria-label={open ? 'Riduci' : 'Espandi'} aria-expanded={open}>
            <Chevron open={open} />
          </button>
        )}
      </div>
      {!open && peek}
      {/* Body stays mounted (hidden) so printing can include closed cards. */}
      <div className="card-body" hidden={!open}>
        {/* Cards nested inside (e.g. the roster in Turno) don't inherit the block's label. */}
        <CardDecor.Provider value={NO_DECOR}>{children}</CardDecor.Provider>
      </div>
    </section>
  );
}

/** Textarea that is always as tall as its text: one line when empty, growing as you type. */
export function AutoText({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} className={`auto-text ${className ?? ''}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

/** Time (or date) field as a tile: small label inside, big bold value. */
export function TimeTile({ label, value, onChange, type = 'time', min }: { label: string; value: string; onChange: (v: string) => void; type?: 'time' | 'date'; min?: string }) {
  return (
    <label className={`time-tile tile-${type}`}>
      <span className="tt-label">{label}</span>
      <input type={type} value={value} min={min} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** One choice among a few, as chips (the chosen one in lime with a check). */
export function ChipChoice({ items, value, onChange, label }: { items: VocabItem[]; value: string | undefined; onChange: (id: string) => void; label: string }) {
  return (
    <div className="chips choice-chips" role="radiogroup" aria-label={label}>
      {items.map((i) => (
        <button key={i.id} type="button" role="radio" aria-checked={value === i.id} className={`chip${value === i.id ? ' chip-pick' : ''}`} onClick={() => onChange(i.id)}>
          {value === i.id && <span aria-hidden="true">✓</span>}
          {i.label}
        </button>
      ))}
    </div>
  );
}
