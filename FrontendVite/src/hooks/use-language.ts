import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import { getLanguage, getDir, isRtl as isRtlCode, LANGUAGES } from "@/i18n/languages";
import { useAuthStore } from "@/store/auth.store";
import { appSettingsApi } from "@/lib/identity/app-settings.api";

/**
 * UI-language state + switching, wrapping i18next.
 *
 * `setLanguage` changes the active language (i18next persists it to localStorage
 * via the detector, and updates <html dir/lang> via the languageChanged handler),
 * then best-effort persists the choice to the user's backend appearance settings
 * so it follows them across devices — mirrors how the theme is persisted.
 */
export function useLanguage() {
  const { i18n } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const current = i18n.language || "en";

  const setLanguage = useCallback(
    (code: string) => {
      if (code === i18n.language) return;
      i18n.changeLanguage(code);
      if (isAuthenticated) {
        appSettingsApi
          .saveCategory("appearance", { language: code })
          .catch(() => { /* offline / no perms — localStorage cache still holds it */ });
      }
    },
    [i18n, isAuthenticated],
  );

  return {
    language: current,
    meta: getLanguage(current),
    dir: getDir(current),
    isRtl: isRtlCode(current),
    languages: LANGUAGES,
    setLanguage,
  };
}
