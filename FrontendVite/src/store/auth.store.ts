import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User, Tenant, Permission, ModuleKey, UserRole } from "@/types";
import type { UserDto } from "@/lib/identity/types";
import { authApi } from "@/lib/identity/auth.api";
import { useThemeStore } from "@/store/theme.store";
import { queryClient } from "@/lib/query-client";

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
    store_manager:      "manager",
    pos_admin:          "manager",
    accountant:         "accountant",
    hr_manager:         "hr_manager",
    hrmanager:          "hr_manager",
    sales_rep:          "sales_rep",
    sales_representative:"sales_rep",
    // POS-specific roles: map to "custom" so ROLE_DEFAULTS doesn't pollute
    // their module access. hasModuleAccess falls through to explicit permission
    // check (step 7) which uses the correctly-mapped frontend permissions.
    cashier:            "custom",
    supervisor:         "custom",
    purchase_officer:   "purchase_officer",
    purchaseofficer:    "purchase_officer",
    warehouse_manager:  "warehouse_manager",
    warehousemanager:   "warehouse_manager",
    inventory_manager:  "warehouse_manager",
    viewer:             "viewer",
  };
  return map[n] ?? "custom";
}

/**
 * Convert backend permission key to frontend format.
 * Backend format: "pos.transactions.void" (moduleId.submodule.action — 3 parts)
 * Frontend format: "pos:admin" (module:level — 2 parts)
 *
 * The first segment is the top-level module used for hasModuleAccess() checks.
 * The last segment is the action, mapped to a coarse permission level.
 */
