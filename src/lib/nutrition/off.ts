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
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/** Native barcode scanning (Chrome on Android); null when the browser has no BarcodeDetector. */
export function barcodeDetector(): Detector | null {
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  return BD ? new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }) : null;
}
