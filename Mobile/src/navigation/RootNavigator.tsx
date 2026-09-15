import { useEffect, useState } from "react";
import { Modal, View } from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "@/store/auth.store";
import { registerForPushAsync } from "@/lib/push";
import LoginScreen from "@/screens/LoginScreen";
import TwoFactorScreen from "@/screens/TwoFactorScreen";
import HomeScreen from "@/screens/HomeScreen";
import MoreScreen from "@/screens/MoreScreen";
import AiAssistantScreen from "@/screens/AiAssistantScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import { FloatingAiButton } from "@/components/ai/FloatingAiButton";
import { NotificationBellButton } from "@/components/notifications/NotificationBellButton";
import { getTabLayout } from "@/navigation/tab-config";
import { LoadingState } from "@/components/ui";
import { buildNavTheme, buildStackScreenOptions, fontSize, fontWeight, useAppTheme } from "@/theme";
import type { AppTabParamList, AuthStackParamList } from "@/navigation/types";

/** Both the "open notifications" bell and a tapped OS push notification need to land on the same
 *  lead detail screen, nested two navigators deep (tab -> Leads stack -> LeadDetail) -- a shape
 *  React Navigation's typed `navigate` isn't built to express from outside the tree. Kept in one
 *  place rather than duplicated between the bell handler and the push-tap listener below. */
function openLeadDetail(navRef: ReturnType<typeof useNavigationContainerRef<AppTabParamList>>, leadId: string) {
  if (!navRef.isReady()) return;
  (navRef as { navigate: (name: string, params: unknown) => void }).navigate("Leads", {
    screen: "LeadDetail",
    params: { leadId, leadName: "Lead" },
  });
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();

function tabIcon(name: keyof typeof Feather.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} size={size} color={color} />
  );
}

function AppTabs({ onOpenNotifications }: { onOpenNotifications: () => void }) {
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
        // One bell, every tab's header -- same "always-on, not a tab slot" call as the AI
        // assistant's floating button, just anchored to the header instead of floating.
        headerRight: () => <NotificationBellButton onPress={onOpenNotifications} />,
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
            // `tabBarButton: () => null` alone hides the button's CONTENT but not its slot --
            // BottomTabBar gives every registered route an equal `flex: 1` box in the row
            // regardless of what its button renders, so a session with a dozen+ overflow tabs
            // ended up with the real buttons squeezed into a handful of even-width slots on the
            // left and "More" (the last route) pushed out to the far right across a wide empty
            // gap of invisible-but-space-reserving slots. Collapsing the item's own flex/width to
            // zero (it merges over the bar's default `{flex:1}`) removes the slot entirely instead
            // of just hiding its content, so the bar re-flows to just the tabs actually shown.
            ...(overflow.includes(tab)
              ? { tabBarButton: () => null, tabBarItemStyle: { flex: 0, width: 0, minWidth: 0, padding: 0, margin: 0 } }
              : {}),
          }}
        />
      ))}
      {overflow.length > 0 && (
        <Tabs.Screen name="More" component={MoreScreen} options={{ headerTitle: "More", tabBarIcon: tabIcon("more-horizontal") }} />
      )}
    </Tabs.Navigator>
  );
}

/** The tab navigator plus the assistant's floating entry point and the notifications bell modal --
 *  kept as one sibling of AuthStack.Navigator (not folded into AppTabs) so neither Modal's own
 *  state re-renders the whole tab tree on every open/close. */
function AuthenticatedApp({ navigationRef }: { navigationRef: ReturnType<typeof useNavigationContainerRef<AppTabParamList>> }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Register this device's push token once per authenticated session, and route a tapped OS
  // notification straight to its lead -- same destination the in-app bell list uses (see
  // openLeadDetail above). Never blocks anything: both are best-effort (see push.ts).
  useEffect(() => {
    registerForPushAsync();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; leadId?: string } | undefined;
      if (data?.type === "lead" && data.leadId) {
        setNotificationsOpen(false);
        openLeadDetail(navigationRef, data.leadId);
      } else {
        setNotificationsOpen(true);
      }
    });
    return () => sub.remove();
  }, [navigationRef]);

  return (
    <View style={{ flex: 1 }}>
      <AppTabs onOpenNotifications={() => setNotificationsOpen(true)} />
      <FloatingAiButton onPress={() => setAiOpen(true)} />
      <Modal visible={aiOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAiOpen(false)}>
        <AiAssistantScreen onClose={() => setAiOpen(false)} />
      </Modal>
      <Modal
        visible={notificationsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNotificationsOpen(false)}
      >
        <NotificationsScreen
          onClose={() => setNotificationsOpen(false)}
          onOpenLead={(leadId) => {
            setNotificationsOpen(false);
            openLeadDetail(navigationRef, leadId);
          }}
        />
      </Modal>
    </View>
  );
}

export default function RootNavigator() {
  const { colors, isDark } = useAppTheme();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigationRef = useNavigationContainerRef<AppTabParamList>();

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingState />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={buildNavTheme(colors, isDark)}>
      {isAuthenticated ? (
        <AuthenticatedApp navigationRef={navigationRef} />
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
