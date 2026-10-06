/**
 * Back button by hierarchy instead of by history: the app keeps only two browser history entries
 * (a "base" one and the current page), so Android back never walks through earlier clicks.
 * Every in-app navigation replaces the current entry; pressing back lands on the base entry and
 * useHierarchicalBack (App.tsx) sends the user to the parent page (workout → Palestra → day page),
 * or leaves the app from today's page. Sheets and drawers still close first (useBackClosesOverlays).
 */
const nativePush = history.pushState.bind(history);
const nativeReplace = history.replaceState.bind(history);

type Flags = { lbBase?: boolean; lbGuard?: boolean; overlay?: boolean };
/** The router's own entries carry an `idx`; our markers and the overlay flag must survive its replaces. */
const isRouterState = (s: unknown): s is Record<string, unknown> => !!s && typeof s === 'object' && 'idx' in s;
const keepFlags = (): Flags => {
  const s = (history.state ?? {}) as Flags;
  return { ...(s.lbBase ? { lbBase: true } : {}), ...(s.lbGuard ? { lbGuard: true } : {}), ...(s.overlay ? { overlay: true } : {}) };
};

/** Set by useHierarchicalBack: decides what back does. Registered before the router so it always runs first. */
let onBack: ((e: PopStateEvent) => void) | null = null;
export const setBackHandler = (fn: ((e: PopStateEvent) => void) | null) => {
  onBack = fn;
};

let installed = false;
export function installBackNav() {
  if (installed) return;
  installed = true;
  window.addEventListener('popstate', (e) => onBack?.(e), true);
  history.pushState = (state: unknown, unused: string, url?: string | URL | null) =>
    isRouterState(state) ? nativeReplace({ ...state, ...keepFlags() }, unused, url) : nativePush(state, unused, url);
  history.replaceState = (state: unknown, unused: string, url?: string | URL | null) =>
    nativeReplace(isRouterState(state) ? { ...state, ...keepFlags() } : state, unused, url);
  nativeReplace({ ...(history.state ?? {}), lbBase: true, lbGuard: false }, '');
  nativePush({ ...(history.state ?? {}), lbBase: false, lbGuard: true }, '');
}

/** Puts the page entry back on top of the base one (after back landed on the base). */
export function pushGuard(hashPath: string) {
  nativePush({ lbGuard: true }, '', `#${hashPath}`);
}

/** A history step the app makes by itself (dropping the entry of a sheet closed by hand): not a back press. */
let silent = 0;
export const silenceNextPop = () => {
  silent++;
};
export const consumeSilentPop = () => (silent > 0 ? (silent--, true) : false);
