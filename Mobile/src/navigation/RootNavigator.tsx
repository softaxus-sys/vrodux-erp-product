import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useAuthStore } from "@/store/auth.store";
import LoginScreen from "@/screens/LoginScreen";
import TwoFactorScreen from "@/screens/TwoFactorScreen";
import HomeScreen from "@/screens/HomeScreen";
import MoreScreen from "@/screens/MoreScreen";
import { getTabLayout } from "@/navigation/tab-config";
import { LoadingState } from "@/components/ui";
import { buildNavTheme, buildStackScreenOptions, fontSize, fontWeight, useAppTheme } from "@/theme";
import type { AppTabParamList, AuthStackParamList } from "@/navigation/types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();

function tabIcon(name: keyof typeof Feather.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} size={size} color={color} />
  );
}

function AppTabs() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  // `direct` is what fits in the bar alongside Dashboard; `overflow` (if any) is folded into a
  // single "More" tab instead of crowding it further -- see tab-config.ts for the full rationale.
  const { direct, overflow } = getTabLayout();

  return (
    <Tabs.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtleForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
        headerStyle: stackScreenOptions.headerStyle,
        headerTitleStyle: stackScreenOptions.headerTitleStyle,
        headerShadowVisible: true,
      }}
    >
      <Tabs.Screen name="Dashboard" options={{ tabBarIcon: tabIcon("home") }} component={HomeScreen} />
      {direct.map((tab) => (
        <Tabs.Screen
          key={tab.key}
          name={tab.key}
          component={tab.component}
          options={
            tab.isStack
              ? { headerShown: false, tabBarIcon: tabIcon(tab.icon) }
              : { headerTitle: tab.label, tabBarIcon: tabIcon(tab.icon) }
          }
        />
      ))}
      {overflow.length > 0 && (
        <Tabs.Screen name="More" component={MoreScreen} options={{ headerTitle: "More", tabBarIcon: tabIcon("more-horizontal") }} />
      )}
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const { colors, isDark } = useAppTheme();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingState />
      </View>
    );
  }

  return (
    <NavigationContainer theme={buildNavTheme(colors, isDark)}>
      {isAuthenticated ? (
        <AppTabs />
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen
            name="TwoFactor"
            component={TwoFactorScreen}
            options={{ headerShown: true, headerTitle: "Verify", ...buildStackScreenOptions(colors) }}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
