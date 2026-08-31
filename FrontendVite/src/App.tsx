import * as React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import type { ModuleKey } from "@/types";
import { ErpLayout } from "@/components/layout/layouts/erp-layout";
import { ServerSettingsPrompt } from "@/components/desktop/server-settings-prompt";
// Every route below is code-split, so each one is a chance to hit a chunk that a deploy has just
// replaced. lazyWithRetry turns that from a white screen into a single reload.
import { lazyWithRetry } from "@/lib/lazy-with-retry";

// ── Auth ──────────────────────────────────────────────────────────────────────
const LoginPage          = lazyWithRetry(() => import("@/pages/auth/login"));
const ForgotPasswordPage = lazyWithRetry(() => import("@/pages/auth/forgot-password"));
const ResetPasswordPage  = lazyWithRetry(() => import("@/pages/auth/reset-password"));
const VerifyEmailPage    = lazyWithRetry(() => import("@/pages/auth/verify-email"));

// ── Core ──────────────────────────────────────────────────────────────────────
const DashboardPage        = lazyWithRetry(() => import("@/pages/dashboard"));
const AiAssistantPage      = lazyWithRetry(() => import("@/pages/ai-assistant"));
const ReportsPage          = lazyWithRetry(() => import("@/pages/reports"));
const FileManagerPage      = lazyWithRetry(() => import("@/pages/file-manager"));
const ProfilePage          = lazyWithRetry(() => import("@/pages/profile"));

// ── Finance ───────────────────────────────────────────────────────────────────
const AccountingPage       = lazyWithRetry(() => import("@/pages/finance/accounting"));
const GeneralLedgerPage    = lazyWithRetry(() => import("@/pages/finance/general-ledger"));
const JournalsPage         = lazyWithRetry(() => import("@/pages/finance/journals"));
const StatementsPage       = lazyWithRetry(() => import("@/pages/finance/statements"));
const InvoicingPage        = lazyWithRetry(() => import("@/pages/finance/invoicing"));
const RecurringInvoicesPage = lazyWithRetry(() => import("@/pages/finance/recurring"));
const ExpensesPage         = lazyWithRetry(() => import("@/pages/finance/expenses"));
const BudgetingPage        = lazyWithRetry(() => import("@/pages/finance/budgeting"));
const TaxPage              = lazyWithRetry(() => import("@/pages/finance/tax"));
const BankingPage          = lazyWithRetry(() => import("@/pages/finance/banking"));

// ── HR ────────────────────────────────────────────────────────────────────────
const EmployeesPage        = lazyWithRetry(() => import("@/pages/hr/employees"));
const AttendancePage       = lazyWithRetry(() => import("@/pages/hr/attendance"));
const PayrollPage          = lazyWithRetry(() => import("@/pages/hr/payroll"));
const LeavesPage           = lazyWithRetry(() => import("@/pages/hr/leaves"));
const RecruitmentPage      = lazyWithRetry(() => import("@/pages/hr/recruitment"));
const PerformancePage      = lazyWithRetry(() => import("@/pages/hr/performance"));
const MyHrPage             = lazyWithRetry(() => import("@/pages/hr/me"));

// ── CRM ───────────────────────────────────────────────────────────────────────
const CrmDashboardPage     = lazyWithRetry(() => import("@/pages/crm/dashboard"));
const LeadsPage            = lazyWithRetry(() => import("@/pages/crm/leads"));
const PipelinePage         = lazyWithRetry(() => import("@/pages/crm/pipeline"));
const CustomersPage        = lazyWithRetry(() => import("@/pages/crm/customers"));
const CrmActivitiesPage    = lazyWithRetry(() => import("@/pages/crm/activities"));
const CrmDocumentsPage     = lazyWithRetry(() => import("@/pages/crm/documents"));
const CrmReportsPage       = lazyWithRetry(() => import("@/pages/crm/reports"));

// ── Sales ─────────────────────────────────────────────────────────────────────
const QuotationsPage       = lazyWithRetry(() => import("@/pages/sales/quotations"));
const SalesOrdersPage      = lazyWithRetry(() => import("@/pages/sales/orders"));
const ReturnsPage          = lazyWithRetry(() => import("@/pages/sales/returns"));
const DeliveryChallansPage = lazyWithRetry(() => import("@/pages/sales/delivery-challans"));

