import i18n from "@/i18n";
import { useTranslation } from "react-i18next";

/**
 * Farming text. The English wording IS the key, so a string with no Arabic yet simply shows in English
 * (never a raw key), and screens stay readable in the source. Keys contain dots and colons, so both
 * separators are switched off. `{{name}}` placeholders interpolate.
 *
 * `ft` works anywhere; call `useFt()` once in a view or shared component so it re-renders when the
 * language changes.
 */
export function ft(text: string | undefined | null, vars?: Record<string, string | number>): string {
  if (!text) return "";
  return i18n.t(text, { ns: "farming", keySeparator: false, nsSeparator: false, defaultValue: text, ...vars }) as string;
}

export function useFt() {
  useTranslation("farming");
  return ft;
}
