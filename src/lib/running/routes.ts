import { haversine, pathLength } from './geo';

export interface SuggestedRoute {
  id: string;
  name: string;
  kind: 'route' | 'track' | 'park';
  /** Distance from the user to the start / nearest point (m). */
  away: number;
  lengthM?: number;
  start: [number, number];
  /** Path to draw (routes only). */
  geometry?: [number, number][];
  ref?: string;
}

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function overpass(query: string): Promise<any> {
  let err: unknown;
  for (const url of ENDPOINTS) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20000);
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
      clearTimeout(t);
      if (res.ok) return await res.json();
      err = new Error(`Overpass ${res.status}`);
    } catch (e) {
      err = e;
    }
  }
  throw err;
}

/** Chains the ways of a relation into one drawable path (good enough for loops and trails). */
function chain(members: any[]): [number, number][] {
  const ways = members.filter((m) => m.type === 'way' && m.geometry?.length).map((m) => m.geometry.map((p: any) => [p.lat, p.lon] as [number, number]));
  if (!ways.length) return [];
  const path = [...ways.shift()!];
  while (ways.length) {
    const end = path[path.length - 1];
    let best = 0;
    let bestD = Infinity;
    let rev = false;
    ways.forEach((w, i) => {
      const d1 = haversine(end, w[0]);
      const d2 = haversine(end, w[w.length - 1]);
      if (d1 < bestD) { bestD = d1; best = i; rev = false; }
      if (d2 < bestD) { bestD = d2; best = i; rev = true; }
    });
    const w = ways.splice(best, 1)[0];
    path.push(...(rev ? [...w].reverse() : w));
  }
  return path;
}

/** Running routes, athletics tracks and parks around a point, nearest first. */
export async function suggestRoutes(lat: number, lon: number, radius = 6000): Promise<SuggestedRoute[]> {
  const q = `[out:json][timeout:25];(
    relation["route"~"^(running|fitness_trail|foot|hiking)$"](around:${radius},${lat},${lon});
    way["leisure"="track"]["sport"~"running|athletics"](around:${radius},${lat},${lon});
    way["leisure"="park"]["name"](around:${Math.round(radius * 0.7)},${lat},${lon});
    relation["leisure"="park"]["name"](around:${Math.round(radius * 0.7)},${lat},${lon});
  );out geom 60;`;
  const data = await overpass(q);
  const me: [number, number] = [lat, lon];
  const out: SuggestedRoute[] = [];
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    if (el.type === 'relation' && tags.route) {
      const geometry = chain(el.members ?? []);
      if (geometry.length < 2) continue;
      const lengthM = pathLength(geometry);
      if (lengthM < 800 || lengthM > 45000) continue;
      out.push({ id: `r${el.id}`, name: tags.name ?? tags.ref ?? 'Percorso senza nome', kind: 'route', away: haversine(me, geometry[0]), lengthM, start: geometry[0], geometry, ref: tags.ref });
      continue;
    }
    const geom: [number, number][] | undefined = el.geometry?.map((p: any) => [p.lat, p.lon]) ?? el.members?.flatMap((m: any) => m.geometry?.map((p: any) => [p.lat, p.lon]) ?? []);
    if (!geom?.length) continue;
    const near = geom.reduce((b, p) => (haversine(me, p) < haversine(me, b) ? p : b), geom[0]);
    if (tags.leisure === 'track') out.push({ id: `t${el.id}`, name: tags.name ?? 'Pista di atletica', kind: 'track', away: haversine(me, near), lengthM: 400, start: near, geometry: geom });
    else if (tags.leisure === 'park') out.push({ id: `p${el.id}`, name: tags.name, kind: 'park', away: haversine(me, near), start: near });
  }
  const seen = new Set<string>();
  return out
    .filter((r) => (seen.has(r.kind + r.name) ? false : (seen.add(r.kind + r.name), true)))
    .sort((a, b) => a.away - b.away)
    .slice(0, 40);
}
