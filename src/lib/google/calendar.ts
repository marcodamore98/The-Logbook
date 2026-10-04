// Minimal Google Calendar v3 client using Google Identity Services (token model).
// The access token (valid ~1h) is kept in localStorage so reopening the app keeps
// the connection; once expired it is re-requested
// silently when it expires, as long as the user granted consent once.

import { GOOGLE_CLIENT_ID } from '../config';
import { addDays, localDateTime, TIME_ZONE } from '../dates';
import type { ISODate } from '../types';

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
const API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_KEY = 'logbook.gcal.token';

export const gcalConfigured = Boolean(CLIENT_ID);

export interface GEvent {
  id: string;
  calendarId: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
  colorId?: string;
  htmlLink?: string;
  /** Google Meet link, when the event has one. */
  hangoutLink?: string;
}

export interface GCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken(o?: { prompt?: string }): void;
  callback: (r: TokenResponse) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: unknown) => void }): TokenClient;
          revoke(token: string, cb?: () => void): void;
        };
      };
    };
  }
}

let token: { value: string; exp: number } | null = (() => {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

let client: TokenClient | null = null;
let gisLoading: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Impossibile caricare Google Identity Services'));
    document.head.appendChild(s);
  });
  return gisLoading;
}

export function hasToken(): boolean {
  return !!token && token.exp > Date.now() + 60_000;
}

/** interactive=false only reuses a valid token; interactive=true opens the Google popup (must follow a click). */
export async function authorize(interactive: boolean): Promise<boolean> {
  if (!CLIENT_ID) return false;
  if (hasToken()) return true;
  // A token popup opened outside a click is blocked by browsers: only ask on user action.
  if (!interactive) return false;
  await loadGis();
  return new Promise((resolve) => {
    const done = (r: TokenResponse) => {
      if (r.access_token) {
        token = { value: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 };
        try {
          localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
        } catch {
          /* private mode */
        }
        resolve(true);
      } else resolve(false);
    };
    client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: done,
      error_callback: () => resolve(false),
    });
    // '' = show the consent screen only the first time, then just a quick account popup.
    client.requestAccessToken({ prompt: '' });
  });
}

export function disconnect(): void {
  if (token && window.google) window.google.accounts.oauth2.revoke(token.value);
  token = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!hasToken() && !(await authorize(false))) throw new Error('Google Calendar non autorizzato');
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${token!.value}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 401) {
    token = null;
    throw new Error('Sessione Google scaduta');
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const enc = encodeURIComponent;

export async function listCalendars(): Promise<GCalendar[]> {
  const r = await api<{ items: GCalendar[] }>('/users/me/calendarList?minAccessRole=reader');
  return r.items;
}

/** Events touching [from, to] (inclusive dates), recurring events expanded. */
export async function listEvents(calendarId: string, from: ISODate, to: ISODate): Promise<GEvent[]> {
  const out: GEvent[] = [];
  let pageToken: string | undefined;
  const timeMin = new Date(`${from}T00:00:00`).toISOString();
  const timeMax = new Date(`${addDays(to, 1)}T00:00:00`).toISOString();
  do {
    const q = `?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${enc(timeMin)}&timeMax=${enc(timeMax)}${pageToken ? `&pageToken=${enc(pageToken)}` : ''}`;
    const r = await api<{ items: GEvent[]; nextPageToken?: string }>(`/calendars/${enc(calendarId)}/events${q}`);
    out.push(...r.items.filter((e) => e.status !== 'cancelled').map((e) => ({ ...e, calendarId })));
    pageToken = r.nextPageToken;
  } while (pageToken);
  return out;
}

export interface EventInput {
  summary: string;
  description?: string;
  location?: string;
  date: ISODate;
  start?: string; // HH:MM; omitted = all-day
  end?: string;
  endDate?: ISODate; // timed: for overnight events; all-day: last day of a multi-day event
  kind: string;
  colorId?: string;
  /** Popup reminders, minutes before the start. */
  reminders?: number[];
}

function toBody(e: EventInput) {
  const timed = e.start && e.end;
  return {
    summary: e.summary,
    description: e.description,
    location: e.location,
    colorId: e.colorId,
    start: timed ? { dateTime: localDateTime(e.date, e.start!), timeZone: TIME_ZONE } : { date: e.date },
    end: timed
      ? { dateTime: localDateTime(e.endDate ?? e.date, e.end!), timeZone: TIME_ZONE }
      : { date: addDays(e.endDate ?? e.date, 1) },
    extendedProperties: { private: { logbook: '1', lbKind: e.kind, lbDate: e.date } },
    ...(e.reminders ? { reminders: { useDefault: !e.reminders.length, overrides: e.reminders.map((minutes) => ({ method: 'popup', minutes })) } } : {}),
  };
}

export async function upsertEvent(calendarId: string, id: string | undefined, e: EventInput): Promise<string> {
  const body = JSON.stringify(toBody(e));
  if (id) {
    try {
      const r = await api<GEvent>(`/calendars/${enc(calendarId)}/events/${enc(id)}`, { method: 'PATCH', body });
      if (r.status !== 'cancelled') return r.id;
    } catch (err) {
      if (!String(err).includes(' 404') && !String(err).includes(' 410')) throw err;
    }
  }
  const r = await api<GEvent>(`/calendars/${enc(calendarId)}/events`, { method: 'POST', body });
  return r.id;
}

/** One event by id, also when deleted (status "cancelled"); null when Google no longer knows it. */
export async function getEvent(calendarId: string, id: string): Promise<GEvent | null> {
  try {
    const e = await api<GEvent>(`/calendars/${enc(calendarId)}/events/${enc(id)}`);
    return { ...e, calendarId };
  } catch (err) {
    if (String(err).includes(' 404') || String(err).includes(' 410')) return null;
    throw err;
  }
}

export async function deleteEvent(calendarId: string, id: string): Promise<void> {
  try {
    await api<void>(`/calendars/${enc(calendarId)}/events/${enc(id)}`, { method: 'DELETE' });
  } catch (err) {
    if (!String(err).includes(' 404') && !String(err).includes(' 410')) throw err;
  }
}

/** Local date (YYYY-MM-DD) and HH:MM of an event boundary. */
export function eventLocal(b: GEvent['start']): { date: ISODate; time?: string } {
  if (b.date) return { date: b.date };
  const d = new Date(b.dateTime!);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