// ── Purchase ──────────────────────────────────────────────────────────────────
const VendorsPage          = lazyWithRetry(() => import("@/pages/purchase/vendors"));
const PurchaseOrdersPage   = lazyWithRetry(() => import("@/pages/purchase/orders"));
const ApprovalsPage        = lazyWithRetry(() => import("@/pages/purchase/approvals"));
const GrnPage              = lazyWithRetry(() => import("@/pages/purchase/grn"));
const PurchaseReturnsPage  = lazyWithRetry(() => import("@/pages/purchase/returns"));
const PurchaseBillsPage    = lazyWithRetry(() => import("@/pages/purchase/bills"));

// ── Inventory ─────────────────────────────────────────────────────────────────
const WarehousesPage       = lazyWithRetry(() => import("@/pages/inventory/warehouses"));
const StockPage            = lazyWithRetry(() => import("@/pages/inventory/stock"));
const MovementsPage        = lazyWithRetry(() => import("@/pages/inventory/movements"));
const TransfersPage        = lazyWithRetry(() => import("@/pages/inventory/transfers"));
const CategoriesPage       = lazyWithRetry(() => import("@/pages/inventory/master/categories"));
const BrandsPage           = lazyWithRetry(() => import("@/pages/inventory/master/brands"));
const UomPage              = lazyWithRetry(() => import("@/pages/inventory/master/uom"));

// ── Real Estate ───────────────────────────────────────────────────────────────
const PropertiesPage       = lazyWithRetry(() => import("@/pages/real-estate/properties"));
const UnitsPage            = lazyWithRetry(() => import("@/pages/real-estate/units"));
const TenantsPage          = lazyWithRetry(() => import("@/pages/real-estate/tenants"));
const ContractsPage        = lazyWithRetry(() => import("@/pages/real-estate/contracts"));
const RentAlertsPage       = lazyWithRetry(() => import("@/pages/real-estate/rent-alerts"));
const BrokersPage          = lazyWithRetry(() => import("@/pages/real-estate/brokers"));
const RePipelinePage       = lazyWithRetry(() => import("@/pages/real-estate/sales"));

// ── Construction ──────────────────────────────────────────────────────────────
const ConBiddingPage       = lazyWithRetry(() => import("@/pages/construction/bidding"));
const HealthcarePage       = lazyWithRetry(() => import("@/pages/healthcare"));
const EducationPage        = lazyWithRetry(() => import("@/pages/education"));
const InsurancePage        = lazyWithRetry(() => import("@/pages/insurance"));
const B2BPage              = lazyWithRetry(() => import("@/pages/b2b"));
const ProjectsPage         = lazyWithRetry(() => import("@/pages/construction/projects"));
const BoqPage              = lazyWithRetry(() => import("@/pages/construction/boq"));
const ContractorsPage      = lazyWithRetry(() => import("@/pages/construction/contractors"));
const SitesPage            = lazyWithRetry(() => import("@/pages/construction/sites"));

// ── POS ───────────────────────────────────────────────────────────────────────
const RetailPOSPage        = lazyWithRetry(() => import("@/pages/pos/retail"));
const RestaurantPOSPage    = lazyWithRetry(() => import("@/pages/pos/restaurant"));
const KitchenDisplayPage   = lazyWithRetry(() => import("@/pages/pos/kitchen"));
const FloorDesignerPage    = lazyWithRetry(() => import("@/pages/pos/floor-designer"));
const WaitlistPage         = lazyWithRetry(() => import("@/pages/pos/waitlist"));
const ReservationsPage     = lazyWithRetry(() => import("@/pages/pos/reservations"));
const KitchenConfigPage    = lazyWithRetry(() => import("@/pages/pos/kitchen-config"));
const MenuManagementPage   = lazyWithRetry(() => import("@/pages/pos/menu-management"));
const DeliveryPage         = lazyWithRetry(() => import("@/pages/pos/delivery"));
const RestaurantReportsPage    = lazyWithRetry(() => import("@/pages/pos/reports"));
const RestaurantDashboardsPage = lazyWithRetry(() => import("@/pages/pos/dashboards"));
const BranchAccessPage         = lazyWithRetry(() => import("@/pages/pos/branch-access"));
const PosCustomersPage         = lazyWithRetry(() => import("@/pages/pos/customers"));

