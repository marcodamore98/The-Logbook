import { useRef, useState, type ReactNode } from 'react';
import { GlyphTrash } from './icons';
import { EDGE_PX } from './useDrawer';

/**
 * A row that deletes itself when swiped left: the red "Elimina" grows under the finger and,
 * past about a third of the row, the row goes on release (the caller offers "Annulla").
 */
export function SwipeDelete({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const [moving, setMoving] = useState(false);
  const g = useRef<{ x: number; y: number; w: number; t: number; lock: 'x' | 'y' | null } | null>(null);
  const limit = (w: number) => Math.min(140, w * 0.35);
  const armed = g.current ? dx < -limit(g.current.w) : false;
  return (
    <div
      className={`swipe-del${dx ? ' open' : ''}`}
      data-no-swipe
      onTouchStart={(e) => {
        const t = e.touches[0];
        // From the screen edge the swipe opens the day summary instead.
        if ((e.target as HTMLElement).closest('input, textarea, select') || t.clientX >= window.innerWidth - EDGE_PX) return;
        g.current = { x: t.clientX, y: t.clientY, w: e.currentTarget.offsetWidth, t: Date.now(), lock: null };
      }}
      onTouchMove={(e) => {
        const c = g.current;
        if (!c) return;
        const t = e.touches[0];
        const mx = t.clientX - c.x;
        const my = t.clientY - c.y;
        if (!c.lock) {
          if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
          // After a long press the row is being dragged up or down, not swiped.
          c.lock = Date.now() - c.t < 300 && Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
          if (c.lock === 'x') setMoving(true);
        }
        if (c.lock === 'x') setDx(Math.min(0, mx));
      }}
      onTouchEnd={() => {
        const c = g.current;
        g.current = null;
        setMoving(false);
        if (!c || c.lock !== 'x') return;
        if (dx < -limit(c.w)) {
          setDx(-c.w);
          navigator.vibrate?.(10);
          window.setTimeout(() => {
            setDx(0);
            onDelete();
          }, 160);
        } else setDx(0);
      }}
    >
      <span className={`swipe-del-bg${armed ? ' armed' : ''}`} aria-hidden="true" style={{ width: Math.max(0, -dx) }}>
        <GlyphTrash />
        Elimina
      </span>
      <div className="swipe-del-fg" style={{ transform: dx ? `translate3d(${dx}px,0,0)` : undefined, transition: moving ? 'none' : undefined }}>
        {children}
      </div>
    </div>
  );
}