function toFrontendPermission(key: string): Permission | null {
  const parts = key.split(".");
  if (parts.length < 2) return null;

  const module = parts[0]; // top-level module: "pos", "inventory", "finance", etc.
  const action = parts[parts.length - 1]; // last part is always the action

  const actionMap: Record<string, "read" | "write" | "delete" | "admin"> = {
    view:     "read",
    export:   "read",
    print:    "read",
    create:   "write",
    edit:     "write",
    discount: "write",
    adjust:   "write",
    delete:   "delete",
    approve:  "admin",
    void:     "admin",
    refund:   "admin",
  };

  const level = actionMap[action];
  if (!level) return null;
  return `${module}:${level}` as Permission;
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

/**
 * Decode the payload section of a JWT without any library.
 * Returns an empty object on any parse failure.
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch {
    return {};
  }
}

/** Extract raw backend permission keys (e.g. "pos.transactions.void") from UserDto. */
export function extractRawPermissions(dto: UserDto): string[] {
  const keys = new Set<string>();
  for (const role of dto.roles) {
    for (const perm of role.permissions) {
      keys.add(perm.key);
    }
  }
  return [...keys];
}

/**
 * Map a backend module code (e.g. "inventory.basic", "hr") to one or more
 * frontend ModuleKey values.  Unknown codes are silently ignored.
 */
function backendModulesToFrontend(backendModules: string[]): ModuleKey[] {
  // These are always visible regardless of plan
  const keys = new Set<ModuleKey>([
    "dashboard", "notifications", "file-manager", "project-management",
  ]);

  for (const m of backendModules) {
    // Normalise: "inventory.basic" → base "inventory"
    const base = m.split(".")[0].toLowerCase();
    switch (base) {
      case "pos":
        keys.add("pos");
        keys.add("restaurant");
        keys.add("recipe");
        break;
      case "inventory":
        keys.add("inventory");
        break;
      case "purchasing":
        keys.add("purchase");
        break;
      case "reports":
        keys.add("reports");
        break;
      case "settings":
        keys.add("settings");
        keys.add("users");
        break;
      case "hr":
        keys.add("hr");
        break;
      case "crm":
        keys.add("crm");
        break;
      case "sales":
        keys.add("sales");
        break;
      case "finance":
        keys.add("finance");
        break;
      case "manufacturing":
        keys.add("construction");
        break;
      case "custom-reports":
        keys.add("reports");
        break;
      // ── Industry Packs (activated by tenant industry) ────────────────────
      case "real-estate": keys.add("real-estate"); keys.add("crm"); break;
      case "construction":keys.add("construction"); keys.add("crm"); break;
      case "healthcare":  keys.add("healthcare");  keys.add("crm"); break;
      case "education":   keys.add("education");   keys.add("crm"); break;
      case "insurance":   keys.add("insurance");   keys.add("crm"); break;
      case "b2b":         keys.add("b2b");         keys.add("crm"); break;
      // no default — unknown module codes are silently skipped
    }
  }

  return [...keys];
}

/**
 * Build a Tenant object from JWT claims.  Uses the claim values for live data
 * (plan, name, slug, modules) and falls back to sensible defaults for UI-only fields.
 */
function buildTenantFromClaims(claims: Record<string, unknown>): Tenant {
  const planRaw    = (claims["plan"]        as string | undefined) ?? "starter";
  const name       = (claims["tenant_name"] as string | undefined) ?? "Unknown Tenant";
  const slug       = (claims["tenant_slug"] as string | undefined) ?? "tenant";
  const modulesCsv = (claims["modules"]     as string | undefined) ?? "";

  const plan = planRaw.toLowerCase() as Tenant["plan"];

  const backendModules = modulesCsv
    ? modulesCsv.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  const enabledModules = backendModules.length > 0
    ? backendModulesToFrontend(backendModules)
    // No modules claim in JWT (old token) — fall back to enterprise for super-admin
    : (["dashboard", "pos", "inventory", "finance", "hr", "crm",
        "sales", "purchase", "reports", "settings", "users",
        "notifications", "file-manager", "project-management"] as ModuleKey[]);

  return {
    id:             (claims["tenant_id"] as string | undefined) ?? "unknown",
    name,
    slug,
    industry:       "retail",
    currency:       "PKR",
    country:        "Pakistan",
    timezone:       "Asia/Karachi",
    plan,
    status:         "active",
    vertical:       (claims["industry"] as string | undefined) ?? undefined,
    enabledModules,
    branding: {
      primaryColor: "#2563eb",
      companyName:  name,
      tagline:      "Smarter Business, Simpler Operations",
    },
    settings: {
      fiscalYearStart:  7,
      vatEnabled:       false,
      defaultCurrency:  "PKR" as any,
      multiCurrency:    false,
      defaultLanguage:  "en",
      rtlEnabled:       false,
    },
    createdAt: new Date().toISOString(),
  };
}

/** Default Vrodux tenant (used for super-admin logins with no tenant_id). */
const DEFAULT_TENANT: Tenant = {
  id: "softaxis-erp",
  name: "Vrodux",
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
    companyName: "Vrodux",
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
  /**
   * Raw backend permission keys (e.g. "pos.transactions.void", "inventory.stock.adjust").
   * Use hasRawPermission() for fine-grained POS/inventory access checks.
   */
  rawPermissions: string[];

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
  /**
   * Check a raw backend permission key (e.g. "pos.transactions.void").
   * Super/tenant admins always return true.
   */
  hasRawPermission: (key: string) => boolean;
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
      rawPermissions: [],

      setUser:         (user)         => set({ user }),
      setTenant:       (tenant)       => set({ tenant }),
      setToken:        (token)        => set({ token }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),

      loginFromApi: (accessToken, refreshToken, userDto) => {
        // Decode JWT claims to detect super-admin flag and tenant context.
        const claims       = decodeJwtPayload(accessToken);
        const isSuperAdmin = claims['is_super_admin'] === 'true';
        const hasTenant    = Boolean(claims['tenant_id']);

        const mappedUser = mapUserDto(userDto);
        const user: User = isSuperAdmin
          ? { ...mappedUser, role: 'super_admin' as UserRole }
          : mappedUser;

        // Build tenant from live JWT claims when tenant context is present,
        // fall back to DEFAULT_TENANT for super-admin (no tenant).
        const tenant = hasTenant
          ? buildTenantFromClaims(claims)
          : DEFAULT_TENANT;

        set({
          token:           accessToken,
          refreshToken:    refreshToken,
          user,
          tenant,
          isAuthenticated: true,
          rawPermissions:  extractRawPermissions(userDto),
        });
      },

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
          rawPermissions:  [],
        });
        // Wipe ALL React Query cache so the next user never sees stale data
        // from the previous session (e.g. POS active sessions, permissions).
        queryClient.clear();
        // Reset theme to defaults so the next user doesn't inherit this user's appearance
        useThemeStore.getState().reset();
      },

      updateUser: (userDto) =>
        set((state) => ({
          user:           state.user ? { ...state.user, ...mapUserDto(userDto) } : null,
          rawPermissions: extractRawPermissions(userDto),
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
        if (!user) return false;

        // ── 1. Platform super-admin: unrestricted (manages all tenants) ─────────
        if (user.role === "super_admin") return true;

        if (!tenant) return false;

        // ── 2. Always-on UI modules (not part of plan/module entitlements) ──────
        if (module === "dashboard" || module === "notifications" ||
            module === "file-manager" || module === "ai-assistant") return true;

        // ── 3. Tenant must have the module enabled — applies to EVERYONE,
        //       including tenant_admin. A tenant admin can only ever see the
        //       modules provisioned for their tenant. ───────────────────────────
        if (!tenant.enabledModules.includes(module as any)) return false;

        // ── 4. Tenant admin / manager: full access to every ENABLED module ──────
        //       (settings & users included, since those are gated by step 3).
        if (user.role === "tenant_admin" || user.role === "manager") return true;

        // ── 5. Settings / Users: admins only ────────────────────────────────────
        if (module === "settings" || module === "users") return false;

        // ── 6. Role-based default module access ─────────────────────────────────
        //    Covers cases where backend roles don't enumerate explicit permissions.
        const ROLE_DEFAULTS: Partial<Record<string, ModuleKey[]>> = {
          hr_manager:        ["hr", "reports", "notifications", "ai-assistant", "file-manager"],
          accountant:        ["finance", "reports", "notifications", "ai-assistant", "file-manager"],
          sales_rep:         ["sales", "crm", "pos", "recipe", "reports", "notifications", "ai-assistant", "file-manager"],
          purchase_officer:  ["purchase", "inventory", "reports", "notifications", "ai-assistant", "file-manager"],
          warehouse_manager: ["inventory", "purchase", "reports", "notifications", "ai-assistant", "file-manager"],
          viewer:            ["reports", "notifications", "ai-assistant", "file-manager"],
        };

        const defaults = ROLE_DEFAULTS[user.role];
        if (defaults?.includes(module as ModuleKey)) return true;

        // ── 7. Explicit permission check ─────────────────────────────────────────
        //    Backend assigns e.g. "pos:read", "pos:write" → check prefix match.
        //    This is the most granular and accurate check.
        return user.permissions.some((p) => p.startsWith(`${module}:`));
      },

      isRole: (role) => {
        const { user } = get();
        if (!user) return false;
        if (Array.isArray(role)) return role.includes(user.role);
        return user.role === role;
      },

      hasRawPermission: (key: string) => {
        const { user, rawPermissions } = get();
        if (!user) return false;
        if (user.role === "super_admin" || user.role === "tenant_admin") return true;
        return rawPermissions.includes(key);
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
        rawPermissions:  state.rawPermissions,
      }),
    }
  )
);
