import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { hasModuleAccess, hasPermission, useAuthStore } from "@/store/auth.store";
import { CRM_LEADS_VIEW, CRM_PIPELINE_VIEW } from "@/lib/crm.api";
import { HR_SELF_ATTENDANCE, HR_SELF_LEAVE, HR_SELF_PAYSLIP, HR_SELF_VIEW } from "@/lib/hr.api";
import {
  APPROVALS_FINANCE_PAYROLL,
  APPROVALS_HR_LEAVES,
  APPROVALS_HR_PAYROLL,
  APPROVALS_PURCHASE,
  APPROVALS_SALES_RETURNS,
} from "@/lib/approvals.api";
import { INVENTORY_STOCK_VIEW } from "@/lib/inventory.api";
import { SALES_ORDERS_VIEW, SALES_QUOTATIONS_VIEW } from "@/lib/sales.api";
import { PURCHASE_ORDERS_VIEW, PURCHASE_VENDORS_VIEW } from "@/lib/purchase.api";
import { FINANCE_EXPENSES_VIEW, FINANCE_INVOICING_VIEW } from "@/lib/finance.api";
import LoginScreen from "@/screens/LoginScreen";
import TwoFactorScreen from "@/screens/TwoFactorScreen";
import HomeScreen from "@/screens/HomeScreen";
import ApprovalsScreen from "@/screens/ApprovalsScreen";
import LeadsStack from "@/navigation/LeadsStack";
import DealsStack from "@/navigation/DealsStack";
import HrStack from "@/navigation/HrStack";
import InventoryStack from "@/navigation/InventoryStack";
import SalesStack from "@/navigation/SalesStack";
import PurchaseStack from "@/navigation/PurchaseStack";
import FinanceStack from "@/navigation/FinanceStack";
import { LoadingState } from "@/components/ui";
import { colors, fontSize, fontWeight, navTheme, stackScreenOptions } from "@/theme";
import type { AppTabParamList, AuthStackParamList } from "@/navigation/types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();

/** One Feather glyph per tab, keeping the icon set consistent with the outline style the web
 *  app's lucide-react icons use (Feather is the closest match bundled with Expo). */
const TAB_ICONS: Record<keyof AppTabParamList, keyof typeof Feather.glyphMap> = {
  Dashboard: "home",
  Leads: "users",
  Pipeline: "trending-up",
  HR: "briefcase",
  Approvals: "check-square",
  Inventory: "box",
  Sales: "shopping-bag",
  Purchase: "shopping-cart",
  Finance: "dollar-sign",
};

function tabIcon(name: keyof AppTabParamList) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={TAB_ICONS[name]} size={size} color={color} />
  );
}

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
  // Cross-module inbox (leave/payroll/purchase/sales approvals) -- visible if the session holds
  // any one of the five approve-style keys those four workflows are gated on. Each source inside
  // the screen re-checks its own module+permission, so this is just "is the tab worth showing".
  const canSeeApprovals =
    (hasModuleAccess("hr") && hasPermission(APPROVALS_HR_LEAVES, APPROVALS_HR_PAYROLL)) ||
    hasPermission(APPROVALS_FINANCE_PAYROLL) ||
    (hasModuleAccess("purchase") && hasPermission(APPROVALS_PURCHASE)) ||
    (hasModuleAccess("sales") && hasPermission(APPROVALS_SALES_RETURNS));
  const canSeeInventory = hasModuleAccess("inventory") && hasPermission(INVENTORY_STOCK_VIEW);
  const canSeeSales = hasModuleAccess("sales") && hasPermission(SALES_ORDERS_VIEW, SALES_QUOTATIONS_VIEW);
  const canSeePurchase = hasModuleAccess("purchase") && hasPermission(PURCHASE_ORDERS_VIEW, PURCHASE_VENDORS_VIEW);
  const canSeeFinance = hasModuleAccess("finance") && hasPermission(FINANCE_INVOICING_VIEW, FINANCE_EXPENSES_VIEW);

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
      <Tabs.Screen name="Dashboard" options={{ tabBarIcon: tabIcon("Dashboard") }} component={HomeScreen} />
      {canSeeLeads && (
        <Tabs.Screen name="Leads" component={LeadsStack} options={{ headerShown: false, tabBarIcon: tabIcon("Leads") }} />
      )}
      {canSeePipeline && (
        <Tabs.Screen name="Pipeline" component={DealsStack} options={{ headerShown: false, tabBarIcon: tabIcon("Pipeline") }} />
      )}
      {canSeeHr && (
        <Tabs.Screen name="HR" component={HrStack} options={{ headerShown: false, tabBarIcon: tabIcon("HR") }} />
      )}
      {canSeeApprovals && (
        <Tabs.Screen
          name="Approvals"
          component={ApprovalsScreen}
          options={{ headerTitle: "Approvals", tabBarIcon: tabIcon("Approvals") }}
        />
      )}
      {canSeeInventory && (
        <Tabs.Screen name="Inventory" component={InventoryStack} options={{ headerShown: false, tabBarIcon: tabIcon("Inventory") }} />
      )}
      {canSeeSales && (
        <Tabs.Screen name="Sales" component={SalesStack} options={{ headerShown: false, tabBarIcon: tabIcon("Sales") }} />
      )}
      {canSeePurchase && (
        <Tabs.Screen name="Purchase" component={PurchaseStack} options={{ headerShown: false, tabBarIcon: tabIcon("Purchase") }} />
      )}
      {canSeeFinance && (
        <Tabs.Screen name="Finance" component={FinanceStack} options={{ headerShown: false, tabBarIcon: tabIcon("Finance") }} />
      )}
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
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
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? (
        <AppTabs />
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen
            name="TwoFactor"
            component={TwoFactorScreen}
            options={{ headerShown: true, headerTitle: "Verify", ...stackScreenOptions }}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
