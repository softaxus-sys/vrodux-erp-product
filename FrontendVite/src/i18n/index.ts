// ─────────────────────────────────────────────────────────────────────────────
// i18n bootstrap — initialize i18next + react-i18next once, on app start.
//
// Import for side effect from the app entry (main.tsx): `import "@/i18n";`
// Resources are bundled per (language × namespace). Adding a namespace = add its
// JSON under locales/<lng>/<ns>.json and register it in `resources` below.
// ─────────────────────────────────────────────────────────────────────────────

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import {
  SUPPORTED_CODES,
  DEFAULT_LANGUAGE,
  getDir,
  getLanguage,
} from "./languages";

// ── English (base / fallback) ────────────────────────────────────────────────
import enCommon    from "./locales/en/common.json";
import enNav       from "./locales/en/nav.json";
import enAuth      from "./locales/en/auth.json";
import enTopbar    from "./locales/en/topbar.json";
import enDashboard from "./locales/en/dashboard.json";
import enFinance   from "./locales/en/finance.json";
import enCrm       from "./locales/en/crm.json";
import enHr        from "./locales/en/hr.json";
import enInventory from "./locales/en/inventory.json";
import enSales     from "./locales/en/sales.json";
import enPurchase  from "./locales/en/purchase.json";
import enVisa      from "./locales/en/visa.json";
import enRestaurant from "./locales/en/restaurant.json";
import enSettings  from "./locales/en/settings.json";
import enOnboarding from "./locales/en/onboarding.json";

// ── Arabic ───────────────────────────────────────────────────────────────────
import arCommon    from "./locales/ar/common.json";
import arNav       from "./locales/ar/nav.json";
import arAuth      from "./locales/ar/auth.json";
import arTopbar    from "./locales/ar/topbar.json";
import arDashboard from "./locales/ar/dashboard.json";
import arFinance   from "./locales/ar/finance.json";
import arCrm       from "./locales/ar/crm.json";
import arHr        from "./locales/ar/hr.json";
import arInventory from "./locales/ar/inventory.json";
import arSales     from "./locales/ar/sales.json";
import arPurchase  from "./locales/ar/purchase.json";
import arVisa      from "./locales/ar/visa.json";
import arRestaurant from "./locales/ar/restaurant.json";
import arSettings  from "./locales/ar/settings.json";
import arOnboarding from "./locales/ar/onboarding.json";

export const NAMESPACES = ["common", "nav", "auth", "topbar", "dashboard", "finance", "crm", "hr", "inventory", "sales", "purchase", "visa", "restaurant", "settings", "onboarding"] as const;

const resources = {
  en: { common: enCommon, nav: enNav, auth: enAuth, topbar: enTopbar, dashboard: enDashboard, finance: enFinance, crm: enCrm, hr: enHr, inventory: enInventory, sales: enSales, purchase: enPurchase, visa: enVisa, restaurant: enRestaurant, settings: enSettings, onboarding: enOnboarding },
  ar: { common: arCommon, nav: arNav, auth: arAuth, topbar: arTopbar, dashboard: arDashboard, finance: arFinance, crm: arCrm, hr: arHr, inventory: arInventory, sales: arSales, purchase: arPurchase, visa: arVisa, restaurant: arRestaurant, settings: arSettings, onboarding: arOnboarding },
} as const;

/** localStorage key holding the user's chosen UI language. */
export const LANG_STORAGE_KEY = "vrodux-lang";

/** Reflect a language onto <html dir/lang> so RTL auto-flip + fonts apply. */
export function applyDocumentDirection(lng: string) {
  if (typeof document === "undefined") return;
  const meta = getLanguage(lng);
  const el = document.documentElement;
  el.setAttribute("lang", meta.code);
  el.setAttribute("dir", getDir(lng));
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_CODES,
    // "ar-AE" → "ar", "en-GB" → "en", etc.
    nonExplicitSupportedLngs: true,
    load: "currentOnly",
    ns: NAMESPACES as unknown as string[],
    defaultNS: "common",
    interpolation: {
      // React already escapes output — double-escaping would corrupt strings.
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ["localStorage"],
    },
    react: {
      // No Suspense — resources are bundled and available synchronously.
      useSuspense: false,
    },
  });

// Keep <html dir/lang> in sync with the active language (initial + on change).
applyDocumentDirection(i18n.language || DEFAULT_LANGUAGE);
i18n.on("languageChanged", applyDocumentDirection);

export default i18n;