// ── Recipe ────────────────────────────────────────────────────────────────────
const RecipesPage          = lazyWithRetry(() => import("@/pages/recipe/recipes"));
const IngredientsPage      = lazyWithRetry(() => import("@/pages/recipe/ingredients"));
const FoodCostPage         = lazyWithRetry(() => import("@/pages/recipe/food-cost"));

// ── Project Management ──────────────────────────────────────────────────────
const ProjectManagementPage = lazyWithRetry(() => import("@/pages/project-management/index"));
const ProjectBoardPage      = lazyWithRetry(() => import("@/pages/project-management/board"));
const ProjectBacklogPage    = lazyWithRetry(() => import("@/pages/project-management/backlog"));
const ProjectIssuesPage     = lazyWithRetry(() => import("@/pages/project-management/issues"));

// ── Visa Services ────────────────────────────────────────────────────────────
const VisaDashboardPage     = lazyWithRetry(() => import("@/pages/visa/dashboard"));
const VisaCasesPage         = lazyWithRetry(() => import("@/pages/visa/cases"));
const VisaRenewalsPage      = lazyWithRetry(() => import("@/pages/visa/renewals"));
const VisaTypesPage         = lazyWithRetry(() => import("@/pages/visa/types"));
const VisaChannelsPage      = lazyWithRetry(() => import("@/pages/visa/channels"));

// ── Hospitality ───────────────────────────────────────────────────────────────
const BookingsPage         = lazyWithRetry(() => import("@/pages/hospitality/bookings"));
const RoomsPage            = lazyWithRetry(() => import("@/pages/hospitality/rooms"));
const HousekeepingPage     = lazyWithRetry(() => import("@/pages/hospitality/housekeeping"));

// ── Settings ──────────────────────────────────────────────────────────────────
const GeneralSettingsPage  = lazyWithRetry(() => import("@/pages/settings/general"));
const CurrencySettingsPage = lazyWithRetry(() => import("@/pages/settings/currency"));
const BillingSettingsPage  = lazyWithRetry(() => import("@/pages/settings/billing"));
const CheckoutResultPage   = lazyWithRetry(() => import("@/pages/billing/checkout-result"));
const UsersPage            = lazyWithRetry(() => import("@/pages/settings/users"));
const SecurityPage         = lazyWithRetry(() => import("@/pages/settings/security"));
const RolesPage            = lazyWithRetry(() => import("@/pages/settings/roles"));
const TeamsPage            = lazyWithRetry(() => import("@/pages/settings/teams"));
const BranchesPage         = lazyWithRetry(() => import("@/pages/settings/branches"));
const IntegrationsPage     = lazyWithRetry(() => import("@/pages/settings/integrations"));
const PropertyFinderPage   = lazyWithRetry(() => import("@/pages/settings/property-finder"));
const AuditPage            = lazyWithRetry(() => import("@/pages/settings/audit"));
const AppearancePage       = lazyWithRetry(() => import("@/pages/settings/appearance"));
const PosPaymentMethodsPage = lazyWithRetry(() => import("@/pages/settings/pos-payment-methods"));
const PaymentGatewayPage    = lazyWithRetry(() => import("@/pages/settings/payment-gateway"));
const NotificationConfigPage = lazyWithRetry(() => import("@/pages/settings/notifications"));
const DevicesPage           = lazyWithRetry(() => import("@/pages/settings/devices"));
const VouchersPage          = lazyWithRetry(() => import("@/pages/settings/vouchers"));

// ── Master Data ───────────────────────────────────────────────────────────────
const MasterDataPage       = lazyWithRetry(() => import("@/pages/master-data"));

// ── Onboarding / Trial ────────────────────────────────────────────────────────
const OnboardingPage            = lazyWithRetry(() => import("@/pages/trial/onboarding"));

// ── Restaurant public (QR ordering / delivery tracking) ──────────────────────
const GuestOrderPage            = lazyWithRetry(() => import("@/pages/order/guest-order"));
const DeliveryTrackingPage      = lazyWithRetry(() => import("@/pages/track/delivery-tracking"));

