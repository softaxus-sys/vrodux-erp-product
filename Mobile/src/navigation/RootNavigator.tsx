import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { hasModuleAccess, hasPermission, useAuthStore } from "@/store/auth.store";
import { CRM_LEADS_VIEW, CRM_PIPELINE_VIEW } from "@/lib/crm.api";
import { HR_SELF_ATTENDANCE, HR_SELF_LEAVE, HR_SELF_PAYSLIP, HR_SELF_VIEW } from "@/lib/hr.api";
import LoginScreen from "@/screens/LoginScreen";
import TwoFactorScreen from "@/screens/TwoFactorScreen";
import HomeScreen from "@/screens/HomeScreen";
import LeadsStack from "@/navigation/LeadsStack";
import DealsStack from "@/navigation/DealsStack";
import HrStack from "@/navigation/HrStack";
import type { AppTabParamList, AuthStackParamList } from "@/navigation/types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();

function AppTabs() {
  // Static per session: permission/module claims only change on next login/refresh,
  // same as the web app's hasModuleAccess/hasRawPermission checks.
  const hasCrm = hasModuleAccess("crm");
  const canSeeLeads = hasCrm && hasPermission(...CRM_LEADS_VIEW);
  const canSeePipeline = hasCrm && hasPermission(...CRM_PIPELINE_VIEW);
  // Self-service is gated on any of the four hr.self.* keys -- the tab renders as long as at
  // least one of Attendance/Leave/Payslips/Profile is usable; each screen inside gates itself.
  const canSeeHr =
    hasModuleAccess("hr") &&
    hasPermission(HR_SELF_VIEW, HR_SELF_ATTENDANCE, HR_SELF_LEAVE, HR_SELF_PAYSLIP);

  return (
    <Tabs.Navigator>
      <Tabs.Screen name="Dashboard" component={HomeScreen} />
      {canSeeLeads && (
        <Tabs.Screen name="Leads" component={LeadsStack} options={{ headerShown: false }} />
      )}
      {canSeePipeline && (
        <Tabs.Screen name="Pipeline" component={DealsStack} options={{ headerShown: false }} />
      )}
      {canSeeHr && (
        <Tabs.Screen name="HR" component={HrStack} options={{ headerShown: false }} />
      )}
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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
