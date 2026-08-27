import * as React from "react";

/**
 * `React.lazy`, but survives a deploy happening while the app is open.
 *
 * Vite gives every chunk a content hash, and a deploy replaces `assets/` wholesale. A tab that
 * loaded the previous `index.html` still holds references to the OLD hashed filenames, so the
 * moment the user navigates to a route whose chunk has been replaced the import 404s and React
 * unmounts the tree — a white screen reading "Failed to fetch dynamically imported module", with
 * no hint that a plain reload fixes it.
 *
 * `index.html` is served `no-store`, so one reload is genuinely enough: it fetches the new document
 * and, with it, the new chunk names.
 *
 * The guard matters as much as the reload. If a chunk is missing for any other reason — a partial
 * deploy, a broken CDN path, an offline device — reloading unconditionally would spin forever. So a
 * reload is attempted at most once in a short window; after that the error is allowed through to
 * the error boundary, where it is at least visible and reportable.
 */
const RELOAD_MARKER = "vrodux:chunk-reload-at";
const RELOAD_WINDOW_MS = 20_000;

export function lazyWithRetry<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      const mod = await factory();
      // Loaded cleanly, so a future deploy is allowed its own reload.
      try { sessionStorage.removeItem(RELOAD_MARKER); } catch { /* private mode */ }
      return mod;
    } catch (error) {
      let recentlyReloaded = false;
      try {
        const at = Number(sessionStorage.getItem(RELOAD_MARKER) ?? 0);
        recentlyReloaded = Number.isFinite(at) && Date.now() - at < RELOAD_WINDOW_MS;
        if (!recentlyReloaded) sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
      } catch {
        // sessionStorage can throw outright (some privacy modes). Without somewhere to record the
        // attempt there is no safe way to reload, so fall through and surface the error instead.
        throw error;
      }

      if (recentlyReloaded) throw error;

      window.location.reload();
      // Unreachable in practice — reload() tears the page down — but React needs something back.
      return await new Promise<{ default: T }>(() => {});
    }
  });
}
