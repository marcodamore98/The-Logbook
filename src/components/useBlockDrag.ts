import { useEffect, useMemo, useRef, useState } from 'react';

const HOLD_MS = 380;
const SLOP = 9;

/**
 * Long-press the head of a block (an element with data-block="<id>" containing a
 * .card-head) and drag it with the finger to reorder. A short touch still taps and
 * a normal swipe still scrolls the page.
 */
export function useBlockDrag(order: string[], onReorder: (order: string[]) => void) {
  const [drag, setDrag] = useState<{ id: string; dy: number; before: string | null } | null>(null);
  const live = useRef({ order, onReorder });
  live.current = { order, onReorder };
  const ctl = useMemo(() => {
  const state: { current: {
    id: string;
    el: HTMLElement;
    startX: number;
    startY: number;
    startScroll: number;
    y: number;
    timer: number;
    active: boolean;
    raf: number;
  } | null } = { current: null };

  const blocks = () => Array.from(document.querySelectorAll<HTMLElement>('[data-block]'));

  // Where the dragged block would land: before this block id (null = at the end).
  const targetFor = (id: string, y: number): string | null => {
    for (const b of blocks()) {
      if (b.dataset.block === id) continue;
      const r = b.getBoundingClientRect();
      if (y < r.top + r.height / 2) return b.dataset.block!;
    }
    return null;
  };

  const finish = (commit: boolean) => {
    const s = state.current;
    if (!s) return;
    window.clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    state.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('touchmove', blockScroll);
    if (s.active) {
      // Swallow the click that follows the release so the card doesn't toggle.
      const eat = (e: Event) => e.stopPropagation();
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 400);
      if (commit) {
        const before = targetFor(s.id, s.y);
        const rest = live.current.order.filter((x) => x !== s.id);
        const at = before ? rest.indexOf(before) : rest.length;
        const next = [...rest.slice(0, at), s.id, ...rest.slice(at)];
        if (next.join() !== live.current.order.join()) live.current.onReorder(next);
      }
    }
    setDrag(null);
  };

  const blockScroll = (e: TouchEvent) => {
    if (state.current?.active) e.preventDefault();
  };

  const tick = () => {
    const s = state.current;
    if (!s?.active) return;
    // Auto-scroll near the screen edges.
    const h = window.innerHeight;
    if (s.y < 90) window.scrollBy(0, -12);
    else if (s.y > h - 90) window.scrollBy(0, 12);
    setDrag({ id: s.id, dy: s.y - s.startY + (window.scrollY - s.startScroll), before: targetFor(s.id, s.y) });
    s.raf = requestAnimationFrame(tick);
  };

  function onMove(e: PointerEvent) {
    const s = state.current;
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
    const s = {
      id: el.dataset.block!,
      el,
      startX: e.clientX,
      startY: e.clientY,
      startScroll: window.scrollY,
      y: e.clientY,
      active: false,
      raf: 0,
      timer: window.setTimeout(() => {
        const cur = state.current;
        if (!cur) return;
        cur.active = true;
        navigator.vibrate?.(15);
        window.getSelection()?.removeAllRanges();
        cur.raf = requestAnimationFrame(tick);
      }, HOLD_MS),
    };
    state.current = s;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('touchmove', blockScroll, { passive: false });
  };

    return { onPointerDown, finish };
  }, []);

  useEffect(() => () => ctl.finish(false), [ctl]);

  return { drag, onPointerDown: ctl.onPointerDown };
}
