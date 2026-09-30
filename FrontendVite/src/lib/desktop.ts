/**
 * Where the API lives.
 *
 * On the desktop client this is whatever server the site was pointed at — chosen on the installer's
 * "Server address" page and changeable afterwards from the tray. On the web build it is the value
 * baked in at build time, which is correct there because the bundle is served by the gateway it
 * talks to.
 *
 * ⚠️ `getApiBaseUrl()` MUST stay synchronous. Roughly ninety API modules do
 *
 *     const BASE = `${getApiBaseUrl()}/api/hr`;
 *
 * at module scope, which runs the instant the module is imported. That used to read
 * `import.meta.env.VITE_API_URL`, a *build-time* substitution, so every desktop install had
 * `http://localhost:5000` compiled into it and no amount of configuration could change it — the app
 * only ever reached a server when one happened to be running on the same machine. Preload resolves
 * the address over synchronous IPC before any page script runs, so the value is already here by the
 * time those constants evaluate. Make this async and the bug returns silently.
 */

interface VroduxDesktop {
  /** Already resolved by preload — synchronous by necessity (see above). */
  apiUrl: string;
  getApiUrl: () => Promise<string>;
  setApiUrl: (url: string) => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  isDesktop: boolean;
  onShowServerPrompt: (cb: (currentUrl: string) => void) => void;
}

declare global {
  interface Window {
    vroduxDesktop?: VroduxDesktop;
  }
}

export const isDesktop = !!window.vroduxDesktop?.isDesktop;

/** Web builds keep the previous behaviour exactly — the bundle is served by its own gateway. */
const WEB_FALLBACK =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000";

export function getApiBaseUrl(): string {
  return window.vroduxDesktop?.apiUrl || WEB_FALLBACK;
}

/**
 * Kept for the few callers that await it during start-up. Nothing depends on it any more for
 * correctness — preload has already supplied the address — so it is now just an accessor.
 */
export async function getDesktopApiUrl(): Promise<string> {
  return getApiBaseUrl();
}

export async function initDesktopApiUrl(): Promise<void> {
  /* No-op: preload resolves the address before the bundle loads. Retained so main.tsx's
     start-up sequence does not have to change, and so a future async step has a home. */
}
