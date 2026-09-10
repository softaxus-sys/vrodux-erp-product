import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { hasModuleAccess, hasPermission, useAuthStore } from "@/store/auth.store";
import { CRM_LEADS_VIEW } from "@/lib/crm.api";
import LoginScreen from "@/screens/LoginScreen";
import TwoFactorScreen from "@/screens/TwoFactorScreen";
import HomeScreen from "@/screens/HomeScreen";
import LeadsStack from "@/navigation/LeadsStack";
import type { AppTabParamList, AuthStackParamList } from "@/navigation/types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();

function AppTabs() {
  // Static per session: permission/module claims only change on next login/refresh,
  // same as the web app's hasModuleAccess/hasRawPermission checks.
  const canSeeLeads = hasModuleAccess("crm") && hasPermission(...CRM_LEADS_VIEW);

  return (
    <Tabs.Navigator>
      <Tabs.Screen name="Dashboard" component={HomeScreen} />
      {canSeeLeads && (
        <Tabs.Screen name="Leads" component={LeadsStack} options={{ headerShown: false }} />
      )}
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Wait for the persisted session to come back from SecureStore before
  // deciding which stack to render -- otherwise every cold start flashes
  // the login screen for a frame, even for an already-signed-in user.
  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <AppTabs />
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen
            name="TwoFactor"
            component={TwoFactorScreen}
            options={{ headerShown: true, headerTitle: "Verify" }}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
