import { useEffect, useMemo, useRef, useState } from 'react';

const HOLD_MS = 320;
const SLOP = 9;

interface Slot {
  id: string;
  center: number; // page y of the block's centre when the drag started
  height: number;
}

export interface DragState {
  id: string;
  dy: number; // finger movement of the dragged block, in px
  /** Vertical offset of every other block: they slide out of the way. */
  shifts: Record<string, number>;
}

/**
 * Long-press the head of a block (an element with data-block="<id>" containing a
 * .card-head) and drag it. The other blocks slide over to make room, so the list
 * always shows where the block will land. A short touch still taps and a normal swipe
 * still scrolls the page.
 */
export function useBlockDrag(order: string[], onReorder: (order: string[]) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [settling, setSettling] = useState(false);
  const live = useRef({ order, onReorder });
  live.current = { order, onReorder };

  const ctl = useMemo(() => {
    let s: {
      id: string;
      startX: number;
      startY: number;
      startScroll: number;
      y: number;
      timer: number;
      raf: number;
      active: boolean;
      slots: Slot[];
      me: number; // index of the dragged block in slots
      gap: number;
      j: number;
    } | null = null;

    const measure = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('[data-block]'));
      const slots = els.map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.dataset.block!, center: r.top + window.scrollY + r.height / 2, height: r.height, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
      });
      const gap = slots.length > 1 ? Math.max(0, slots[1].top - slots[0].bottom) : 14;
      return { slots, gap };
    };

    const compute = () => {
      if (!s) return;
      const dy = s.y - s.startY + (window.scrollY - s.startScroll);
      const me = s.slots[s.me];
      const c = me.center + dy;
      const others = s.slots.filter((_, k) => k !== s!.me);
      const j = others.filter((o) => o.center < c).length;
      s.j = j;
      const h = me.height + s.gap;
      const shifts: Record<string, number> = {};
      others.forEach((o, k) => {
        if (k >= s!.me && k < j) shifts[o.id] = -h;
        else if (k < s!.me && k >= j) shifts[o.id] = h;
      });
      setDrag({ id: s.id, dy, shifts });
    };

    const tick = () => {
      if (!s?.active) return;
      const h = window.innerHeight;
      if (s.y < 90) window.scrollBy(0, -(90 - s.y) / 5 - 2);
      else if (s.y > h - 90) window.scrollBy(0, (s.y - (h - 90)) / 5 + 2);
      compute();
      s.raf = requestAnimationFrame(tick);
    };

    const blockScroll = (e: TouchEvent) => {
      if (s?.active) e.preventDefault();
    };

    function finish(commit: boolean) {
      const cur = s;
      if (!cur) return;
      window.clearTimeout(cur.timer);
      cancelAnimationFrame(cur.raf);
      s = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('touchmove', blockScroll);
      if (cur.active) {
        // Swallow the click that follows the release so the card doesn't toggle.
        const eat = (e: Event) => e.stopPropagation();
        window.addEventListener('click', eat, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 400);
        if (commit) {
          const others = cur.slots.filter((_, k) => k !== cur.me);
          const rest = live.current.order.filter((x) => x !== cur.id);
          const before = others[cur.j]?.id;
          let at: number;
          if (before) at = rest.indexOf(before);
          else {
            const last = others[others.length - 1]?.id;
            at = last ? rest.indexOf(last) + 1 : rest.length;
          }
          const next = [...rest.slice(0, at), cur.id, ...rest.slice(at)];
          if (next.join() !== live.current.order.join()) live.current.onReorder(next);
        }
        setSettling(true);
        setTimeout(() => setSettling(false), 80);
      }
      setDrag(null);
    }

    function onMove(e: PointerEvent) {
      if (!s) return;
      s.y = e.clientY;
      if (!s.active && (Math.abs(e.clientX - s.startX) > SLOP || Math.abs(e.clientY - s.startY) > SLOP)) finish(false); // it's a scroll
    }
    const onUp = () => finish(true);
    const onCancel = () => finish(false);

    const onPointerDown = (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target as HTMLElement;
      const head = target.closest('.card-head');
      const el = target.closest<HTMLElement>('[data-block]');
      if (!head || !el || target.closest('input, select, textarea, a, .icon-btn:not(.chevron-btn)')) return;
      finish(false);
      s = {
        id: el.dataset.block!,
        startX: e.clientX,
        startY: e.clientY,
        startScroll: window.scrollY,
        y: e.clientY,
        raf: 0,
        active: false,
        slots: [],
        me: 0,
        gap: 14,
        j: 0,
        timer: window.setTimeout(() => {
          if (!s) return;
          const m = measure();
          s.slots = m.slots;
          s.gap = m.gap;
          s.me = m.slots.findIndex((x) => x.id === s!.id);
          if (s.me < 0) return finish(false);
          s.j = s.me;
          s.active = true;
          window.addEventListener('touchmove', blockScroll, { passive: false });
          navigator.vibrate?.(15);
          window.getSelection()?.removeAllRanges();
          s.raf = requestAnimationFrame(tick);
        }, HOLD_MS),
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    };

    return { onPointerDown, finish };
  }, []);

  useEffect(() => () => ctl.finish(false), [ctl]);

  return { drag, settling, onPointerDown: ctl.onPointerDown };
}
