import { useEffect, useRef } from 'react';
import { today } from '../lib/dates';
import { chime } from '../lib/sound';
import { useStore } from '../lib/store/StoreContext';
import type { CourseModule } from '../lib/types';

const LEADS = [30, 5];

async function notify(title: string, body: string) {
  chime();
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    // On Android only the service worker can show notifications.
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag: title, icon: `${import.meta.env.BASE_URL}icon.svg` });
    else new Notification(title, { body });
  } catch {
    /* notifications not available */
  }
}

/**
 * While the app is open, warns 30 and 5 minutes before a course/congress/webinar that has
 * "Avvisami" on. With the app closed the reminder comes from Google Calendar (same times).
 */
export function useCourseReminders() {
  const store = useStore();
  const live = useRef(store);
  live.current = store;

  useEffect(() => {
    const check = () => {
      const d = today();
      const list: CourseModule[] = [...live.current.allDays, live.current.day(d)]
        .flatMap((x) => x.modules)
        .filter((m): m is CourseModule => m.kind === 'course' && !!m.remind && !!m.startTime && m.startDate === d);
      const now = Date.now();
      for (const m of list) {
        const start = new Date(`${d}T${m.startTime}:00`).getTime();
        for (const lead of LEADS) {
          const at = start - lead * 60_000;
          const key = `remind:${m.id}:${d}:${lead}`;
          if (now >= at && now - at < 3 * 60_000 && !localStorage.getItem(key)) {
            localStorage.setItem(key, '1');
            notify(`${m.title || 'Corso'} tra ${lead} minuti`, `Inizia alle ${m.startTime}`);
          }
        }
      }
    };
    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, []);
}
