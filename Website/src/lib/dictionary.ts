import en from "@/i18n/en.json";
import ar from "@/i18n/ar.json";
import type { Locale } from "@/i18n/config";

/**
 * Both dictionaries are bundled rather than dynamically imported: they are a few KB
 * each, and a static import lets TypeScript prove the Arabic file has every key the
 * English one does. A missing key becomes a build error, not a blank string in
 * production.
 */
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  en,
  ar: ar as Dictionary,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/**
 * Arabic has six plural forms, so anything beyond one/other must go through Intl
 * rather than a hand-rolled `n === 1` check.
 */
export function plural(
  locale: Locale,
  count: number,
  forms: { one: string; other: string },
): string {
  const rule = new Intl.PluralRules(locale === "ar" ? "ar-AE" : "en-AE").select(count);
  const template = rule === "one" ? forms.one : forms.other;
  return template.replace("{{count}}", new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE").format(count));
}