// ── Careers (public) ─────────────────────────────────────────────────────────
const CareersJobsPage           = lazyWithRetry(() => import("@/pages/careers/jobs"));
const CareersJobDetailPage      = lazyWithRetry(() => import("@/pages/careers/job-detail"));

// ── Super Admin ───────────────────────────────────────────────────────────────
const SuperAdminPage            = lazyWithRetry(() => import("@/pages/super-admin/index"));
const NewTenantPage             = lazyWithRetry(() => import("@/pages/super-admin/new-tenant"));
const TenantDetailPage          = lazyWithRetry(() => import("@/pages/super-admin/tenant-detail"));
const PlatformBillingPage       = lazyWithRetry(() => import("@/pages/super-admin/billing"));
const SubscriptionExpiredPage   = lazyWithRetry(() => import("@/pages/subscription-expired"));

// ── Guards ───────────────────────────────────────────────────────────────────

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

/**
 * Home path per role: a platform super-admin (not impersonating a tenant) lands on the
 * super-admin console (tenant list), NOT the operational dashboard (which would pool
 * cross-tenant data). Everyone else lands on /dashboard.
 */
function useHomePath() {
  return useAuthStore((s) =>
    s.user?.role === "super_admin" && !s.impersonation ? "/super-admin" : "/dashboard");
}

function HomeRedirect() {
  return <Navigate to={useHomePath()} replace />;
}

function GuestGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const home = useHomePath();
  if (isAuthenticated) return <Navigate to={home} replace />;
  return <>{children}</>;
}

/** /dashboard for a pure super-admin redirects to the super-admin console. */
function DashboardRoute() {
  const superAdmin = useAuthStore((s) => s.user?.role === "super_admin" && !s.impersonation);
  if (superAdmin) return <Navigate to="/super-admin" replace />;
  return <DashboardPage />;
}

/**
 * ModuleGuard — protects a group of routes behind a module access check.
 * Used as a layout route: <Route element={<ModuleGuard module="finance" />}>
 * If the user doesn't have access, they are bounced to /dashboard.
 */
