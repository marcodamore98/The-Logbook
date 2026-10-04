import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Things that sit on top of the page and that "back" should close, topmost last in the DOM. */
const OVERLAYS = '.sheet-backdrop, .drawer-backdrop, .finish-backdrop, .finish-screen, .rest-big, .run-summary';

/**
 * Android back button / back gesture: closes the open sheet, drawer or full-screen panel
 * instead of leaving the page, like native apps do. Each overlay gets a history entry
 * while it is open; closing it by hand removes that entry again.
 */
export function useBackClosesOverlays() {
  useEffect(() => {
    let pushed = 0;
    let skip = 0;
    let hashAtOpen = '';
    let raf = 0;

    const sync = () => {
      raf = 0;
      const n = document.querySelectorAll(OVERLAYS).length;
      if (n > pushed) {
        if (!pushed) hashAtOpen = location.hash;
        while (pushed < n) {
          history.pushState({ overlay: true }, '');
          pushed++;
        }
      } else if (n < pushed) {
        const extra = pushed - n;
        pushed = n;
        // Closed by hand: drop the entries we added, unless the user navigated away meanwhile.
        if (location.hash === hashAtOpen && history.state?.overlay) {
          skip++;
          history.go(-extra);
        }
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };
    const onPop = () => {
      if (skip > 0) {
        skip--;
        return;
      }
      if (pushed === 0) return;
      pushed--;
      const all = document.querySelectorAll<HTMLElement>(OVERLAYS);
      const top = all[all.length - 1];
      if (top) (top.querySelector<HTMLElement>('[data-back]') ?? top).click();
    };

    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', onPop);
    return () => {
      mo.disconnect();
      window.removeEventListener('popstate', onPop);
      cancelAnimationFrame(raf);
    };
  }, []);
}

/**
 * Bottom sheets close by dragging them down from their top edge (grabber or title),
 * like on Android and iOS. Works for every `.sheet` inside a `.sheet-backdrop`.
 */
export function useSheetSwipeDown() {
  useEffect(() => {
    let g: { sheet: HTMLElement; y: number; t: number; dy: number; active: boolean } | null = null;

    const start = (e: TouchEvent) => {
      const sheet = (e.target as HTMLElement).closest<HTMLElement>('.sheet');
      if (!sheet || !sheet.closest('.sheet-backdrop') || e.touches.length !== 1) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, .subsheet')) return;
      const top = sheet.getBoundingClientRect().top;
      const y = e.touches[0].clientY;
      // Only from the top band of the sheet, or anywhere when the sheet is not scrolled.
      if (y - top > 72 && sheet.scrollTop > 0) return;
      if (y - top > 72 && !(e.target as HTMLElement).closest('.grabber, .sheet-head, .picker-bar')) return;
      g = { sheet, y, t: Date.now(), dy: 0, active: false };
    };
    const move = (e: TouchEvent) => {
      if (!g) return;
      const dy = e.touches[0].clientY - g.y;
      if (!g.active) {
        if (dy < -6) {
          g = null;
          return;
        }
        if (dy < 8) return;
        g.active = true;
        g.sheet.style.transition = 'none';
      }
      if (e.cancelable) e.preventDefault();
      g.dy = Math.max(0, dy);
      g.sheet.style.transform = `translate3d(0, ${g.dy}px, 0)`;
    };
    const end = () => {
      const cur = g;
      g = null;
      if (!cur?.active) return;
      const v = cur.dy / Math.max(1, Date.now() - cur.t);
      cur.sheet.style.transition = 'transform 0.2s ease';
      if (cur.dy > 110 || v > 0.6) {
        cur.sheet.style.transform = 'translate3d(0, 100%, 0)';
        window.setTimeout(() => cur.sheet.closest<HTMLElement>('.sheet-backdrop')?.click(), 160);
      } else {
        cur.sheet.style.transform = '';
        window.setTimeout(() => (cur.sheet.style.transition = ''), 220);
      }
    };
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', end, { passive: true });
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', end);
    };
  }, []);
}

/** The right-hand drawer ("Corpo") closes by dragging it back to the right. */
export function useRightDrawerSwipe() {
  useEffect(() => {
    let g: { el: HTMLElement; x: number; y: number; dx: number; lock: 'x' | 'y' | null } | null = null;
    const start = (e: TouchEvent) => {
      // From the panel or the strip beside it: a rightward swipe pushes the panel away.
      const el = (e.target as HTMLElement).closest<HTMLElement>('.drawer-backdrop:not(.left)')?.querySelector<HTMLElement>('.drawer');
      if (!el || e.touches.length !== 1) return;
      g = { el, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, lock: null };
    };
    const move = (e: TouchEvent) => {
      if (!g) return;
      const dx = e.touches[0].clientX - g.x;
      const dy = e.touches[0].clientY - g.y;
      if (!g.lock) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        g.lock = dx > 0 && Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (g.lock === 'x') g.el.style.transition = 'none';
      }
      if (g.lock !== 'x') return;
      if (e.cancelable) e.preventDefault();
      g.dx = Math.max(0, dx);
      g.el.style.transform = `translate3d(${g.dx}px,0,0)`;
    };
    const end = () => {
      const cur = g;
      g = null;
      if (!cur || cur.lock !== 'x') return;
      cur.el.style.transition = 'transform 0.2s ease';
      if (cur.dx > cur.el.offsetWidth * 0.35) {
        cur.el.style.transform = 'translate3d(100%,0,0)';
        window.setTimeout(() => cur.el.closest<HTMLElement>('.drawer-backdrop')?.click(), 170);
      } else cur.el.style.transform = '';
    };
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { passive: true });
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
    };
  }, []);
}

/**
 * Scroll position per page: going back returns where you were, opening a new page starts
 * from the top (React Router's own restoration needs a data router, so this is the small version).
 */
export function ScrollMemory() {
  const loc = useLocation();
  const type = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const path = useRef(loc.pathname);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        positions.current.set(path.current, window.scrollY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (path.current === loc.pathname) return; // same page (e.g. a sheet's history entry)
    path.current = loc.pathname;
    const y = type === 'POP' ? positions.current.get(loc.pathname) ?? 0 : 0;
    window.scrollTo(0, y);
    // Content may still be loading: try again once it has rendered.
    if (y) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
  }, [loc.pathname, type]);

  return null;
}
