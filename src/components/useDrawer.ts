import { useCallback, useEffect, useRef, useState } from 'react';

/** Width of the strip at the left edge from which a swipe opens the menu. */
export const EDGE_PX = 40;

/**
 * Left drawer that follows the finger: dragging from the left edge pulls it out as far
 * as the finger goes, dragging it back pushes it in. On release it settles open or
 * closed depending on how far and how fast it was moved.
 */
export function useDrawer() {
  const [visible, setVisible] = useState(false); // mounted
  const [p, setP] = useState(0); // 0 closed … 1 open
  const [dragging, setDragging] = useState(false);
  const state = useRef({ visible: false, p: 0 });
  state.current = { visible, p };
  const timer = useRef(0);

  const open = useCallback(() => {
    window.clearTimeout(timer.current);
    setVisible(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setP(1)));
  }, []);
  const close = useCallback(() => {
    setP(0);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), 240);
  }, []);

  useEffect(() => {
    let g: { mode: 'open' | 'close'; x: number; y: number; t: number; engaged: boolean; w: number; lastX: number; lastT: number; v: number } | null = null;
    const width = () => document.querySelector<HTMLElement>('.nav-drawer')?.offsetWidth ?? Math.min(300, window.innerWidth * 0.86);

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const cur = state.current;
      let mode: 'open' | 'close' | null = null;
      if (!cur.visible && t.clientX <= EDGE_PX) mode = 'open';
      else if (cur.visible && cur.p > 0.5 && (e.target as HTMLElement).closest('.drawer-backdrop.left')) mode = 'close';
      g = mode ? { mode, x: t.clientX, y: t.clientY, t: Date.now(), engaged: false, w: width(), lastX: t.clientX, lastT: Date.now(), v: 0 } : null;
    };
    const move = (e: TouchEvent) => {
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (!g.engaged) {
        if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
          g = null; // vertical: it's a scroll
          return;
        }
        if ((g.mode === 'open' && dx > 10) || (g.mode === 'close' && dx < -10)) {
          g.engaged = true;
          window.clearTimeout(timer.current);
          setVisible(true);
          setDragging(true);
        } else return;
      }
      if (e.cancelable) e.preventDefault();
      const now = Date.now();
      g.v = (t.clientX - g.lastX) / Math.max(1, now - g.lastT);
      g.lastX = t.clientX;
      g.lastT = now;
      const prog = g.mode === 'open' ? dx / g.w : 1 + dx / g.w;
      setP(Math.min(1, Math.max(0, prog)));
    };
    const end = () => {
      const cur = g;
      g = null;
      if (!cur?.engaged) return;
      setDragging(false);
      const prog = state.current.p;
      const goOpen = cur.v > 0.45 ? true : cur.v < -0.45 ? false : prog > 0.5;
      if (goOpen) open();
      else close();
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, [open, close]);

  return { visible, p, dragging, open, close };
}
