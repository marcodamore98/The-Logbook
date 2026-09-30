import type { ReactNode } from 'react';
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
