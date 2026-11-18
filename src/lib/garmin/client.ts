// Garmin Connect "Personal API": the user's own data, read-only. The personal key (created on
// connect.garmin.com → Impostazioni → Personal API Key) is traded for a token that lasts 24 hours.
// Garmin does not answer web pages directly (no CORS), so every call goes through the user's small
// bridge on Cloudflare (see bridge.ts), which only forwards the request and keeps nothing.
//
// The key stays on this phone only (localStorage), never in the cloud.

import { useSyncExternalStore } from 'react';
import type { ISODate } from '../types';

export const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';
const CFG_KEY = 'logbook.garmin';

export interface GarminConfig {
  key: string;
  /** Address of the bridge, e.g. https://logbook-garmin.nome.workers.dev */
  bridge: string;
  token?: string;
  tokenExp?: number; // ms
  /** Last day read completely (the next sync starts the day before). */
  lastDay?: ISODate;
  lastSync?: number;
  /** Garmin activities already brought in: never again, even if deleted from the app. */
  seen?: string[];
}

export function readConfig(): GarminConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    const c = raw ? (JSON.parse(raw) as GarminConfig) : null;
    return c?.key && c.bridge ? c : null;
  } catch {
    return null;
  }
}

export function writeConfig(c: GarminConfig | null) {
  try {
    if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c));
    else localStorage.removeItem(CFG_KEY);
  } catch {
    /* private window: nothing kept */
  }
  setState({ configured: !!c, lastSync: c?.lastSync });
}

/** "logbook-garmin.nome.workers.dev/" → "https://logbook-garmin.nome.workers.dev" */
export function normalizeBridge(s: string): string {
  let u = s.trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

// ---- state shown in Settings and in the Riepilogo ----

export interface GarminState {
  configured: boolean;
  syncing: boolean;
  error?: string;
  lastSync?: number;
  /** What the last sync brought: days updated and runs added. */
  last?: { days: number; runs: number };
}

let state: GarminState = { configured: !!readConfig(), syncing: false, lastSync: readConfig()?.lastSync };
const subs = new Set<() => void>();
export function setState(p: Partial<GarminState>) {
  state = { ...state, ...p };
  subs.forEach((f) => f());
}
export function useGarmin(): GarminState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}

// ---- calls ----

export class GarminError extends Error {
  constructor(
    message: string,
    public status = 0,
    /** The whole sync stops (key refused, bridge unreachable, too many requests). */
    public fatal = false,
  ) {
    super(message);
  }
}

function jwtExp(token: string): number {
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4))) as { exp?: number };
    return json.exp ? json.exp * 1000 : Date.now() + 20 * 3600e3;
  } catch {
    return Date.now() + 20 * 3600e3;
  }
}

async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store' });
  } catch {
    throw new GarminError('Il ponte non risponde: controlla l’indirizzo in Impostazioni e la connessione.', 0, true);
  }
}

/** The 24-hour token, asked again when it has less than an hour left. */
export async function getToken(cfg: GarminConfig, force = false): Promise<string> {
  if (!force && cfg.token && (cfg.tokenExp ?? 0) - Date.now() > 3600e3) return cfg.token;
  const r = await call(`${cfg.bridge}${TOKEN_PATH}`, { method: 'POST', headers: { Accept: '*/*', Authorization: `ApiKey ${cfg.key.trim()}` } });
  if (r.status === 401 || r.status === 403) {
    const why = await r.text().catch(() => '');
    if (/origine non consentita/i.test(why)) throw new GarminError('Il ponte non accetta questa app: ricopia il codice del ponte da Impostazioni.', r.status, true);
    throw new GarminError('Garmin non accetta la chiave: forse è scaduta o è stata copiata male. Creane una nuova su Garmin Connect.', r.status, true);
  }
  if (!r.ok) throw new GarminError(`Garmin non risponde (errore ${r.status}). Riprova più tardi.`, r.status, true);
  const token = (await r.text()).trim();
  if (!token.includes('.')) throw new GarminError('Risposta inattesa dal ponte: controlla l’indirizzo.', 0, true);
  cfg.token = token;
  cfg.tokenExp = jwtExp(token);
  writeConfig(cfg);
  return token;
}

/** GET a Personal API path; null when Garmin has nothing for it (404, empty). */
export async function garminGet<T = unknown>(cfg: GarminConfig, path: string, params?: Record<string, string | number>): Promise<T | null> {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : '';
  const go = async (force: boolean) => {
    const token = await getToken(cfg, force);
    return call(`${cfg.bridge}${path}${qs}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  };
  let r = await go(false);
  if (r.status === 401) r = await go(true);
  if (r.status === 404 || r.status === 204) return null;
  if (r.status === 429) throw new GarminError('Troppe richieste a Garmin: riprova tra qualche minuto.', 429, true);
  if (!r.ok) throw new GarminError(`Garmin non risponde (errore ${r.status}).`, r.status);
  const text = await r.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
