import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient } from "@/lib/query-client";
import RootNavigator from "@/navigation/RootNavigator";
import { AppThemeProvider, useAppTheme } from "@/theme";

function AppShell() {
  const { isDark } = useAppTheme();
  return (
    <>
      <RootNavigator />
      {/* Status bar icon color follows the active scheme -- light icons read against the dark
          header/background, dark icons against the light one. (Android edge-to-edge means the
          bar has no background color to set here.) */}
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <AppShell />
        </AppThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