function ModuleGuard({ module }: { module: ModuleKey }) {
  const hasModuleAccess = useAuthStore((s) => s.hasModuleAccess);
  if (!hasModuleAccess(module)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/**
 * RoleGuard — restricts a route group to specific roles.
 * Used for Settings/Users which require admin privileges.
 */
function RoleGuard({ roles }: { roles: Array<"super_admin" | "tenant_admin" | "manager"> }) {
  const isRole = useAuthStore((s) => s.isRole);
  if (!isRole(roles)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/**
 * SettingsGuard — restricts one Settings page to holders of its permission key.
 *
 * Replaces the blanket RoleGuard that used to wrap the whole Settings block, which made every
 * settings.* permission key unusable: a role granted settings.users.view was still bounced to
 * the dashboard because its frontend role mapped to "custom" rather than tenant_admin/manager.
 * The admin tiers still pass unconditionally — see `canOpenSettingsPage` in the auth store.
 */
function SettingsGuard({ permission }: { permission: string }) {
  const canOpenSettingsPage = useAuthStore((s) => s.canOpenSettingsPage);
  if (!canOpenSettingsPage(permission)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[200px]">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export function App() {
  return (
    <React.Suspense fallback={<PageLoader />}>
      <ServerSettingsPrompt />
      <Routes>
        {/* Root redirect (role-aware: super-admin → console, others → dashboard) */}
        <Route path="/" element={<HomeRedirect />} />

        {/* Auth */}
        <Route
          path="/auth/login"
          element={
            <GuestGuard>
              <LoginPage />
            </GuestGuard>
          }
        />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/auth/verify-email"    element={<VerifyEmailPage />} />
        <Route path="/trial"                element={<OnboardingPage />} />

        {/* Subscription expired — shown when enforcement middleware blocks requests */}
        <Route path="/subscription-expired" element={<SubscriptionExpiredPage />} />

        {/* Careers portal — fully public, no auth */}
        <Route path="/careers/:tenantSlug" element={<CareersJobsPage />} />
        <Route path="/careers/:tenantSlug/jobs/:jobId" element={<CareersJobDetailPage />} />

        {/* Restaurant QR-table / kiosk ordering + delivery tracking — fully public, no auth */}
        <Route path="/order/:qrCode" element={<GuestOrderPage />} />
        <Route path="/track/:token" element={<DeliveryTrackingPage />} />

        {/* ERP (authenticated) — layout wraps all children */}
        <Route
          element={
            <AuthGuard>
              <ErpLayout />
            </AuthGuard>
          }
        >
          {/* ── Always accessible ───────────────────────────────────────────── */}
          <Route path="/dashboard"    element={<DashboardRoute />} />
          <Route path="/profile"      element={<ProfilePage />} />
          {/* Appearance is in topbar for all users, no module gate needed */}
          <Route path="/settings/appearance" element={<AppearancePage />} />

          {/* ── Utility modules (accessible if any module permission exists) ── */}
          <Route element={<ModuleGuard module="ai-assistant" />}>
            <Route path="/ai-assistant" element={<AiAssistantPage />} />
          </Route>
          <Route element={<ModuleGuard module="reports" />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
          <Route element={<ModuleGuard module="file-manager" />}>
            <Route path="/file-manager" element={<FileManagerPage />} />
          </Route>

          {/* ── Finance ─────────────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="finance" />}>
            <Route path="/finance/accounting"     element={<AccountingPage />} />
            <Route path="/finance/general-ledger" element={<GeneralLedgerPage />} />
            <Route path="/finance/journals"       element={<JournalsPage />} />
            <Route path="/finance/statements"     element={<StatementsPage />} />
            <Route path="/finance/invoicing"      element={<InvoicingPage />} />
            <Route path="/finance/recurring"      element={<RecurringInvoicesPage />} />
            <Route path="/finance/expenses"       element={<ExpensesPage />} />
            <Route path="/finance/budgeting"      element={<BudgetingPage />} />
            <Route path="/finance/tax"            element={<TaxPage />} />
            <Route path="/finance/banking"        element={<BankingPage />} />
          </Route>

          {/* ── HR ──────────────────────────────────────────────────────────── */}
          {/* Self-service is deliberately outside the HR module guard: an ordinary employee has
              no HR access at all, only the right to see their own record. */}
          <Route path="/hr/me" element={<MyHrPage />} />

          <Route element={<ModuleGuard module="hr" />}>
            <Route path="/hr/employees"   element={<EmployeesPage />} />
            <Route path="/hr/attendance"  element={<AttendancePage />} />
            <Route path="/hr/payroll"     element={<PayrollPage />} />
            <Route path="/hr/leaves"      element={<LeavesPage />} />
            <Route path="/hr/recruitment" element={<RecruitmentPage />} />
            <Route path="/hr/performance" element={<PerformancePage />} />
          </Route>

          {/* ── CRM ─────────────────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="crm" />}>
            <Route path="/crm/dashboard"  element={<CrmDashboardPage />} />
            <Route path="/crm/leads"     element={<LeadsPage />} />
            <Route path="/crm/pipeline"  element={<PipelinePage />} />
            <Route path="/crm/customers" element={<CustomersPage />} />
            <Route path="/crm/activities" element={<CrmActivitiesPage />} />
            <Route path="/crm/documents" element={<CrmDocumentsPage />} />
            <Route path="/crm/reports"   element={<CrmReportsPage />} />
          </Route>

          {/* ── Sales ───────────────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="sales" />}>
            <Route path="/sales/quotations" element={<QuotationsPage />} />
            <Route path="/sales/orders"     element={<SalesOrdersPage />} />
            <Route path="/sales/delivery-challans" element={<DeliveryChallansPage />} />
            <Route path="/sales/returns"    element={<ReturnsPage />} />
          </Route>

          {/* ── Purchase ────────────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="purchase" />}>
            <Route path="/purchase/vendors"   element={<VendorsPage />} />
            <Route path="/purchase/orders"    element={<PurchaseOrdersPage />} />
            <Route path="/purchase/grn"       element={<GrnPage />} />
            <Route path="/purchase/returns"   element={<PurchaseReturnsPage />} />
            <Route path="/purchase/bills"     element={<PurchaseBillsPage />} />
            <Route path="/purchase/approvals" element={<ApprovalsPage />} />
          </Route>

          {/* ── Inventory ───────────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="inventory" />}>
            <Route path="/inventory/warehouses"        element={<WarehousesPage />} />
            <Route path="/inventory/stock"             element={<StockPage />} />
            <Route path="/inventory/movements"         element={<MovementsPage />} />
            <Route path="/inventory/transfers"         element={<TransfersPage />} />
            <Route path="/inventory/master/categories" element={<CategoriesPage />} />
            <Route path="/inventory/master/brands"     element={<BrandsPage />} />
            <Route path="/inventory/master/uom"        element={<UomPage />} />
          </Route>

          {/* ── Real Estate ─────────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="real-estate" />}>
            <Route path="/real-estate/sales"      element={<RePipelinePage />} />
            <Route path="/real-estate/properties" element={<PropertiesPage />} />
            <Route path="/real-estate/units"      element={<UnitsPage />} />
            <Route path="/real-estate/tenants"    element={<TenantsPage />} />
            <Route path="/real-estate/contracts"  element={<ContractsPage />} />
            <Route path="/real-estate/rent-alerts" element={<RentAlertsPage />} />
            <Route path="/real-estate/brokers"    element={<BrokersPage />} />
          </Route>

          {/* ── Construction ────────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="construction" />}>
            <Route path="/construction/bidding"     element={<ConBiddingPage />} />
            <Route path="/construction/projects"    element={<ProjectsPage />} />
            <Route path="/construction/boq"         element={<BoqPage />} />
            <Route path="/construction/contractors" element={<ContractorsPage />} />
            <Route path="/construction/sites"       element={<SitesPage />} />
          </Route>

          {/* ── Healthcare pack ─────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="healthcare" />}>
            <Route path="/healthcare" element={<HealthcarePage />} />
          </Route>

          {/* ── Education pack ───────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="education" />}>
            <Route path="/education" element={<EducationPage />} />
          </Route>

          {/* ── Insurance pack ───────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="insurance" />}>
            <Route path="/insurance" element={<InsurancePage />} />
          </Route>

          {/* ── B2B Services pack ────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="b2b" />}>
            <Route path="/b2b" element={<B2BPage />} />
          </Route>

          {/* ── POS ─────────────────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="pos" />}>
            <Route path="/pos/retail"      element={<RetailPOSPage />} />
            <Route path="/pos/customers"   element={<PosCustomersPage />} />
            <Route path="/pos/restaurant"  element={<RestaurantPOSPage />} />
            <Route path="/pos/kitchen"     element={<KitchenDisplayPage />} />
            <Route path="/pos/floor-designer" element={<FloorDesignerPage />} />
            <Route path="/pos/waitlist"        element={<WaitlistPage />} />
            <Route path="/pos/reservations"    element={<ReservationsPage />} />
            <Route path="/pos/kitchen-config"  element={<KitchenConfigPage />} />
            <Route path="/pos/menu-management" element={<MenuManagementPage />} />
            <Route path="/pos/delivery"        element={<DeliveryPage />} />
            <Route path="/pos/reports"         element={<RestaurantReportsPage />} />
            <Route path="/pos/dashboards"      element={<RestaurantDashboardsPage />} />
            <Route path="/pos/branch-access"   element={<BranchAccessPage />} />
          </Route>

          {/* ── Recipe ──────────────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="recipe" />}>
            <Route path="/recipe/recipes"     element={<RecipesPage />} />
            <Route path="/recipe/ingredients" element={<IngredientsPage />} />
            <Route path="/recipe/food-cost"   element={<FoodCostPage />} />
          </Route>

          {/* ── Project Management ──────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="project-management" />}>
            <Route path="/project-management"                  element={<ProjectManagementPage />} />
            <Route path="/project-management/:projectId/board"   element={<ProjectBoardPage />} />
            <Route path="/project-management/:projectId/backlog" element={<ProjectBacklogPage />} />
            <Route path="/project-management/:projectId/issues"  element={<ProjectIssuesPage />} />
          </Route>

          {/* ── Visa Services ───────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="visa" />}>
            <Route path="/visa/dashboard" element={<VisaDashboardPage />} />
            <Route path="/visa/cases" element={<VisaCasesPage />} />
            <Route path="/visa/renewals" element={<VisaRenewalsPage />} />
            <Route path="/visa/types" element={<VisaTypesPage />} />
            <Route path="/visa/channels" element={<VisaChannelsPage />} />
          </Route>

          {/* ── Hospitality ─────────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="hospitality" />}>
            <Route path="/hospitality/bookings"     element={<BookingsPage />} />
            <Route path="/hospitality/rooms"        element={<RoomsPage />} />
            <Route path="/hospitality/housekeeping" element={<HousekeepingPage />} />
          </Route>

          {/* ── Master Data ─────────────────────────────────────────────────── */}
          <Route path="/master-data" element={<MasterDataPage />} />

          {/* ── Super Admin — super_admin only ──────────────────────────────── */}
          <Route element={<RoleGuard roles={["super_admin"]} />}>
            <Route path="/super-admin" element={<SuperAdminPage />} />
            <Route path="/super-admin/tenants/new" element={<NewTenantPage />} />
            <Route path="/super-admin/tenants/:id" element={<TenantDetailPage />} />
            {/* Platform payment accounts (Vrodux's own Stripe/PayPal) — not a tenant setting. */}
            <Route path="/super-admin/billing"     element={<PlatformBillingPage />} />
          </Route>

          {/* ── Settings — per-page permission, admin tiers always pass ─────── */}
          {/* 2FA is the signed-in user's own account, so it needs no permission at all. */}
          <Route path="/settings/security"              element={<SecurityPage />} />

          <Route element={<SettingsGuard permission="settings.general.view" />}>
            <Route path="/settings/general"             element={<GeneralSettingsPage />} />
            {/* no settings.currency key — currency is a company-wide general setting */}
            <Route path="/settings/currency"            element={<CurrencySettingsPage />} />
          </Route>
          <Route element={<SettingsGuard permission="settings.billing.view" />}>
            {/* Billing is deliberately NOT behind a module guard — an expired tenant must always
                be able to reach it to pay and restore access. */}
            <Route path="/settings/billing"             element={<BillingSettingsPage />} />
            <Route path="/billing/checkout/:outcome"    element={<CheckoutResultPage />} />
          </Route>
          <Route element={<SettingsGuard permission="settings.users.view" />}>
            <Route path="/settings/users"               element={<UsersPage />} />
            {/* no settings.teams key — a team is a grouping of users */}
            <Route path="/settings/teams"               element={<TeamsPage />} />
          </Route>
          <Route element={<SettingsGuard permission="settings.roles.view" />}>
            <Route path="/settings/roles"               element={<RolesPage />} />
          </Route>
          <Route element={<SettingsGuard permission="settings.branches.view" />}>
            <Route path="/settings/branches"            element={<BranchesPage />} />
          </Route>
          <Route element={<SettingsGuard permission="settings.integrations.view" />}>
            <Route path="/settings/integrations"        element={<IntegrationsPage />} />
          </Route>
          {/* Importing creates logins in bulk and pulls an outside system's data into this CRM —
              a workspace-owner action, so it has its own permission rather than riding on "edit". */}
          <Route element={<SettingsGuard permission="settings.integrations.import" />}>
            <Route path="/settings/property-finder"     element={<PropertyFinderPage />} />
          </Route>
          <Route element={<SettingsGuard permission="settings.audit.view" />}>
            <Route path="/settings/audit"               element={<AuditPage />} />
          </Route>

          {/* POS / Restaurant device + payment settings have no settings.* key of their own,
              so they keep the original admin/manager-only guard. */}
          <Route element={<RoleGuard roles={["super_admin", "tenant_admin", "manager"]} />}>
            <Route path="/settings/pos-payment-methods"   element={<PosPaymentMethodsPage />} />
            <Route path="/settings/payment-gateway"       element={<PaymentGatewayPage />} />
            <Route path="/settings/notifications"         element={<NotificationConfigPage />} />
            <Route path="/settings/devices"               element={<DevicesPage />} />
            <Route path="/settings/vouchers"              element={<VouchersPage />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </React.Suspense>
  );
}
