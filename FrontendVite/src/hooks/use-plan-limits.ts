/**
 * usePlanLimits — reads the current user's plan from the auth store JWT payload
 * and returns plan limits for UI enforcement (disabled buttons, upgrade prompts).
 *
 * Note: hard enforcement happens on the backend. This is UI-only.
 */

import { useAuthStore } from "@/store/auth.store";
import { PLAN_LIMITS, type PlanType } from "@/lib/admin/tenants.api";

export interface PlanLimitsResult {
  plan: PlanType | null;
  isSuperAdmin: boolean;
  maxUsers: number;           // -1 = unlimited
  maxWarehouses: number;      // -1 = unlimited
  canAddUser: (currentCount: number) => boolean;
  canAddWarehouse: (currentCount: number) => boolean;
  hasFeature: (feature: "multiCurrency" | "apiAccess" | "customReports" | "whiteLabel") => boolean;
}

const FEATURE_MAP: Record<string, Record<PlanType, boolean>> = {
  multiCurrency: { Starter: false, Business: false,  Enterprise: true },
  apiAccess:     { Starter: false, Business: false,  Enterprise: true },
  customReports: { Starter: false, Business: false,  Enterprise: true },
  whiteLabel:    { Starter: false, Business: true,   Enterprise: true },
};

export function usePlanLimits(): PlanLimitsResult {
  const tenant      = useAuthStore(s => s.tenant);
  const isSuperAdmin = (tenant?.plan ?? "").toLowerCase() === "super_admin" ||
                       !!useAuthStore.getState().user?.role && useAuthStore.getState().user?.role === "super_admin";

  // Derive plan from tenant store (set during login from JWT claims)
  const rawPlan = (tenant?.plan ?? "enterprise") as string;
  const plan: PlanType =
    rawPlan === "Starter" || rawPlan === "starter" ? "Starter" :
    rawPlan === "Business" || rawPlan === "business" ? "Business" :
    "Enterprise";

  const limits = PLAN_LIMITS[plan];

  return {
    plan,
    isSuperAdmin,
    maxUsers:      limits.maxUsers,
    maxWarehouses: limits.maxWarehouses,

    canAddUser: (currentCount) =>
      isSuperAdmin || limits.maxUsers < 0 || currentCount < limits.maxUsers,

    canAddWarehouse: (currentCount) =>
      isSuperAdmin || limits.maxWarehouses < 0 || currentCount < limits.maxWarehouses,

    hasFeature: (feature) =>
      isSuperAdmin || FEATURE_MAP[feature]?.[plan] === true,
  };
}
