import type { ComponentType } from "react";
import type { Feather } from "@expo/vector-icons";
import { hasModuleAccess, hasPermission } from "@/store/auth.store";
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
import { PM_PROJECTS_VIEW } from "@/lib/project-management.api";
import { POS_REPORTS_VIEW, POS_SESSIONS_VIEW, POS_TRANSACTIONS_VIEW } from "@/lib/pos.api";
import {
  RESTAURANT_KITCHEN_VIEW,
  RESTAURANT_ORDERS_VIEW,
  RESTAURANT_RESERVATIONS_VIEW,
  RESTAURANT_REPORTS_VIEW,
  RESTAURANT_TABLES_VIEW,
} from "@/lib/restaurant.api";
import { VISA_CASES_VIEW } from "@/lib/visa.api";
import {
  REAL_ESTATE_BROKERS_VIEW,
  REAL_ESTATE_CONTRACTS_VIEW,
  REAL_ESTATE_PROPERTIES_VIEW,
  REAL_ESTATE_RENT_VIEW,
  REAL_ESTATE_TENANTS_VIEW,
  REAL_ESTATE_UNITS_VIEW,
} from "@/lib/real-estate.api";
import { FILE_MANAGER_VIEW } from "@/lib/file-manager.api";
import { B2B_CONTRACTS_VIEW, B2B_PROPOSALS_VIEW, B2B_TICKETS_VIEW } from "@/lib/b2b.api";
import { EDUCATION_ADMISSIONS_VIEW, EDUCATION_ENROLLMENTS_VIEW, EDUCATION_STUDENTS_VIEW } from "@/lib/education.api";
import { HEALTHCARE_APPOINTMENTS_VIEW, HEALTHCARE_PATIENTS_VIEW, HEALTHCARE_TREATMENT_PLANS_VIEW } from "@/lib/healthcare.api";
import { INSURANCE_CLAIMS_VIEW, INSURANCE_POLICIES_VIEW, INSURANCE_RENEWALS_VIEW } from "@/lib/insurance.api";
import ApprovalsScreen from "@/screens/ApprovalsScreen";
import FileManagerScreen from "@/screens/FileManagerScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import LeadsStack from "@/navigation/LeadsStack";
import DealsStack from "@/navigation/DealsStack";
import HrStack from "@/navigation/HrStack";
import InventoryStack from "@/navigation/InventoryStack";
import SalesStack from "@/navigation/SalesStack";
import PurchaseStack from "@/navigation/PurchaseStack";
import FinanceStack from "@/navigation/FinanceStack";
import ProjectManagementStack from "@/navigation/ProjectManagementStack";
import POSStack from "@/navigation/POSStack";
import RestaurantStack from "@/navigation/RestaurantStack";
import VisaStack from "@/navigation/VisaStack";
import RealEstateStack from "@/navigation/RealEstateStack";
import B2BStack from "@/navigation/B2BStack";
import EducationStack from "@/navigation/EducationStack";
import HealthcareStack from "@/navigation/HealthcareStack";
import InsuranceStack from "@/navigation/InsuranceStack";
import ConstructionStack from "@/navigation/ConstructionStack";
import HospitalityStack from "@/navigation/HospitalityStack";
import ReportsStack from "@/navigation/ReportsStack";
import type { AppTabParamList } from "@/navigation/types";

export type ModuleTabKey = Exclude<keyof AppTabParamList, "Dashboard" | "More">;

export interface ModuleTabDef {
  key: ModuleTabKey;
  label: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  component: ComponentType<any>;
  /** true = its own Stack.Navigator supplies the header (tab-level `headerShown: false`); false =
   *  a plain screen (ApprovalsScreen) that needs the tab itself to show a header. */
  isStack: boolean;
}

