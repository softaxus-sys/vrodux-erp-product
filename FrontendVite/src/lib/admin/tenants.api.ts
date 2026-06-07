import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/admin/tenants`;
const LICENSE_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/license`;

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanType       = "Starter" | "Business" | "Enterprise";
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

  delete: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/${id}`),
};

export const licenseApi = {
  validate: (licenseKey: string): Promise<unknown> =>
    apiClient.post(`${LICENSE_BASE}/validate`, { licenseKey }),
};

// ── Plan metadata ─────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<PlanType, { maxUsers: number; maxWarehouses: number; label: string; color: string }> = {
  Starter:    { maxUsers: 3,  maxWarehouses: 1,  label: "Starter",    color: "#6b7280" },
  Business:   { maxUsers: 15, maxWarehouses: 3,  label: "Business",   color: "#3b82f6" },
  Enterprise: { maxUsers: -1, maxWarehouses: -1, label: "Enterprise", color: "#8b5cf6" },
};
