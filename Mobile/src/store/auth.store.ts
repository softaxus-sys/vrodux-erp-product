import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { decodeJwtPayload } from "@/lib/jwt";
import { getSecureItem, setSecureItem, deleteSecureItem } from "@/lib/secure-storage";
import type { AuthTokenDto, TenantClaims, UserDto } from "@/types/auth";

const SESSION_KEY = "vrodux.session";

/** Adapts expo-secure-store's async API to zustand persist's StateStorage shape. */
const secureStorage: StateStorage = {
  getItem: async (name) => (await getSecureItem(name)) ?? null,
  setItem: async (name, value) => setSecureItem(name, value),
  removeItem: async (name) => deleteSecureItem(name),
};

function buildTenantFromClaims(claims: Record<string, unknown>): TenantClaims {
  const modulesCsv = (claims["modules"] as string | undefined) ?? "";
  return {
    id: (claims["tenant_id"] as string | undefined) ?? "",
    name: (claims["tenant_name"] as string | undefined) ?? "",
    slug: (claims["tenant_slug"] as string | undefined) ?? "",
    plan: ((claims["plan"] as string | undefined) ?? "starter").toLowerCase(),
    currency: (claims["currency"] as string | undefined)?.trim().toUpperCase() || "USD",
    country: (claims["country"] as string | undefined)?.trim() ?? "",
    modules: modulesCsv ? modulesCsv.split(",").map((s) => s.trim()).filter(Boolean) : [],
    isSuperAdmin: claims["is_super_admin"] === "true",
    subscriptionState: claims["subscription_state"] as string | undefined,
    trialDaysLeft:
      claims["trial_days_left"] !== undefined && claims["trial_days_left"] !== null
        ? Number(claims["trial_days_left"])
        : undefined,
  };
}

/**
 * Permission keys already come out of the JWT as the *effective* set --
 * (role permissions ∪ user grants) − user denies, computed server-side at
 * the PermissionRepository chokepoint (see CLAUDE.md Module 5h). Reading
 * them straight from the token here is correct and avoids re-deriving the
 * merge client-side.
 */
function extractPermissionsFromClaims(claims: Record<string, unknown>): string[] {
  const raw = claims["permission"];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return [raw];
  return [];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserDto | null;
  tenant: TenantClaims | null;
  permissions: string[];
  /** Set only between "password accepted" and "2FA code submitted" -- never persisted. */
  mfaToken: string | null;
  isAuthenticated: boolean;
  /** True once the persisted session has been read back from SecureStore on app start. */
  hasHydrated: boolean;

  setSessionFromAuthResult: (auth: AuthTokenDto) => void;
  setMfaToken: (token: string | null) => void;
  setAccessToken: (token: string) => void;
  setRefreshToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      tenant: null,
      permissions: [],
      mfaToken: null,
      isAuthenticated: false,
      hasHydrated: false,

      setSessionFromAuthResult: (auth) => {
        const claims = decodeJwtPayload(auth.accessToken);
        set({
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          user: auth.user,
          tenant: claims["tenant_id"] ? buildTenantFromClaims(claims) : null,
          permissions: extractPermissionsFromClaims(claims),
          mfaToken: null,
          isAuthenticated: true,
        });
      },

      setMfaToken: (token) => set({ mfaToken: token }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          tenant: null,
          permissions: [],
          mfaToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: SESSION_KEY,
      storage: createJSONStorage(() => secureStorage),
      // mfaToken is a short-lived, in-memory-only handoff between the two login
      // steps -- persisting it would let a stale one survive an app restart.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        tenant: state.tenant,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setAccessToken; // no-op read to satisfy TS about state being defined
        useAuthStore.setState({ hasHydrated: true });
      },
    }
  )
);

/** True if any of the caller's permission keys is present -- mirrors web's hasRawPermission. */
export function hasPermission(...anyOf: string[]): boolean {
  const { permissions, tenant } = useAuthStore.getState();
  if (tenant?.isSuperAdmin) return true;
  return anyOf.some((key) => permissions.includes(key));
}

/** True if the tenant's plan/onboarding includes this module -- mirrors web's hasModuleAccess step 3. */
export function hasModuleAccess(moduleKey: string): boolean {
  const { tenant } = useAuthStore.getState();
  if (!tenant) return false;
  if (tenant.isSuperAdmin) return true;
  return tenant.modules.includes(moduleKey);
}
