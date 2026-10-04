// The installed app (PWA) only looks for a new version when it is opened from scratch.
// On a phone it usually stays in the background for days, so look again every time it
// comes back to the screen, and once an hour while it is open.

declare const __BUILD_TIME__: string;

/** When this version was built (shown in Impostazioni). */
export const BUILD_TIME = new Date(__BUILD_TIME__);

let reg: ServiceWorkerRegistration | undefined;

export function watchForUpdates(r: ServiceWorkerRegistration | undefined) {
  if (!r) return;
  reg = r;
  const check = () => r.update().catch(() => undefined);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.setInterval(check, 60 * 60 * 1000);
}

/** Look for a new version now: true when one is being installed (the app then reloads by itself). */
export async function checkForUpdate(): Promise<boolean> {
  if (!reg) return false;
  await reg.update();
  return !!(reg.installing || reg.waiting);
}
