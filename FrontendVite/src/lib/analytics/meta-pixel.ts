/**
 * Meta (Facebook) Pixel — loaded ONLY on the signup/conversion funnel (trial onboarding, checkout
 * result), never app-wide. This is a B2B ERP: most traffic is existing paying customers doing daily
 * work (payroll, CRM, inventory...), and pixel-tracking that for ad attribution is both wasteful and
 * a real privacy problem. Scoping the load to just the pages where a new visitor is actually
 * converting keeps this to its actual purpose — measuring the marketing funnel.
 *
 * No <noscript> fallback: this is a client-side-rendered SPA, so a visitor with JavaScript disabled
 * never renders the app (or this code) in the first place — the noscript pixel tag Meta's own
 * snippet suggests has no one to fire for here.
 *
 * Injected as the literal vanilla-JS snippet Meta issues (verbatim, not transliterated into
 * TypeScript) — that keeps it exactly what Meta's own docs/support expect, rather than a
 * hand-translated version that could silently drift from their IIFE's actual behaviour.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = "2956413208034575";

let loaded = false;

/** Idempotent — safe to call from every page that needs it; only injects the script once. */
export function loadMetaPixel(): void {
  if (loaded || typeof window === "undefined") return;
  if (window.fbq) { loaded = true; return; } // another mount already loaded it

  try {
    const script = document.createElement("script");
    script.textContent = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${PIXEL_ID}');
    `;
    document.head.appendChild(script);
    loaded = true;
  } catch {
    // An ad-blocker or CSP rule killing this must never break the signup flow itself.
  }
}

/** No-ops safely if the pixel never loaded (blocked, or called before loadMetaPixel). */
export function trackPixelEvent(event: string, params?: Record<string, unknown>): void {
  try {
    window.fbq?.("track", event, params);
  } catch {
    /* never let analytics break the app */
  }
}
