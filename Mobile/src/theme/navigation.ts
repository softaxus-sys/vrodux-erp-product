import { DefaultTheme, type Theme } from "@react-navigation/native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { colors } from "@/theme/colors";
import { fontSize, fontWeight } from "@/theme/tokens";

/** Passed to <NavigationContainer theme={navTheme}> -- brand colors, default (system) fonts. */
export const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.card,
    text: colors.foreground,
    border: colors.border,
    notification: colors.destructive,
  },
};

/** Shared header look for every Stack.Navigator -- one consistent header instead of each stack
 *  picking its own (or none, which is what every stack had before this pass). */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerShadowVisible: true,
  headerTintColor: colors.primary,
  headerTitleStyle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
  headerBackTitleStyle: { fontSize: fontSize.base },
  contentStyle: { backgroundColor: colors.background },
};
