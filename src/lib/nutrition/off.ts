// Open Food Facts: free, open database of packaged foods (no API key).
// https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/

import type { Food } from '../types';

const FIELDS = 'code,product_name,product_name_it,brands,nutriments,serving_quantity,serving_size';

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_it?: string;
  brands?: string;
  serving_quantity?: number | string;
  serving_size?: string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return isNaN(n) ? undefined : n;
};

function toFood(p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) !== undefined ? num(n['energy_100g'])! / 4.184 : undefined);
  const name = (p.product_name_it || p.product_name || '').trim();
  if (!name || kcal === undefined) return null;
  const portion = num(p.serving_quantity);
  return {
    id: `off-${p.code}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    kcal: Math.round(kcal),
    protein: num(n['proteins_100g']) ?? 0,
    carbs: num(n['carbohydrates_100g']) ?? 0,
    fat: num(n['fat_100g']) ?? 0,
    fiber: num(n['fiber_100g']),
    sugar: num(n['sugars_100g']),
    portionG: portion && portion > 0 ? portion : undefined,
    portionName: p.serving_size || undefined,
    barcode: p.code,
    source: 'off',
  };
}

export async function searchOff(query: string, signal?: AbortSignal): Promise<Food[]> {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=25&lc=it&fields=${FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open Food Facts non disponibile (${res.status})`);
  const data = (await res.json()) as { products?: OffProduct[] };
  return (data.products ?? []).map(toFood).filter((f): f is Food => !!f);
}

export async function productByBarcode(code: string): Promise<Food | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts non disponibile (${res.status})`);
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  return data.status === 1 && data.product ? toFood({ ...data.product, code }) : null;
}

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string; format?: string }[]>;
}

/** Native barcode scanning (Chrome on Android); null when the browser has no BarcodeDetector. */
export function barcodeDetector(): Detector | null {
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  return BD ? new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }) : null;
}

/** Check digit of EAN-13 / EAN-8 / UPC-A: a code misread from a blurred frame almost always fails it. */
export function validBarcode(code: string, format?: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  if (format === 'upc_e') return code.length >= 6 && code.length <= 8; // its check digit needs the expanded code: three equal reads decide
  if (![8, 12, 13].includes(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

type FocusCaps = MediaTrackCapabilities & { focusMode?: string[]; torch?: boolean; zoom?: { min: number; max: number } };

/**
 * The back camera that can focus close. On phones with several back lenses (Samsung)
 * "environment" may open the ultra-wide one, which has a fixed focus and blurs labels.
 */
export async function openBackCamera(): Promise<MediaStream> {
  const want = { width: { ideal: 1920 }, height: { ideal: 1080 } };
  let stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, ...want } });
  const focusable = (s: MediaStream) => ((s.getVideoTracks()[0]?.getCapabilities?.() as FocusCaps | undefined)?.focusMode ?? []).includes('continuous');
  if (!focusable(stream)) {
    // Labels are known now that the permission is granted: try the other back cameras.
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput' && /back|rear|environment|posteriore/i.test(d.label));
    const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
    for (const c of cams) {
      if (c.deviceId === current) continue;
      stream.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: c.deviceId }, ...want } });
      if (focusable(stream)) break;
    }
  }
  await setFocus(stream, 'continuous');
  return stream;
}

/** Continuous autofocus, or one refocus ("single-shot") when the preview is tapped. */
export async function setFocus(stream: MediaStream, mode: 'continuous' | 'single-shot') {
  const track = stream.getVideoTracks()[0];
  const caps = track?.getCapabilities?.() as FocusCaps | undefined;
  if (!track || !caps?.focusMode?.includes(mode)) return;
  await track.applyConstraints({ advanced: [{ focusMode: mode } as MediaTrackConstraintSet] }).catch(() => undefined);
}

export function hasTorch(stream: MediaStream): boolean {
  return !!(stream.getVideoTracks()[0]?.getCapabilities?.() as FocusCaps | undefined)?.torch;
}

export async function setTorch(stream: MediaStream, on: boolean) {
  await stream.getVideoTracks()[0]?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => undefined);
}
