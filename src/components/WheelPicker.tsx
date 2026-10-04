import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ROW = 56; // px per row; three rows visible, the middle one is the value

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * One vertical wheel, like the clock app: scroll it and it snaps on a value. Tapping the
 * middle number turns it into a field to type the value; only values of the wheel are
 * accepted (e.g. 0–59 for minutes), anything else is ignored.
 */
function Wheel({ max, value, onChange, label }: { max: number; value: number; onChange: (n: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const [shown, setShown] = useState(value);
  const [typing, setTyping] = useState<string | null>(null);

  // Keep the wheel on the value (first render and changes made by typing).
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ROW) !== value) el.scrollTop = value * ROW;
    setShown(value);
  }, [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(max, Math.round(el.scrollTop / ROW)));
    setShown(i);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (i !== value) {
        navigator.vibrate?.(5);
        onChange(i);
      }
    }, 120);
  };

  const commit = () => {
    const raw = typing?.trim() ?? '';
    setTyping(null);
    if (!/^\d{1,2}$/.test(raw)) return;
    const n = Number(raw);
    if (n <= max) onChange(n);
  };

  return (
    <div className="wheel-col">
      <div
        ref={ref}
        className="wheel"
        role="spinbutton"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={shown}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') onChange(Math.max(0, value - 1));
          else if (e.key === 'ArrowDown') onChange(Math.min(max, value + 1));
          else if (/^\d$/.test(e.key)) setTyping(e.key);
          else return;
          e.preventDefault();
        }}
        onClick={(e) => {
          const box = ref.current!.getBoundingClientRect();
          const row = Math.floor((e.clientY - box.top) / ROW) - 1; // -1 above, 0 middle, 1 below
          if (row === 0) setTyping('');
          else ref.current!.scrollTo({ top: (shown + row) * ROW, behavior: 'smooth' });
        }}
      >
        <div className="wheel-pad" />
        {Array.from({ length: max + 1 }, (_, i) => (
          <div key={i} className={`wheel-item${i === shown ? ' on' : ''}`}>
            {pad2(i)}
          </div>
        ))}
        <div className="wheel-pad" />
      </div>
      {typing !== null && (
        <input
          className="wheel-type"
          autoFocus
          inputMode="numeric"
          enterKeyHint="done"
          maxLength={2}
          aria-label={`${label}: scrivi un numero da 0 a ${max}`}
          value={typing}
          placeholder={pad2(shown)}
          onChange={(e) => setTyping(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setTyping(null);
          }}
          onBlur={commit}
        />
      )}
    </div>
  );
}

/** Bottom sheet with two wheels ("06 : 30"), Annulla / Salva like the alarm app. */
function WheelSheet({
  title,
  a,
  b,
  maxA,
  labelA,
  labelB,
  unitA,
  unitB,
  onSave,
  onClear,
  onClose,
}: {
  title: string;
  a: number;
  b: number;
  maxA: number;
  labelA: string;
  labelB: string;
  unitA?: string;
  unitB?: string;
  onSave: (a: number, b: number) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const [va, setA] = useState(a);
  const [vb, setB] = useState(b);
  return createPortal(
    <div className="sheet-backdrop wheel-backdrop" onClick={onClose}>
      <div className="sheet wheel-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" aria-hidden="true" />
        <h2 className="wheel-title">{title}</h2>
        <div className="wheels">
          <Wheel max={maxA} value={va} onChange={setA} label={labelA} />
          {unitA ? <span className="wheel-unit">{unitA}</span> : <span className="wheel-sep">:</span>}
          <Wheel max={59} value={vb} onChange={setB} label={labelB} />
          {unitB && <span className="wheel-unit">{unitB}</span>}
        </div>
        <p className="wheel-hint muted small">Scorri le rotelle o tocca il numero al centro per scriverlo.</p>
        <div className="wheel-actions">
          <button type="button" className="wheel-btn" onClick={onClose}>
            Annulla
          </button>
          {onClear && (
            <button type="button" className="wheel-btn quiet" onClick={() => { onClear(); onClose(); }}>
              Togli
            </button>
          )}
          <button type="button" className="wheel-btn strong" onClick={() => { onSave(va, vb); onClose(); }}>
            Salva
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** A time of day ("HH:MM"): shows the value, tap → hour and minute wheels. */
export function TimeField({ value, onChange, label, clearable, className }: { value: string | undefined; onChange: (v: string | undefined) => void; label: string; clearable?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [h, m] = value && /^\d{1,2}:\d{2}/.test(value) ? value.split(':').map(Number) : [new Date().getHours(), 0];
  return (
    <>
      <button type="button" className={`wheel-field${value ? '' : ' empty'} ${className ?? ''}`} aria-label={`${label}: ${value || 'nessun orario'}`} onClick={() => setOpen(true)}>
        {value || '--:--'}
      </button>
      {open && (
        <WheelSheet
          title={label}
          a={h}
          b={m}
          maxA={23}
          labelA="Ore"
          labelB="Minuti"
          onSave={(hh, mm) => onChange(`${pad2(hh)}:${pad2(mm)}`)}
          onClear={clearable ? () => onChange(undefined) : undefined}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * A duration. `unit="sec"`: minutes and seconds (value in seconds, e.g. a series or a set);
 * `unit="min"`: hours and minutes (value in minutes, e.g. a surgery or a workout).
 */
export function DurationField({ value, onChange, label, unit = 'sec', className }: { value: number | undefined; onChange: (v: number) => void; label: string; unit?: 'sec' | 'min'; className?: string }) {
  const [open, setOpen] = useState(false);
  const v = Math.max(0, Math.round(value ?? 0));
  const a = Math.floor(v / 60);
  const b = v % 60;
  const text = unit === 'sec' ? `${a}′ ${pad2(b)}″` : a ? `${a} h ${pad2(b)}′` : `${b}′`;
  return (
    <>
      <button type="button" className={`wheel-field${value ? '' : ' empty'} ${className ?? ''}`} aria-label={`${label}: ${text}`} onClick={() => setOpen(true)}>
        {text}
      </button>
      {open && (
        <WheelSheet
          title={label}
          a={a}
          b={b}
          maxA={unit === 'sec' ? 180 : 23}
          labelA={unit === 'sec' ? 'Minuti' : 'Ore'}
          labelB={unit === 'sec' ? 'Secondi' : 'Minuti'}
          unitA={unit === 'sec' ? 'min' : 'h'}
          unitB={unit === 'sec' ? 'sec' : 'min'}
          onSave={(x, y) => onChange(x * 60 + y)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
