import * as React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import type { ModuleKey } from "@/types";
import { ErpLayout } from "@/components/layout/layouts/erp-layout";

// ── Auth ──────────────────────────────────────────────────────────────────────
const LoginPage          = React.lazy(() => import("@/pages/auth/login"));
const ForgotPasswordPage = React.lazy(() => import("@/pages/auth/forgot-password"));
const ResetPasswordPage  = React.lazy(() => import("@/pages/auth/reset-password"));

// ── Core ──────────────────────────────────────────────────────────────────────
const DashboardPage        = React.lazy(() => import("@/pages/dashboard"));
const AiAssistantPage      = React.lazy(() => import("@/pages/ai-assistant"));
const ReportsPage          = React.lazy(() => import("@/pages/reports"));
const FileManagerPage      = React.lazy(() => import("@/pages/file-manager"));
const ProfilePage          = React.lazy(() => import("@/pages/profile"));

// ── Finance ───────────────────────────────────────────────────────────────────
const AccountingPage       = React.lazy(() => import("@/pages/finance/accounting"));
const GeneralLedgerPage    = React.lazy(() => import("@/pages/finance/general-ledger"));
const JournalsPage         = React.lazy(() => import("@/pages/finance/journals"));
const StatementsPage       = React.lazy(() => import("@/pages/finance/statements"));
const InvoicingPage        = React.lazy(() => import("@/pages/finance/invoicing"));
const RecurringInvoicesPage = React.lazy(() => import("@/pages/finance/recurring"));
const ExpensesPage         = React.lazy(() => import("@/pages/finance/expenses"));
const BudgetingPage        = React.lazy(() => import("@/pages/finance/budgeting"));
const TaxPage              = React.lazy(() => import("@/pages/finance/tax"));
const BankingPage          = React.lazy(() => import("@/pages/finance/banking"));

// ── HR ────────────────────────────────────────────────────────────────────────
const EmployeesPage        = React.lazy(() => import("@/pages/hr/employees"));
const AttendancePage       = React.lazy(() => import("@/pages/hr/attendance"));
const PayrollPage          = React.lazy(() => import("@/pages/hr/payroll"));
const LeavesPage           = React.lazy(() => import("@/pages/hr/leaves"));
const RecruitmentPage      = React.lazy(() => import("@/pages/hr/recruitment"));
const PerformancePage      = React.lazy(() => import("@/pages/hr/performance"));

// ── CRM ───────────────────────────────────────────────────────────────────────
const CrmDashboardPage     = React.lazy(() => import("@/pages/crm/dashboard"));
const LeadsPage            = React.lazy(() => import("@/pages/crm/leads"));
const PipelinePage         = React.lazy(() => import("@/pages/crm/pipeline"));
const CustomersPage        = React.lazy(() => import("@/pages/crm/customers"));
const CrmActivitiesPage    = React.lazy(() => import("@/pages/crm/activities"));

// ── Sales ─────────────────────────────────────────────────────────────────────
const QuotationsPage       = React.lazy(() => import("@/pages/sales/quotations"));
const SalesOrdersPage      = React.lazy(() => import("@/pages/sales/orders"));
const ReturnsPage          = React.lazy(() => import("@/pages/sales/returns"));
const DeliveryChallansPage = React.lazy(() => import("@/pages/sales/delivery-challans"));

// ── Purchase ──────────────────────────────────────────────────────────────────
const VendorsPage          = React.lazy(() => import("@/pages/purchase/vendors"));
const PurchaseOrdersPage   = React.lazy(() => import("@/pages/purchase/orders"));
const ApprovalsPage        = React.lazy(() => import("@/pages/purchase/approvals"));
const GrnPage              = React.lazy(() => import("@/pages/purchase/grn"));
const PurchaseReturnsPage  = React.lazy(() => import("@/pages/purchase/returns"));
const PurchaseBillsPage    = React.lazy(() => import("@/pages/purchase/bills"));

