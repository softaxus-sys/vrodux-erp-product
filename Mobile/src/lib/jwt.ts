/**
 * Minimal JWT payload decode -- no verification (the server already signed
 * and verified it; the client only ever reads claims to drive UI state).
 * Mirrors FrontendVite's `decodeJwtPayload`. Hermes (RN's JS engine since
 * 0.74) exposes `atob`/`btoa` globally, same as a browser.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return {};
  }
}
