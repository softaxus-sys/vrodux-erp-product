// ─── Core Domain Types ───────────────────────────────────────────────────────

export type ID = string;

export type Status =
  | "active"
  | "inactive"
  | "pending"
  | "draft"
  | "cancelled"
  | "completed"
  | "suspended";

export type Currency = string;

export type Language = "en" | "ar";

export type Direction = "ltr" | "rtl";

// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole =
  | "super_admin"
  | "tenant_admin"
  | "manager"
  | "accountant"
  | "hr_manager"
  | "sales_rep"
  | "purchase_officer"
  | "warehouse_manager"
  | "viewer"
  | "custom";

export interface User {
  id: ID;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  /** Actual backend role display name (e.g. "Administrator", "CRM Manager") — shown in the UI. */
  roleName?: string;
  tenantId: ID;
  branchIds: ID[];
  permissions: Permission[];
  preferences: UserPreferences;
  status: Status;
  lastLogin?: string;
  createdAt: string;
}

export interface UserPreferences {
  language: Language;
  theme: "light" | "dark" | "system";
  dateFormat: string;
  currency: Currency;
  timezone: string;
  sidebarCollapsed: boolean;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  sms: boolean;
}

// ─── Tenant / Multi-tenancy ───────────────────────────────────────────────────

export interface Tenant {
  id: ID;
  name: string;
  slug: string;
  logo?: string;
  industry: Industry;
  currency: Currency;
  country: string;
  timezone: string;
  plan: TenantPlan;
  status: Status;
  /** Industry vertical code from the JWT `industry` claim (e.g. "real_estate"). Drives the active Industry Pack. */
  vertical?: string;
  enabledModules: ModuleKey[];
  branding: TenantBranding;
  settings: TenantSettings;
  createdAt: string;
}

export interface TenantBranding {
  primaryColor: string;
  logo?: string;
  favicon?: string;
  companyName: string;
  tagline?: string;
}

export interface TenantSettings {
  fiscalYearStart: number; // month 1-12
  vatEnabled: boolean;
  vatNumber?: string;
  defaultCurrency: Currency;
  multiCurrency: boolean;
  defaultLanguage: Language;
  rtlEnabled: boolean;
}

export type TenantPlan = "starter" | "professional" | "enterprise" | "custom";

// ─── Permissions / RBAC ──────────────────────────────────────────────────────

export type Permission = `${ModuleKey}:${"read" | "write" | "delete" | "admin"}`;

export type ModuleKey =
  | "dashboard"
  | "finance"
  | "hr"
  | "crm"
  | "sales"
  | "purchase"
  | "inventory"
  | "real-estate"
  | "construction"
  | "hospitality"
  | "healthcare"
  | "pos"
  | "recipe"
  | "reports"
  | "settings"
  | "users"
  | "ai-assistant"
  | "notifications"
  | "file-manager"
  | "super-admin"
  | "restaurant"
  | "education"
  | "insurance"
  | "b2b"
  | "project-management"
  | "visa";

export type Industry =
  | "real-estate"
  | "construction"
  | "hospitality"
  | "restaurant"
  | "retail"
  | "trading"
  | "healthcare"
  | "warehouse"
  | "manufacturing"
  | "education"
  | "services"
  | "financial"
  | "multi-company"
  | "other";

// ─── Navigation ──────────────────────────────────────────────────────────────

export interface NavItem {
  id: string;
  label: string;
  labelAr?: string;
  href?: string;
  icon?: string;
  badge?: string | number;
  badgeVariant?: "default" | "success" | "warning" | "destructive";
  children?: NavItem[];
  permission?: Permission;
  module?: ModuleKey;
  isNew?: boolean;
  isBeta?: boolean;
  separator?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  labelAr?: string;
  items: NavItem[];
}

// ─── Common Data Patterns ────────────────────────────────────────────────────

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  emirate?: string; // UAE specific
}

export interface ContactInfo {
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  fax?: string;
}

export interface Audit {
  createdAt: string;
  createdBy: ID;
  createdByName: string;
  updatedAt: string;
  updatedBy: ID;
  updatedByName: string;
}

export interface Money {
  amount: number;
  currency: Currency;
}

export interface DateRange {
  from: string;
  to: string;
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
  success: boolean;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface QueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string | number | boolean | string[]>;
  dateRange?: DateRange;
}

// ─── Dashboard & Analytics ───────────────────────────────────────────────────

export interface KpiCard {
  id: string;
  label: string;
  value: number | string;
  previousValue?: number | string;
  change?: number;
  changeType?: "increase" | "decrease" | "neutral";
  changeLabel?: string;
  currency?: Currency;
  format?: "number" | "currency" | "percentage" | "text";
  icon?: string;
  color?: "primary" | "success" | "warning" | "destructive" | "info";
  trend?: ChartDataPoint[];
}

export interface ChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  date?: string;
}

export interface ActivityItem {
  id: ID;
  type: string;
  title: string;
  description?: string;
  user: string;
  userAvatar?: string;
  timestamp: string;
  module: ModuleKey;
  entityId?: ID;
  entityType?: string;
}

export interface Notification {
  id: ID;
  type: "info" | "success" | "warning" | "error" | "mention";
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  actionUrl?: string;
  actionLabel?: string;
  module?: ModuleKey;
}