// ── Inventory ─────────────────────────────────────────────────────────────────
const WarehousesPage       = React.lazy(() => import("@/pages/inventory/warehouses"));
const StockPage            = React.lazy(() => import("@/pages/inventory/stock"));
const MovementsPage        = React.lazy(() => import("@/pages/inventory/movements"));
const TransfersPage        = React.lazy(() => import("@/pages/inventory/transfers"));
const CategoriesPage       = React.lazy(() => import("@/pages/inventory/master/categories"));
const BrandsPage           = React.lazy(() => import("@/pages/inventory/master/brands"));
const UomPage              = React.lazy(() => import("@/pages/inventory/master/uom"));

// ── Real Estate ───────────────────────────────────────────────────────────────
const PropertiesPage       = React.lazy(() => import("@/pages/real-estate/properties"));
const UnitsPage            = React.lazy(() => import("@/pages/real-estate/units"));
const TenantsPage          = React.lazy(() => import("@/pages/real-estate/tenants"));
const ContractsPage        = React.lazy(() => import("@/pages/real-estate/contracts"));
const BrokersPage          = React.lazy(() => import("@/pages/real-estate/brokers"));
const RePipelinePage       = React.lazy(() => import("@/pages/real-estate/sales"));

// ── Construction ──────────────────────────────────────────────────────────────
const ConBiddingPage       = React.lazy(() => import("@/pages/construction/bidding"));
const HealthcarePage       = React.lazy(() => import("@/pages/healthcare"));
const EducationPage        = React.lazy(() => import("@/pages/education"));
const InsurancePage        = React.lazy(() => import("@/pages/insurance"));
const B2BPage              = React.lazy(() => import("@/pages/b2b"));
const ProjectsPage         = React.lazy(() => import("@/pages/construction/projects"));
const BoqPage              = React.lazy(() => import("@/pages/construction/boq"));
const ContractorsPage      = React.lazy(() => import("@/pages/construction/contractors"));
const SitesPage            = React.lazy(() => import("@/pages/construction/sites"));

// ── POS ───────────────────────────────────────────────────────────────────────
const RetailPOSPage        = React.lazy(() => import("@/pages/pos/retail"));
const RestaurantPOSPage    = React.lazy(() => import("@/pages/pos/restaurant"));
const KitchenDisplayPage   = React.lazy(() => import("@/pages/pos/kitchen"));

// ── Recipe ────────────────────────────────────────────────────────────────────
const RecipesPage          = React.lazy(() => import("@/pages/recipe/recipes"));
const IngredientsPage      = React.lazy(() => import("@/pages/recipe/ingredients"));

// ── Project Management ──────────────────────────────────────────────────────
const ProjectManagementPage = React.lazy(() => import("@/pages/project-management/index"));
const ProjectBoardPage      = React.lazy(() => import("@/pages/project-management/board"));
const ProjectBacklogPage    = React.lazy(() => import("@/pages/project-management/backlog"));
const ProjectIssuesPage     = React.lazy(() => import("@/pages/project-management/issues"));

// ── Hospitality ───────────────────────────────────────────────────────────────
const BookingsPage         = React.lazy(() => import("@/pages/hospitality/bookings"));
const RoomsPage            = React.lazy(() => import("@/pages/hospitality/rooms"));
const HousekeepingPage     = React.lazy(() => import("@/pages/hospitality/housekeeping"));

// ── Settings ──────────────────────────────────────────────────────────────────
const GeneralSettingsPage  = React.lazy(() => import("@/pages/settings/general"));
const UsersPage            = React.lazy(() => import("@/pages/settings/users"));
const RolesPage            = React.lazy(() => import("@/pages/settings/roles"));
const BranchesPage         = React.lazy(() => import("@/pages/settings/branches"));
const IntegrationsPage     = React.lazy(() => import("@/pages/settings/integrations"));
const AuditPage            = React.lazy(() => import("@/pages/settings/audit"));
const AppearancePage       = React.lazy(() => import("@/pages/settings/appearance"));
const PosPaymentMethodsPage = React.lazy(() => import("@/pages/settings/pos-payment-methods"));
const VouchersPage          = React.lazy(() => import("@/pages/settings/vouchers"));

