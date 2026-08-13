import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/admin/tenants`;
const LICENSE_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/license`;

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Public tiers (see backend `PlanType`). `Business` is the legacy name for what is now
 * `Professional`, and the legacy `Starter` (3 seats) became `Micro`; both are kept so a tenant
 * row written before the rename migration still resolves instead of crashing the console.
 */
export type PlanType =
  | "Micro" | "Starter" | "Professional" | "Enterprise"
  | "Business";   // legacy — pre-rename rows only
export type DeploymentType = "Cloud" | "OnPremises";
export type TenantStatus   = "Trial" | "Active" | "Suspended" | "Expired";

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  plan: PlanType;
  deploymentType: DeploymentType;
  status: TenantStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  country: string | null;
  primaryColor: string | null;
  industry: string | null;
  hasLicenseKey: boolean;
  licenseExpiresAt: string | null;
  lastHeartbeatAt: string | null;
  trialEndsAt: string | null;
  maxUsers: number;
  maxWarehouses: number;
  /** Resolved module list: custom override if set, else plan defaults. */
  resolvedModules: string[];
  createdAt: string;
  /** Only populated for tenants listed from the recycle bin; null on a live tenant. */
  deletedAt?: string | null;
}

/** Pass null to reset to plan defaults. */
export interface SetModulesRequest {
  modules: string[] | null;
}

export interface UserCountDto {
  tenantId: string;
  count: number;
  maxUsers: number;
  remaining: number;
  atLimit: boolean;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  plan: PlanType;
  deploymentType: DeploymentType;
  contactEmail?: string;
  country?: string;
  /** Industry vertical — activates the matching Industry Pack (empty = generic CRM). */
  industry?: string;
  startTrial?: boolean;
  /** Optional: provision the tenant's first admin login user in the same call. */
  adminEmail?: string;
  adminUsername?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPassword?: string;
}

export interface UpdateTenantRequest {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  country?: string;
  primaryColor?: string;
}

export interface GenerateLicenseRequest {
  validityDays: number;
  features: string[];
}

export interface GenerateLicenseResponse {
  licenseKey: string;
  expiresAt: string;
}

export interface SetConnectionStringsRequest {
  identityDb: string;
  posDb: string;
  inventoryDb: string;
}

/** Cloud tenants: set new subscription expiry date (also activates the account). */
export interface RenewSubscriptionRequest {
  /** ISO 8601 UTC date — must be in the future */
  expiresAt: string;
}

// ── API client ────────────────────────────────────────────────────────────────

export const tenantsAdminApi = {
  getAll: (): Promise<TenantDto[]> =>
    apiClient.get(BASE),

  getById: (id: string): Promise<TenantDto> =>
    apiClient.get(`${BASE}/${id}`),

  create: (req: CreateTenantRequest): Promise<TenantDto> =>
    apiClient.post(BASE, req),

  update: (id: string, req: UpdateTenantRequest): Promise<TenantDto> =>
    apiClient.put(`${BASE}/${id}`, req),

  changePlan: (id: string, plan: PlanType): Promise<TenantDto> =>
    apiClient.patch(`${BASE}/${id}/plan`, { plan }),

  setIndustry: (id: string, industry: string | null): Promise<TenantDto> =>
    apiClient.patch(`${BASE}/${id}/industry`, { industry }),

  activate: (id: string): Promise<TenantDto> =>
    apiClient.patch(`${BASE}/${id}/activate`),

  suspend: (id: string): Promise<TenantDto> =>
    apiClient.patch(`${BASE}/${id}/suspend`),

  generateLicense: (id: string, req: GenerateLicenseRequest): Promise<GenerateLicenseResponse> =>
    apiClient.post(`${BASE}/${id}/license`, req),

  setConnectionStrings: (id: string, req: SetConnectionStringsRequest): Promise<TenantDto> =>
    apiClient.put(`${BASE}/${id}/connection-strings`, req),

  getUserCount: (id: string): Promise<UserCountDto> =>
    apiClient.get(`${BASE}/${id}/users/count`),

  /** Cloud tenants: set expiry + auto-activate */
  renewSubscription: (id: string, req: RenewSubscriptionRequest): Promise<TenantDto> =>
    apiClient.patch(`${BASE}/${id}/subscription`, req),

  /** Force-expire a tenant immediately (cloud or on-prem) */
  expire: (id: string): Promise<TenantDto> =>
    apiClient.patch(`${BASE}/${id}/expire`),

  /**
   * Set a custom module list for a tenant.
   * Pass { modules: null } to reset to plan defaults.
   */
  setModules: (id: string, req: SetModulesRequest): Promise<TenantDto> =>
    apiClient.patch(`${BASE}/${id}/modules`, req),

  /** Soft delete — recoverable from the recycle bin below. */
  delete: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/${id}`),

  // ── Recycle bin ──────────────────────────────────────────────────────────
  /** Soft-deleted tenants. Their data is intact; they're just hidden and blocked from login. */
  getDeleted: (): Promise<TenantDto[]> =>
    apiClient.get(`${BASE}/deleted`),

  restore: (id: string): Promise<void> =>
    apiClient.post(`${BASE}/${id}/restore`, {}),

  /** Irreversible. Only valid for a tenant already in the recycle bin. */
  purge: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/${id}/purge`),

  /** Super-admin: get a tenant-scoped token to view/operate the app AS this tenant. */
  impersonate: (id: string): Promise<ImpersonationResult> =>
    apiClient.post(`${BASE}/${id}/impersonate`),
};

export interface ImpersonationResult {
  accessToken: string;
  tenantId:    string;
  tenantName:  string;
  tenantSlug:  string;
}

export const licenseApi = {
  validate: (licenseKey: string): Promise<unknown> =>
    apiClient.post(`${LICENSE_BASE}/validate`, { licenseKey }),
};

// ── Plan metadata ─────────────────────────────────────────────────────────────

export interface PlanLimitMeta {
  maxUsers: number;        // -1 = unlimited
  maxWarehouses: number;   // -1 = unlimited
  label: string;
  color: string;
}

/** Mirrors the backend `PlanDefinitions`. Keep the two in step. */
export const PLAN_LIMITS: Record<PlanType, PlanLimitMeta> = {
  Micro:        { maxUsers: 3,  maxWarehouses: 1,  label: "Micro",        color: "#6b7280" },
  Starter:      { maxUsers: 10, maxWarehouses: 2,  label: "Starter",      color: "#0ea5e9" },
  Professional: { maxUsers: 50, maxWarehouses: 10, label: "Professional", color: "#3b82f6" },
  Enterprise:   { maxUsers: -1, maxWarehouses: -1, label: "Enterprise",   color: "#8b5cf6" },

  // Legacy alias: pre-rename rows still say "Business". Mapped to Professional's limits,
  // matching how the backend migration re-pointed them.
  Business:     { maxUsers: 50, maxWarehouses: 10, label: "Professional", color: "#3b82f6" },
};

/**
 * Safe lookup. Never returns undefined.
 *
 * A bare `PLAN_LIMITS[tenant.plan]` crashed the super-admin console the moment the backend
 * started returning the renamed tiers — an unknown plan name must degrade to a sane row, not
 * take the page down.
 */
export function planLimits(plan: string | null | undefined): PlanLimitMeta {
  if (plan && plan in PLAN_LIMITS) return PLAN_LIMITS[plan as PlanType];
  return { maxUsers: 0, maxWarehouses: 0, label: plan || "Unknown", color: "#6b7280" };
}
