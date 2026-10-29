import { isDesktop } from "@/lib/desktop";
import { setStoreApiOrigin, shopApi } from "./shop.api";

/**
 * A store can have its own address (shop.example.com, or {name}.<store domain>). Such a browser is not looking for the ERP at all,
 * so before the app starts we ask whether this address belongs to a store, and if it does the store is the whole site.
 *
 * The ERP's own addresses are listed in VITE_APP_HOSTS so they never cost a lookup. Anything else is asked once; an unknown
 * address simply falls through to the normal app.
 */
const APP_HOSTS = (import.meta.env.VITE_APP_HOSTS ?? "localhost,127.0.0.1,erp.vrodux.com")
  .split(",").map((h: string) => h.trim().toLowerCase()).filter(Boolean);

const isIp = (h: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":");

export async function resolveStoreHost(): Promise<string | null> {
  if (isDesktop) return null;
  const host = window.location.hostname.toLowerCase();
  if (!host || isIp(host) || APP_HOSTS.includes(host)) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const r = await shopApi.resolveHost(host);
    clearTimeout(timer);
    if (r?.slug) setStoreApiOrigin(window.location.origin);
    return r?.slug ?? null;
  } catch { return null; }   // the lookup failing must never stop the ERP from opening
}
