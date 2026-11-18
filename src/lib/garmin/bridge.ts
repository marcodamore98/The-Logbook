// The bridge: a tiny Cloudflare Worker (free) that passes the app's requests on to Garmin, because
// Garmin does not answer web pages directly. It keeps nothing (no key, no data), answers only this
// app's address, lets through only reads plus the token exchange, and only towards Garmin.

import { TOKEN_PATH } from './client';

export function bridgeCode(origin: string): string {
  return `// Ponte tra The Logbook e Garmin Connect (Personal API).
// Passa le richieste a Garmin e non salva nulla: né la chiave né i dati.
const GARMIN = 'https://personal.connectapi.garmin.com';
const APP = ${JSON.stringify(origin)};
const TOKEN = ${JSON.stringify(TOKEN_PATH)};

export default {
  async fetch(req) {
    const origin = req.headers.get('Origin');
    if (origin !== APP) return new Response('Origine non consentita', { status: 403 });
    const cors = {
      'Access-Control-Allow-Origin': APP,
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Authorization, Accept',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    const ok = req.method === 'GET' || (req.method === 'POST' && url.pathname === TOKEN);
    if (!ok) return new Response('Richiesta non consentita', { status: 405, headers: cors });
    const res = await fetch(GARMIN + url.pathname + url.search, {
      method: req.method,
      headers: {
        Accept: req.headers.get('Accept') || 'application/json',
        Authorization: req.headers.get('Authorization') || '',
      },
    });
    return new Response(res.body, {
      status: res.status,
      headers: { ...cors, 'Content-Type': res.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' },
    });
  },
};
`;
}
