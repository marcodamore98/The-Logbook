import type { ReactNode } from 'react';
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

export function NumberInput({
  value,
  onChange,
  min = 0,
  step = 1,
  placeholder,
}: {
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  min?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
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
}: {
  types: ShiftType[];
  value: string | undefined;
  onChange: (id: string) => void;
  empty?: string;
}) {
  const groups = new Map<string, ShiftType[]>();
  for (const t of types) {
    const g = t.group ?? 'Altri turni';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(t);
  }
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
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
    <div className="picker">
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((id) => {
            const c = colleagues.find((x) => x.id === id);
            return (
              <button type="button" key={id} className="chip chip-on" aria-label={`Rimuovi ${c?.name ?? id}`} onClick={() => onChange(selected.filter((x) => x !== id))}>
                {c?.name ?? '—'} <span aria-hidden="true">×</span>
              </button>
            );
          })}
        </div>
      )}
      <select value="" onChange={(e) => e.target.value && onChange([...selected, e.target.value])} aria-label="Aggiungi collega">
        <option value="">+ Aggiungi collega…</option>
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
