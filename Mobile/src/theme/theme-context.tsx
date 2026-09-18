import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { darkColors, lightColors, type AppColors } from "@/theme/colors";

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({ colors: lightColors, isDark: false });

/**
 * Wraps the whole app (see `App.tsx`). `StyleSheet.create({...})` objects are frozen the instant
 * their module is first imported -- so every screen builds its styles from a `createStyles(colors)`
 * factory called at render time via `useAppTheme()`, not from a module-level constant. Because that
 * read goes through `useContext`, it updates directly in every subscribed component the moment the
 * OS scheme flips, regardless of memoization anywhere in between (e.g. React Navigation's screen
 * wrappers) -- unlike relying on a cascading re-render from a parent, which memoization can block.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const value = useMemo<ThemeContextValue>(
    () => ({ colors: isDark ? darkColors : lightColors, isDark }),
    [isDark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Read the active palette + scheme. Call this in every component whose styles depend on color --
 *  including small helper components defined alongside a screen, since each is its own React
 *  component (rendered via JSX, not called as a plain function) and can safely call its own hooks. */
export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