/**
 * Priority order for the tab bar's direct slots (highest first) -- CRM is the module the mobile
 * app was built around first and the most field-usable one (leads/pipeline update on the go);
 * Approvals is the cross-module "something is waiting on you" inbox. The rest follow build order.
 * A session only ever sees the entries it's gated for (`isTabAvailable`); anything past
 * `MAX_DIRECT_MODULE_TABS` once available moves into the "More" screen instead of crowding the
 * bar -- see `getTabLayout` below.
 */
const MODULE_TAB_ORDER: ModuleTabDef[] = [
  { key: "Leads", label: "Leads", subtitle: "Search, filter, log activity", icon: "users", component: LeadsStack, isStack: true },
  { key: "Pipeline", label: "Pipeline", subtitle: "Track deals through each stage", icon: "trending-up", component: DealsStack, isStack: true },
  { key: "Approvals", label: "Approvals", subtitle: "Leave, purchase, returns, payroll", icon: "check-square", component: ApprovalsScreen, isStack: false },
  { key: "HR", label: "HR", subtitle: "Attendance, leave, payslips", icon: "briefcase", component: HrStack, isStack: true },
  { key: "Projects", label: "Projects", subtitle: "Boards, backlog, issues", icon: "trello", component: ProjectManagementStack, isStack: true },
  { key: "Sales", label: "Sales", subtitle: "Orders and quotations", icon: "shopping-bag", component: SalesStack, isStack: true },
  { key: "Purchase", label: "Purchase", subtitle: "Purchase orders and vendors", icon: "shopping-cart", component: PurchaseStack, isStack: true },
  { key: "Inventory", label: "Inventory", subtitle: "Product and stock lookup", icon: "box", component: InventoryStack, isStack: true },
  { key: "Finance", label: "Finance", subtitle: "Invoices and expenses", icon: "dollar-sign", component: FinanceStack, isStack: true },
  { key: "POS", label: "POS", subtitle: "Shift status and transactions", icon: "monitor", component: POSStack, isStack: true },
  { key: "Restaurant", label: "Restaurant", subtitle: "Tables, orders, kitchen, reservations", icon: "coffee", component: RestaurantStack, isStack: true },
  { key: "Visa", label: "Visa", subtitle: "Cases, documents, renewals", icon: "flag", component: VisaStack, isStack: true },
  { key: "RealEstate", label: "Real Estate", subtitle: "Properties, tenants, rent collection", icon: "home", component: RealEstateStack, isStack: true },
  // Industry verticals -- niche by nature (a tenant picks one industry pack, not several), so in
  // practice at most one or two of these six ever show for a given session despite the long list.
  { key: "B2B", label: "B2B Services", subtitle: "Proposals, contracts, support tickets", icon: "briefcase", component: B2BStack, isStack: true },
  { key: "Education", label: "Education", subtitle: "Admissions, students, enrollments", icon: "book-open", component: EducationStack, isStack: true },
  { key: "Healthcare", label: "Healthcare", subtitle: "Patients, appointments, treatment plans", icon: "activity", component: HealthcareStack, isStack: true },
  { key: "Insurance", label: "Insurance", subtitle: "Policies, renewals, claims", icon: "shield", component: InsuranceStack, isStack: true },
  { key: "Construction", label: "Construction", subtitle: "Projects, sites, contractors, BOQs", icon: "tool", component: ConstructionStack, isStack: true },
  { key: "Hospitality", label: "Hospitality", subtitle: "Rooms, bookings, housekeeping", icon: "key", component: HospitalityStack, isStack: true },
  { key: "Reports", label: "Reports", subtitle: "POS and Inventory tabular reports", icon: "bar-chart-2", component: ReportsStack, isStack: true },
  { key: "FileManager", label: "File Manager", subtitle: "Browse CRM document library", icon: "folder", component: FileManagerScreen, isStack: false },
  // Last on purpose -- ungated (every session qualifies, see isTabAvailable below), so it should
  // never crowd out an actual module tab; it only surfaces directly for a session with nothing
  // else, and sits in "More" for everyone else.
  { key: "Settings", label: "Settings", subtitle: "Profile, password, two-factor auth", icon: "settings", component: SettingsScreen, isStack: false },
];

