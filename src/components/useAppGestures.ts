import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { today } from '../lib/dates';
import { consumeSilentPop, pushGuard, setBackHandler, silenceNextPop } from '../lib/backNav';

/** Things that sit on top of the page and that "back" should close, topmost last in the DOM. */
export const OVERLAYS = '.sheet-backdrop, .fan-backdrop, .drawer-backdrop, .finish-backdrop, .finish-screen, .rest-big, .run-summary';

/** Parent page for the back button: a workout goes to Palestra, a section page to the day page, another day to today. */
export function parentOf(path: string, lastDay: string): string | null {
  const [top, sub] = path.split('/').filter(Boolean);
  switch (top) {
    case 'palestra':
      return sub === 'allenamento' ? '/palestra' : lastDay;
    case 'corsi':
      return sub ? '/corsi' : lastDay;
    case 'alimentazione':
    case 'diario':
      return sub ? `/giorno/${sub}` : lastDay;
    case 'giorno':
    case undefined:
      return sub && sub !== today() ? `/giorno/${today()}` : null;
    default:
      return lastDay; // mese, settimana, corsa, statistiche, impostazioni
  }
}

/**
 * Android back by hierarchy (see lib/backNav): when back lands below the page entry and no sheet or
 * drawer is open, go to the parent page; from today's page, leave the app.
 */
export function useHierarchicalBack() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = useRef(location.pathname);
  const lastDay = useRef(`/giorno/${today()}`);
  path.current = location.pathname;
  if (location.pathname.startsWith('/giorno/')) lastDay.current = location.pathname;
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (consumeSilentPop()) return; // the app dropping a closed sheet's entry
      const st = (e.state ?? {}) as { lbBase?: boolean; lbGuard?: boolean; overlay?: boolean };
      if (document.querySelector(OVERLAYS)) return; // back closes the open sheet or drawer first
      if (!st.lbBase && !st.lbGuard && !st.overlay) return; // an entry we do not manage
      // Entries left by sheets closed while navigating keep an old URL: the router must not show it.
      e.stopImmediatePropagation();
      const parent = parentOf(path.current, lastDay.current === path.current ? `/giorno/${today()}` : lastDay.current);
      if (!parent) {
        history.back(); // top page: keep going back until the app is left
        return;
      }
      if (st.lbBase) pushGuard(parent);
      navigate(parent, { replace: true });
    };
    setBackHandler(onPop);
    return () => setBackHandler(null);
  }, [navigate]);
}

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
          silenceNextPop();
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