// ── Master Data ───────────────────────────────────────────────────────────────
const MasterDataPage       = React.lazy(() => import("@/pages/master-data"));

// ── Onboarding / Trial ────────────────────────────────────────────────────────
const OnboardingPage            = React.lazy(() => import("@/pages/trial/onboarding"));

// ── Careers (public) ─────────────────────────────────────────────────────────
const CareersJobsPage           = React.lazy(() => import("@/pages/careers/jobs"));
const CareersJobDetailPage      = React.lazy(() => import("@/pages/careers/job-detail"));

// ── Super Admin ───────────────────────────────────────────────────────────────
const SuperAdminPage            = React.lazy(() => import("@/pages/super-admin/index"));
const NewTenantPage             = React.lazy(() => import("@/pages/super-admin/new-tenant"));
const TenantDetailPage          = React.lazy(() => import("@/pages/super-admin/tenant-detail"));
const SubscriptionExpiredPage   = React.lazy(() => import("@/pages/subscription-expired"));

// ── Guards ───────────────────────────────────────────────────────────────────

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

function GuestGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
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
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

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
        <Route path="/trial"                element={<OnboardingPage />} />

        {/* Subscription expired — shown when enforcement middleware blocks requests */}
        <Route path="/subscription-expired" element={<SubscriptionExpiredPage />} />

        {/* Careers portal — fully public, no auth */}
        <Route path="/careers/:tenantSlug" element={<CareersJobsPage />} />
        <Route path="/careers/:tenantSlug/jobs/:jobId" element={<CareersJobDetailPage />} />

        {/* ERP (authenticated) — layout wraps all children */}
        <Route
          element={
            <AuthGuard>
              <ErpLayout />
            </AuthGuard>
          }
        >
          {/* ── Always accessible ───────────────────────────────────────────── */}
          <Route path="/dashboard"    element={<DashboardPage />} />
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
            <Route path="/pos/restaurant"  element={<RestaurantPOSPage />} />
            <Route path="/pos/kitchen"     element={<KitchenDisplayPage />} />
          </Route>

          {/* ── Recipe ──────────────────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="recipe" />}>
            <Route path="/recipe/recipes"     element={<RecipesPage />} />
            <Route path="/recipe/ingredients" element={<IngredientsPage />} />
          </Route>

          {/* ── Project Management ──────────────────────────────────────────── */}
          <Route element={<ModuleGuard module="project-management" />}>
            <Route path="/project-management"                  element={<ProjectManagementPage />} />
            <Route path="/project-management/:projectId/board"   element={<ProjectBoardPage />} />
            <Route path="/project-management/:projectId/backlog" element={<ProjectBacklogPage />} />
            <Route path="/project-management/:projectId/issues"  element={<ProjectIssuesPage />} />
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
          </Route>

          {/* ── Settings — admin/manager only ───────────────────────────────── */}
          <Route element={<RoleGuard roles={["super_admin", "tenant_admin", "manager"]} />}>
            <Route path="/settings/general"               element={<GeneralSettingsPage />} />
            <Route path="/settings/pos-payment-methods"   element={<PosPaymentMethodsPage />} />
            <Route path="/settings/vouchers"              element={<VouchersPage />} />
            <Route path="/settings/users"                 element={<UsersPage />} />
            <Route path="/settings/roles"                 element={<RolesPage />} />
            <Route path="/settings/branches"              element={<BranchesPage />} />
            <Route path="/settings/integrations"          element={<IntegrationsPage />} />
            <Route path="/settings/audit"                 element={<AuditPage />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </React.Suspense>
  );
}
