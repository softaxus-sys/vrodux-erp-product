import * as React from "react";
import { useThemeStore } from "@/store/theme.store";
import { useAuthStore } from "@/store/auth.store";
import { appSettingsApi } from "@/lib/identity/app-settings.api";
import i18n from "@/i18n";
import { getLanguage } from "@/i18n/languages";
import type { ThemePalette, LayoutVariant } from "@/config/themes";

// In light mode, force a light sidebar surface (themes ship a dark sidebar even
// in light mode). The theme's accent (sidebar-primary) is preserved.
const LIGHT_SIDEBAR: Record<string, string> = {
  "sidebar-background":         "0 0% 100%",
  "sidebar-foreground":         "222.2 47.4% 11.2%",
  "sidebar-accent":             "210 40% 96.1%",
  "sidebar-accent-foreground":  "222.2 47.4% 11.2%",
  "sidebar-border":             "214.3 31.8% 91.4%",
};

function buildCssText(palette: ThemePalette, dark: boolean, radius: number): string {
  const vars = { ...(dark ? palette.dark : palette.light) };
  if (!dark) Object.assign(vars, LIGHT_SIDEBAR); // light theme → light sidebar
  const lines: string[] = [`:root {`, `  --radius: ${radius}rem;`];
  for (const [key, value] of Object.entries(vars)) {
    lines.push(`  --${key}: ${value};`);
  }
  lines.push(`}`);
  return lines.join("\n");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { palette, darkMode, radius, loadFromApi, reset } = useThemeStore();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  /**
   * Every time authentication state changes:
   *  - Authenticated  → fetch THIS user's appearance from backend and apply it.
   *                     This is the authoritative source; localStorage is just a fast-load cache.
   *  - Unauthenticated → reset to defaults so the login page (and next user) starts clean.
   */
  React.useEffect(() => {
    if (!isAuthenticated) {
      reset();
      return;
    }

    let cancelled = false;
    appSettingsApi.getCategory("appearance")
      .then(a => {
        if (cancelled) return;

        // Apply the user's saved UI language (falls back to the localStorage /
        // browser-detected language when unset). Normalized to a supported code.
        if (a.language && a.language !== "") {
          const code = getLanguage(a.language).code;
          if (code !== i18n.language) i18n.changeLanguage(code);
        }

        // Resolve darkMode from two possible keys:
        //  • "darkMode"  (boolean string) — saved by /settings/appearance page
        //  • "theme"     (light/dark/system string) — saved by /settings/general page
        // "darkMode" takes precedence; "theme" is the fallback.
        let darkModeValue: boolean | undefined;
        if (a.darkMode !== undefined && a.darkMode !== "") {
          darkModeValue = a.darkMode === "true";
        } else if (a.theme !== undefined && a.theme !== "") {
          if (a.theme === "dark")        darkModeValue = true;
          else if (a.theme === "light")  darkModeValue = false;
          // "system" → leave undefined so the OS-preference branch handles it
          else if (a.theme === "system") {
            darkModeValue = window.matchMedia("(prefers-color-scheme: dark)").matches;
          }
        }

        loadFromApi({
          paletteId:     a.paletteId     || undefined,
          layoutVariant: (a.layoutVariant as LayoutVariant) || undefined,
          darkMode:      darkModeValue,
          radius:        a.radius !== undefined && a.radius !== ""
                           ? parseFloat(a.radius)
                           : undefined,
        });
      })
      .catch((err) => {
        // Backend unreachable — keep localStorage cache.
        // Log in development so the issue is visible.
        if (import.meta.env.DEV) {
          console.warn("[ThemeProvider] appearance fetch failed:", err);
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);   // intentionally only re-run on auth change

  // Apply/remove .dark class on <html>
  React.useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Inject palette CSS variables into <head>
  React.useLayoutEffect(() => {
    let tag = document.getElementById("softaxis-palette") as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "softaxis-palette";
      document.head.appendChild(tag);
    }
    tag.textContent = buildCssText(palette, darkMode, radius);
  }, [palette, darkMode, radius]);

  return <>{children}</>;
}
