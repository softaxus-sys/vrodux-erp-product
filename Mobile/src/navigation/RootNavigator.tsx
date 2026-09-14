import { useState } from "react";
import { Modal, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useAuthStore } from "@/store/auth.store";
import LoginScreen from "@/screens/LoginScreen";
import TwoFactorScreen from "@/screens/TwoFactorScreen";
import HomeScreen from "@/screens/HomeScreen";
import MoreScreen from "@/screens/MoreScreen";
import AiAssistantScreen from "@/screens/AiAssistantScreen";
import { FloatingAiButton } from "@/components/ai/FloatingAiButton";
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
      {/* Every module tab this session has -- direct AND overflow -- must be registered as a real
          route, or `navigation.navigate(key)` (e.g. MoreScreen's own menu) fails with "was not
          handled by any navigator": React Navigation can only navigate to routes that actually
          exist somewhere in the tree, not to whatever tab-config.ts merely *lists* as available.
          Only the tab BAR BUTTON is conditional on direct vs. overflow (`tabBarButton: () => null`
          hides it without deregistering the route) -- this is what actually makes the bar show
          just the direct set while keeping every tab reachable via "More". */}
      {[...direct, ...overflow].map((tab) => (
        <Tabs.Screen
          key={tab.key}
          name={tab.key}
          component={tab.component}
          options={{
            ...(tab.isStack ? { headerShown: false } : { headerTitle: tab.label }),
            tabBarIcon: tabIcon(tab.icon),
            ...(overflow.includes(tab) ? { tabBarButton: () => null } : {}),
          }}
        />
      ))}
      {overflow.length > 0 && (
        <Tabs.Screen name="More" component={MoreScreen} options={{ headerTitle: "More", tabBarIcon: tabIcon("more-horizontal") }} />
      )}
    </Tabs.Navigator>
  );
}

/** The tab navigator plus the assistant's floating entry point -- kept as one sibling of
 *  AuthStack.Navigator (not folded into AppTabs) so the assistant's own Modal state doesn't
 *  re-render the whole tab tree on every open/close. */
function AuthenticatedApp() {
  const [aiOpen, setAiOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <AppTabs />
      <FloatingAiButton onPress={() => setAiOpen(true)} />
      <Modal visible={aiOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAiOpen(false)}>
        <AiAssistantScreen onClose={() => setAiOpen(false)} />
      </Modal>
    </View>
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
        <AuthenticatedApp />
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
