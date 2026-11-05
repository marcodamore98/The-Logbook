import { useEffect, useRef, useState } from 'react';
import type { ISODate } from '../lib/types';

/**
 * Choosing several days at once on a calendar, as on Google Calendar: hold a day (or press the
 * mouse on it) and drag over the others; on release `onPick(from, to)` is called. A tap or a
 * click alone does nothing here, so the days keep their own action. Elements carry `data-date`.
 */
export function useRangeSelect<T extends HTMLElement>(onPick: (from: ISODate, to: ISODate) => void) {
  const ref = useRef<T>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [range, setRange] = useState<[ISODate, ISODate] | null>(null);
  const lastPick = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    let anchor: ISODate | null = null;
    let cur: ISODate | null = null;
    let active = false;
    let sx = 0;
    let sy = 0;
    const dateAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-date]')?.getAttribute('data-date') ?? null;
    const show = () => anchor && cur && setRange(anchor <= cur ? [anchor, cur] : [cur, anchor]);
    const begin = (x: number, y: number, target: EventTarget | null) => {
      const d = (target as HTMLElement | null)?.closest?.('[data-date]')?.getAttribute('data-date');
      if (!d) return false;
      anchor = cur = d;
      sx = x;
      sy = y;
      return true;
    };
    const activate = () => {
      active = true;
      navigator.vibrate?.(15);
      show();
    };
    const finish = () => {
      window.clearTimeout(timer);
      if (active && anchor && cur) {
        lastPick.current = Date.now();
        const [a, b] = anchor <= cur ? [anchor, cur] : [cur, anchor];
        pick.current(a, b);
      }
      active = false;
      anchor = cur = null;
      setRange(null);
    };

    // Touch: hold still for a moment, then drag (the page does not scroll or swipe meanwhile).
    const ts = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!begin(t.clientX, t.clientY, e.target)) return;
      timer = window.setTimeout(activate, 380);
    };
    const tm = (e: TouchEvent) => {
      if (!anchor) return;
      const t = e.touches[0];
      if (!active) {
        if (Math.hypot(t.clientX - sx, t.clientY - sy) > 8) {
          window.clearTimeout(timer);
          anchor = null;
        }
        return;
      }
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      const d = dateAt(t.clientX, t.clientY);
      if (d && d !== cur) {
        cur = d;
        show();
      }
    };
    const te = (e: TouchEvent) => {
      if (active) e.stopPropagation();
      finish();
    };
    // Mouse: press on a day and drag over the others.
    const md = (e: MouseEvent) => {
      if (e.button === 0) begin(e.clientX, e.clientY, e.target);
    };
    const mm = (e: MouseEvent) => {
      if (!anchor) return;
      if (!(e.buttons & 1)) return finish();
      const d = dateAt(e.clientX, e.clientY);
      if (!d) return;
      if (!active && d !== anchor) active = true;
      if (active && d !== cur) {
        e.preventDefault();
        cur = d;
        show();
      }
    };
    const mu = () => anchor && finish();
    // The long press must not open the phone's menu for links.
    const ctx = (e: Event) => (anchor || Date.now() - lastPick.current < 800) && e.preventDefault();

    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te);
    el.addEventListener('touchcancel', te);
    el.addEventListener('mousedown', md);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    el.addEventListener('contextmenu', ctx);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener('touchstart', ts);
      el.removeEventListener('touchmove', tm);
      el.removeEventListener('touchend', te);
      el.removeEventListener('touchcancel', te);
      el.removeEventListener('mousedown', md);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      el.removeEventListener('contextmenu', ctx);
    };
  }, []);

  return {
    ref,
    /** The day is inside the days being chosen. */
    inRange: (d: ISODate) => !!range && d >= range[0] && d <= range[1],
    /** True right after a choice: the click that follows must not open the day. */
    justPicked: () => Date.now() - lastPick.current < 700,
  };
}
