// ─────────────────────────────────────────────────────────────────────────────
// Supported UI languages (the i18n language registry).
//
// Adding a new language = add an entry here + a matching folder under
// `src/i18n/locales/<code>/` with the namespace JSON files. Everything else
// (switcher, direction handling, persistence) is driven off this list.
// ─────────────────────────────────────────────────────────────────────────────

export type LanguageDir = "ltr" | "rtl";

export interface LanguageMeta {
  /** BCP-47 code used by i18next and as the <html lang> value. */
  code:       string;
  /** English name (for reference / accessibility). */
  name:       string;
  /** The language's own name, shown in the switcher. */
  nativeName: string;
  /** Text direction — drives <html dir> and the RTL auto-flip. */
  dir:        LanguageDir;
  /** Short label shown in the compact switcher trigger. */
  short:      string;
}

export const LANGUAGES: LanguageMeta[] = [
  { code: "en",    name: "English",              nativeName: "English",   dir: "ltr", short: "EN" },
  { code: "ar",    name: "Arabic",               nativeName: "العربية",    dir: "rtl", short: "ع"  },
  // Urdu, Chinese (Simplified), Spanish and French are NOT offered yet: they have no translation files,
  // so choosing one only produced an English screen with the wrong direction and fonts. To bring one
  // back, add its locales/<code>/ folder (all namespaces) and restore its entry here.
];

export const DEFAULT_LANGUAGE = "en";

/** Languages that currently ship a full translation set. Others fall back to English. */
export const TRANSLATED_LANGUAGES = new Set(["en", "ar"]);

export const SUPPORTED_CODES = LANGUAGES.map((l) => l.code);

export function getLanguage(code: string | undefined | null): LanguageMeta {
  if (!code) return LANGUAGES[0]!;
  // exact, then base-language match (e.g. "ar-AE" → "ar", "zh" → "zh-CN")
  const exact = LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase());
  if (exact) return exact;
  const base = code.split("-")[0]!.toLowerCase();
  return LANGUAGES.find((l) => l.code.split("-")[0]!.toLowerCase() === base) ?? LANGUAGES[0]!;
}

export function getDir(code: string | undefined | null): LanguageDir {
  return getLanguage(code).dir;
}

export function isRtl(code: string | undefined | null): boolean {
  return getDir(code) === "rtl";
}
