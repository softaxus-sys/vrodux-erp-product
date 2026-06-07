import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User, Tenant, Permission, ModuleKey, UserRole } from "@/types";
import type { UserDto } from "@/lib/identity/types";
import { authApi } from "@/lib/identity/auth.api";

// ── User mapping helpers ──────────────────────────────────────────────────────

/** Map a backend role name to a frontend UserRole enum value. */
function toUserRole(roleName: string): UserRole {
  const n = roleName.toLowerCase().replace(/[\s_-]+/g, "_");
  const map: Record<string, UserRole> = {
    super_admin:        "super_admin",
    superadmin:         "super_admin",
    administrator:      "tenant_admin",
    admin:              "tenant_admin",
    tenant_admin:       "tenant_admin",
    manager:            "manager",
    accountant:         "accountant",
    hr_manager:         "hr_manager",
    hrmanager:          "hr_manager",
    sales_rep:          "sales_rep",
    sales_representative:"sales_rep",
    cashier:            "sales_rep",
    purchase_officer:   "purchase_officer",
    purchaseofficer:    "purchase_officer",
    warehouse_manager:  "warehouse_manager",
    warehousemanager:   "warehouse_manager",
    viewer:             "viewer",
  };
  return map[n] ?? "custom";
}

/**
 * Convert backend permission key format ("pos.read") to frontend format ("pos:read").
 * Filters out any keys that don't match the expected pattern.
 */
function toFrontendPermission(key: string): Permission | null {
  const [module, action] = key.split(".");
  if (!module || !action) return null;
  const validActions = ["read", "write", "delete", "admin"];
  if (!validActions.includes(action)) return null;
  return `${module}:${action}` as Permission;
}

/** Build a frontend User from a backend UserDto. */
export function mapUserDto(dto: UserDto): User {
  const primaryRole = dto.roles[0];
  const allPermissions: Permission[] = [];

  for (const role of dto.roles) {
    for (const perm of role.permissions) {
      const mapped = toFrontendPermission(perm.key);
      if (mapped && !allPermissions.includes(mapped)) {
        allPermissions.push(mapped);
      }
    }
  }

  return {
    id: dto.id,
    email: dto.email,
    name: dto.fullName,
    avatar: dto.avatarUrl ?? undefined,
    role: primaryRole ? toUserRole(primaryRole.name) : "custom",
    tenantId: "softaxis-erp",          // single-tenant for now
    branchIds: [],
    permissions: allPermissions,
    preferences: {
      language: "en",
      theme: "system",
      dateFormat: "DD/MM/YYYY",
      currency: "PKR",
      timezone: "Asia/Karachi",
      sidebarCollapsed: false,
      notifications: { email: true, inApp: true, sms: false },
    },
    status: dto.status.toLowerCase() === "active" ? "active" : "inactive",
    lastLogin: dto.lastLoginAt ?? undefined,
    createdAt: dto.createdAt,
  };
}

/** Default Softaxis tenant (single-tenant deployment). */
const DEFAULT_TENANT: Tenant = {
  id: "softaxis-erp",
  name: "Softaxis ERP",
  slug: "softaxis",
  industry: "retail",
  currency: "PKR",
  country: "Pakistan",
  timezone: "Asia/Karachi",
  plan: "enterprise",
  status: "active",
  enabledModules: [
    "dashboard", "pos", "inventory", "finance", "hr", "crm",
    "sales", "purchase", "reports", "settings", "users",
    "notifications", "file-manager",
  ] as ModuleKey[],
  branding: {
    primaryColor: "#2563eb",
    companyName: "Softaxis ERP",
    tagline: "Smarter Business, Simpler Operations",
  },
  settings: {
    fiscalYearStart: 7,
    vatEnabled: false,
    defaultCurrency: "PKR" as any,
    multiCurrency: false,
    defaultLanguage: "en",
    rtlEnabled: false,
  },
  createdAt: "2024-01-01T00:00:00Z",
};

// ── Store interface ───────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User) => void;
  setTenant: (tenant: Tenant) => void;
  setToken: (token: string) => void;
  setRefreshToken: (token: string) => void;

  /** Called after a successful Identity.API /login response. */
  loginFromApi: (accessToken: string, refreshToken: string, userDto: UserDto) => void;

  /** Legacy / mock login (kept for fallback/testing). */
  login: (user: User, tenant: Tenant, token: string) => void;

  logout: () => Promise<void>;
  updateUser: (userDto: UserDto) => void;
  updatePreferences: (preferences: Partial<User["preferences"]>) => void;

  // Permission helpers
  hasPermission: (permission: Permission) => boolean;
  hasModuleAccess: (module: ModuleKey) => boolean;
  isRole: (role: User["role"] | User["role"][]) => boolean;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setUser:         (user)         => set({ user }),
      setTenant:       (tenant)       => set({ tenant }),
      setToken:        (token)        => set({ token }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),

      loginFromApi: (accessToken, refreshToken, userDto) =>
        set({
          token:           accessToken,
          refreshToken:    refreshToken,
          user:            mapUserDto(userDto),
          tenant:          DEFAULT_TENANT,
          isAuthenticated: true,
        }),

      login: (user, tenant, token) =>
        set({ user, tenant, token, refreshToken: null, isAuthenticated: true }),

      logout: async () => {
        const { refreshToken, token } = get();
        // Best-effort revoke — never block the UI on failure
        if (refreshToken && token) {
          try { await authApi.revoke(refreshToken, token); } catch { /* ignore */ }
        }
        set({
          user:            null,
          tenant:          null,
          token:           null,
          refreshToken:    null,
          isAuthenticated: false,
        });
      },

      updateUser: (userDto) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...mapUserDto(userDto) } : null,
        })),

      updatePreferences: (preferences) =>
        set((state) => ({
          user: state.user
            ? { ...state.user, preferences: { ...state.user.preferences, ...preferences } }
            : null,
        })),

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === "super_admin" || user.role === "tenant_admin") return true;
        return user.permissions.includes(permission);
      },

      hasModuleAccess: (module) => {
        const { tenant, user } = get();
        if (!tenant || !user) return false;
        if (user.role === "super_admin") return true;
        return tenant.enabledModules.includes(module);
      },

      isRole: (role) => {
        const { user } = get();
        if (!user) return false;
        if (Array.isArray(role)) return role.includes(user.role);
        return user.role === role;
      },
    }),
    {
      name: "softaxis-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user:            state.user,
        tenant:          state.tenant,
        token:           state.token,
        refreshToken:    state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
