import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import type { AppColors } from "@/theme/colors";
import { fontSize, fontWeight } from "@/theme/tokens";

/** Passed to <NavigationContainer theme={buildNavTheme(colors, isDark)}> -- brand colors on top
 *  of React Navigation's own Default/Dark base (so unthemed internals -- e.g. the native status
 *  bar area on some platforms -- still pick a sane light/dark base instead of always light). */
export function buildNavTheme(colors: AppColors, isDark: boolean): Theme {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.foreground,
      border: colors.border,
      notification: colors.destructive,
    },
  };
}

/** Shared header look for every Stack.Navigator -- one consistent header instead of each stack
 *  picking its own (or none, which is what every stack had before this pass). */
export function buildStackScreenOptions(colors: AppColors): NativeStackNavigationOptions {
  return {
    headerStyle: { backgroundColor: colors.card },
    headerShadowVisible: true,
    headerTintColor: colors.primary,
    headerTitleStyle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    headerBackTitleStyle: { fontSize: fontSize.base },
    contentStyle: { backgroundColor: colors.background },
  };
}