/** Static per session -- permission/module claims only change on next login/refresh, same as
 *  every other hasModuleAccess/hasRawPermission check in this app (RootNavigator used to compute
 *  each of these inline; centralized here so the tab bar and the "More" screen can't drift). Not
 *  a hook (calls no `useX`), so it's safe to call from a plain function like this one. */
function isTabAvailable(key: ModuleTabKey): boolean {
  switch (key) {
    case "Leads":
      return hasModuleAccess("crm") && hasPermission(...CRM_LEADS_VIEW);
    case "Pipeline":
      return hasModuleAccess("crm") && hasPermission(...CRM_PIPELINE_VIEW);
    case "HR":
      // Gated on any of the four hr.self.* keys -- the tab renders as long as at least one of
      // Attendance/Leave/Payslips/Profile is usable; each screen inside gates itself further.
      return hasModuleAccess("hr") && hasPermission(HR_SELF_VIEW, HR_SELF_ATTENDANCE, HR_SELF_LEAVE, HR_SELF_PAYSLIP);
    case "Approvals":
      // Visible if the session holds any one of the five approve-style keys the four workflows
      // inside are gated on. Each source inside the screen re-checks its own module+permission.
      return (
        (hasModuleAccess("hr") && hasPermission(APPROVALS_HR_LEAVES, APPROVALS_HR_PAYROLL)) ||
        hasPermission(APPROVALS_FINANCE_PAYROLL) ||
        (hasModuleAccess("purchase") && hasPermission(APPROVALS_PURCHASE)) ||
        (hasModuleAccess("sales") && hasPermission(APPROVALS_SALES_RETURNS))
      );
    case "Inventory":
      return hasModuleAccess("inventory") && hasPermission(INVENTORY_STOCK_VIEW);
    case "Sales":
      return hasModuleAccess("sales") && hasPermission(SALES_ORDERS_VIEW, SALES_QUOTATIONS_VIEW);
    case "Purchase":
      return hasModuleAccess("purchase") && hasPermission(PURCHASE_ORDERS_VIEW, PURCHASE_VENDORS_VIEW);
    case "Finance":
      return hasModuleAccess("finance") && hasPermission(FINANCE_INVOICING_VIEW, FINANCE_EXPENSES_VIEW);
    case "Projects":
      // The project LIST itself is further scoped server-side to the caller's own memberships
      // (ProjectAccessGuard.cs) -- this only decides whether the tab is worth showing at all.
      return hasModuleAccess("project-management") && hasPermission(PM_PROJECTS_VIEW);
    case "POS":
      // Any one of the three read keys is enough -- the screens inside gate their own sections
      // (dashboard needs .reports/.transactions, shift detail needs .sessions, etc).
      return hasModuleAccess("pos") && hasPermission(POS_SESSIONS_VIEW, POS_TRANSACTIONS_VIEW, POS_REPORTS_VIEW);
    case "Restaurant":
      // Any one of the five read keys is enough -- the home screen and each sub-screen re-check
      // their own specific permission (dashboards need .reports, tickets need .kitchen, etc).
      return (
        hasModuleAccess("restaurant") &&
        hasPermission(RESTAURANT_REPORTS_VIEW, RESTAURANT_TABLES_VIEW, RESTAURANT_ORDERS_VIEW, RESTAURANT_KITCHEN_VIEW, RESTAURANT_RESERVATIONS_VIEW)
      );
    case "Visa":
      // Only one permission group exists on the backend (visa.cases.*) -- both the dashboard and
      // the cases/renewals screens all gate on this single key.
      return hasModuleAccess("visa") && hasPermission(VISA_CASES_VIEW);
    case "RealEstate":
      // Any one of the six read keys is enough -- the home screen's menu cards and each
      // sub-screen re-check their own specific permission.
      return (
        hasModuleAccess("real-estate") &&
        hasPermission(
          REAL_ESTATE_PROPERTIES_VIEW,
          REAL_ESTATE_UNITS_VIEW,
          REAL_ESTATE_TENANTS_VIEW,
          REAL_ESTATE_CONTRACTS_VIEW,
          REAL_ESTATE_RENT_VIEW,
          REAL_ESTATE_BROKERS_VIEW,
        )
      );
    case "B2B":
      // Any one of the three read keys is enough -- the home screen's menu cards and each
      // sub-feature list re-check their own specific permission.
      return hasModuleAccess("b2b") && hasPermission(B2B_PROPOSALS_VIEW, B2B_CONTRACTS_VIEW, B2B_TICKETS_VIEW);
    case "Education":
      return hasModuleAccess("education") && hasPermission(EDUCATION_ADMISSIONS_VIEW, EDUCATION_STUDENTS_VIEW, EDUCATION_ENROLLMENTS_VIEW);
    case "Healthcare":
      return hasModuleAccess("healthcare") && hasPermission(HEALTHCARE_PATIENTS_VIEW, HEALTHCARE_APPOINTMENTS_VIEW, HEALTHCARE_TREATMENT_PLANS_VIEW);
    case "Insurance":
      return hasModuleAccess("insurance") && hasPermission(INSURANCE_POLICIES_VIEW, INSURANCE_RENEWALS_VIEW, INSURANCE_CLAIMS_VIEW);
    case "Construction":
      // No [RequirePermission] exists anywhere in this service (confirmed by reading every
      // controller directly) -- module access is the only real gate, same as Hospitality below.
      return hasModuleAccess("construction");
    case "Hospitality":
      return hasModuleAccess("hospitality");
    case "Reports":
      // POS/Inventory reports carry no permission gate on the backend at all (confirmed by
      // reading ReportsController/InventoryReportsController directly) -- the web hub itself only
      // gates on module access for these two categories, so this mirrors that exactly.
      return hasModuleAccess("pos") || hasModuleAccess("inventory");
    case "FileManager":
      // Same split as web's Module 35 fix: opening the tab only needs file-manager.view -- what
      // it can actually list (CRM's document library) is a separate, stricter check made inside
      // the screen itself, so a user with this key but no CRM access sees an honest empty state
      // rather than the tab vanishing outright.
      return hasModuleAccess("file-manager") && hasPermission(FILE_MANAGER_VIEW);
    case "Settings":
      // The signed-in user's own account -- no permission key gates it on the backend either
      // (AuthController/TwoFactorController are [Authorize]-only), so every session qualifies.
      return true;
  }
}

