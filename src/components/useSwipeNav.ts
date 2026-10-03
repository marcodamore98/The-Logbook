import { useEffect, useLayoutEffect, useRef } from 'react';

const SKIP = 'input, textarea, select, .set-wrap, .scroll-x, [data-no-swipe], .sheet-backdrop, .rest-big, .run-summary, .drawer-backdrop';
const EDGE = 40; // the left edge belongs to the menu

/**
 * Swipe the page sideways to move to the previous/next item (day, week, month…).
 * The page follows the finger while dragging; on release it either completes the move
 * (and the next page slides in from the other side) or springs back.
 * `key` identifies the current item: when it changes the page slides in.
 */
export function useSwipeNav<T extends HTMLElement>(onPrev: () => void, onNext: () => void, key: string, can: (dir: 1 | -1) => boolean = () => true) {
  const ref = useRef<T>(null);
  const cb = useRef({ onPrev, onNext, can });
  cb.current = { onPrev, onNext, can };
  const entering = useRef<0 | 1 | -1>(0);
  const clearTimer = useRef(0);
  // A transform on the page would turn it into the containing block of fixed overlays, so drop it once settled.
  const settle = (el: HTMLElement, ms: number) => {
    window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
    }, ms);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let g: { x: number; y: number; t: number; lock: 'x' | 'y' | null; dx: number; v: number; lastX: number; lastT: number } | null = null;

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX <= EDGE || (e.target as HTMLElement).closest(SKIP) || document.querySelector('.is-dragging')) return;
      g = { x: t.clientX, y: t.clientY, t: Date.now(), lock: null, dx: 0, v: 0, lastX: t.clientX, lastT: Date.now() };
    };
    const move = (e: TouchEvent) => {
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (!g.lock) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        g.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
        if (g.lock === 'x') {
          window.clearTimeout(clearTimer.current);
          el.style.transition = 'none';
        }
      }
      if (g.lock !== 'x') return;
      if (e.cancelable) e.preventDefault();
      const now = Date.now();
      g.v = (t.clientX - g.lastX) / Math.max(1, now - g.lastT);
      g.lastX = t.clientX;
      g.lastT = now;
      g.dx = dx;
      // A little resistance so it feels attached to the finger without flying off.
      el.style.transform = `translate3d(${dx}px,0,0)`;
      el.style.opacity = String(1 - Math.min(0.35, Math.abs(dx) / window.innerWidth));
    };
    const end = () => {
      const cur = g;
      g = null;
      if (!cur || cur.lock !== 'x') return;
      const w = window.innerWidth;
      const go = (Math.abs(cur.dx) > w * 0.28 || (Math.abs(cur.v) > 0.5 && Math.abs(cur.dx) > 40)) && cb.current.can(cur.dx < 0 ? 1 : -1);
      el.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s';
      if (!go) {
        el.style.transform = 'translate3d(0,0,0)';
        el.style.opacity = '1';
        settle(el, 240);
        return;
      }
      const dir = cur.dx < 0 ? 1 : -1; // swiping left shows the next item
      entering.current = dir;
      window.clearTimeout(clearTimer.current);
      el.style.transform = `translate3d(${-dir * w}px,0,0)`;
      el.style.opacity = '0.2';
      window.setTimeout(() => (dir === 1 ? cb.current.onNext() : cb.current.onPrev()), 170);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, []);

  // New item: slide in from the side we swiped towards.
  useLayoutEffect(() => {
    const el = ref.current;
    const dir = entering.current;
    entering.current = 0;
    if (!el || !dir) return;
    el.style.transition = 'none';
    el.style.transform = `translate3d(${dir * window.innerWidth}px,0,0)`;
    el.style.opacity = '0.2';
    void el.offsetWidth;
    el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s';
    el.style.transform = 'translate3d(0,0,0)';
    el.style.opacity = '1';
    settle(el, 260);
  }, [key]);

  return ref;
}
