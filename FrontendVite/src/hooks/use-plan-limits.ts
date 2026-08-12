/**
 * usePlanLimits — reads the current user's plan from the auth store JWT payload
 * and returns plan limits for UI enforcement (disabled buttons, upgrade prompts).
 *
 * Note: hard enforcement happens on the backend. This is UI-only.
 */

import { useAuthStore } from "@/store/auth.store";
import { planLimits, type PlanType } from "@/lib/admin/tenants.api";

export interface PlanLimitsResult {
  plan: PlanType | null;
  isSuperAdmin: boolean;
  maxUsers: number;           // -1 = unlimited
  maxWarehouses: number;      // -1 = unlimited
  canAddUser: (currentCount: number) => boolean;
  canAddWarehouse: (currentCount: number) => boolean;
  hasFeature: (feature: "multiCurrency" | "apiAccess" | "customReports" | "whiteLabel") => boolean;
}

/** Mirrors the backend `PlanDefinitions` feature flags. "Business" is the legacy Professional. */
const FEATURE_MAP: Record<string, Record<PlanType, boolean>> = {
  multiCurrency: { Micro: false, Starter: false, Professional: true,  Enterprise: true, Business: true },
  apiAccess:     { Micro: false, Starter: false, Professional: true,  Enterprise: true, Business: true },
  customReports: { Micro: false, Starter: false, Professional: true,  Enterprise: true, Business: true },
  whiteLabel:    { Micro: false, Starter: false, Professional: true,  Enterprise: true, Business: true },
};

/** JWT `plan` claim is lower-cased by the auth store; map it back to the catalogue key. */
function normalisePlan(raw: string): PlanType | null {
  switch (raw.trim().toLowerCase()) {
    case "micro":        return "Micro";
    case "starter":      return "Starter";
    case "professional": return "Professional";
    case "business":     return "Business";       // legacy, pre-rename tokens
    case "enterprise":   return "Enterprise";
    default:             return null;
  }
}

export function usePlanLimits(): PlanLimitsResult {
  const tenant      = useAuthStore(s => s.tenant);
  const isSuperAdmin = (tenant?.plan ?? "").toLowerCase() === "super_admin" ||
                       !!useAuthStore.getState().user?.role && useAuthStore.getState().user?.role === "super_admin";

  // Derive plan from tenant store (set during login from JWT claims).
  //
  // Unknown names used to fall through to "Enterprise", which after the Micro/Professional rename
  // silently handed every renamed tenant UNLIMITED seats in the UI. Enterprise is now only used
  // when the plan is genuinely absent (e.g. a super-admin token carries no tenant); a name we
  // don't recognise resolves through planLimits() to a zero-limit row instead of the top tier.
  const rawPlan = (tenant?.plan ?? "").toString();
  const plan: PlanType = normalisePlan(rawPlan) ?? "Enterprise";
  const limits = planLimits(plan);

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