/** All module tabs this session is entitled to, in priority order. */
export function getAvailableModuleTabs(): ModuleTabDef[] {
  return MODULE_TAB_ORDER.filter((t) => isTabAvailable(t.key));
}

/** Dashboard + this many module tabs (+ a "More" tab when there's overflow) is the most the bar
 *  shows at once -- React Navigation will happily render nine, but past ~5 it stops being a
 *  comfortable phone UI (the problem this module exists to fix). */
const MAX_DIRECT_MODULE_TABS = 4;

export interface TabLayout {
  /** Rendered as real tab-bar buttons, alongside Dashboard. */
  direct: ModuleTabDef[];
  /** Not in the bar at all -- reachable only via the "More" screen's menu. Empty (no "More" tab
   *  registered) when everything this session has already fits directly. */
  overflow: ModuleTabDef[];
}

export function getTabLayout(): TabLayout {
  const available = getAvailableModuleTabs();
  if (available.length <= MAX_DIRECT_MODULE_TABS) {
    return { direct: available, overflow: [] };
  }
  // One of the direct slots becomes the "More" tab itself once there's overflow, so the bar
  // never exceeds Dashboard + MAX_DIRECT_MODULE_TABS regardless of which branch this takes.
  return {
    direct: available.slice(0, MAX_DIRECT_MODULE_TABS - 1),
    overflow: available.slice(MAX_DIRECT_MODULE_TABS - 1),
  };
}
