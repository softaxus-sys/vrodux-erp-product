import { findCountry } from "@/lib/onboarding/geo-data";
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

  // Derive from the EFFECTIVE key set — (roles ∪ user grants) − user denies — the same set
  // hasRawPermission uses. Reading dto.roles directly ignored per-user permission overrides, so a
  // permission granted to a single user (rather than through a role) satisfied hasRawPermission but
  // not hasModuleAccess: the button unlocked while the module stayed hidden. A deny had the mirror
  // problem — revoked at the button, still granting module access.
  for (const key of extractRawPermissions(dto)) {
    const mapped = toFrontendPermission(key);
    if (mapped && !allPermissions.includes(mapped)) {
      allPermissions.push(mapped);
    }
  }

  return {
    id: dto.id,
    email: dto.email,
    name: dto.fullName,
    avatar: dto.avatarUrl ?? undefined,
    role: primaryRole ? toUserRole(primaryRole.name) : "custom",
    roleName: primaryRole?.name,

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

/**
 * Extract the *effective* raw backend permission keys (e.g. "pos.transactions.void") from a UserDto.
 * Effective = (role permissions ∪ user grants) − user denies. Deny always wins, mirroring the backend
 * `PermissionRepository.GetPermissionKeysForUserAsync` so the store stays consistent with the JWT.
 */
export function extractRawPermissions(dto: UserDto): string[] {
  const keys = new Set<string>();
  for (const role of dto.roles) {
    for (const perm of role.permissions) keys.add(perm.key);
  }
  const overrides = dto.permissionOverrides ?? [];
  for (const o of overrides) if (o.isGranted) keys.add(o.key);   // grants add
  for (const o of overrides) if (!o.isGranted) keys.delete(o.key); // denies remove (last — wins)
  return [...keys];
}

/**
 * Every valid frontend module key, as a runtime lookup.
 *
 * Declared as `Record<ModuleKey, true>` on purpose: adding a key to the `ModuleKey` union without
 * adding it here is a COMPILE ERROR. The previous hand-written switch had no such guard and had
 * silently drifted out of step with the backend catalogue.
 */
const KNOWN_MODULES: Record<ModuleKey, true> = {
  "dashboard": true, "finance": true, "hr": true, "crm": true, "sales": true,
  "purchase": true, "inventory": true, "real-estate": true, "construction": true,
  "hospitality": true, "healthcare": true, "pos": true, "recipe": true, "reports": true,
  "settings": true, "users": true, "ai-assistant": true, "notifications": true,
  "file-manager": true, "super-admin": true, "restaurant": true, "education": true,
  "insurance": true, "b2b": true, "project-management": true, "visa": true,
};

/** Legacy stored code → canonical ModuleKey. Mirrors `Tenant.LegacyModuleAliases` (backend). */
const LEGACY_MODULE_ALIASES: Record<string, ModuleKey> = { purchasing: "purchase" };

/** Codes that are no longer modules. Mirrors `Tenant.RetiredModuleCodes` (backend). */
const RETIRED_MODULE_CODES = new Set(["api", "custom-reports", "manufacturing"]);

/**
 * Normalise one backend module code to a canonical ModuleKey, or null to drop it.
 * Mirrors `Tenant.CanonicalModuleCode` (backend) exactly: strip a `.basic`-style suffix,
 * drop retired codes, then apply the legacy alias table.
 */
function canonicalModuleCode(code: string): ModuleKey | null {
  let c = code.trim().toLowerCase();
  if (!c) return null;

  const dot = c.indexOf(".");
  if (dot > 0) c = c.slice(0, dot);

  if (RETIRED_MODULE_CODES.has(c)) return null;

  const aliased = LEGACY_MODULE_ALIASES[c] ?? c;
  return (aliased in KNOWN_MODULES) ? (aliased as ModuleKey) : null;
}

/**
 * Map the JWT `modules` claim to the tenant's enabled frontend modules.
 *
 * The claim comes from `Tenant.ResolvedModules`, which has ALREADY resolved everything:
 * the onboarding selection intersected with the plan ceiling, plus the industry pack (and the
 * `crm` it builds on), plus the always-on self-administration modules. So this is a
 * straight canonical pass-through — it must NOT re-derive entitlement.
 *
 * It used to be a hand-written switch that both under- and over-granted:
 *   • `project-management` (and `file-manager`) were seeded unconditionally, so a tenant that was
 *     never given Project Management still saw it in the sidebar — `hasModuleAccess` step 3 reads
 *     this list, so seeding a module here bypasses the tenant's entitlement entirely.
 *   • there was no `case "purchase"`, only the pre-rename `case "purchasing"`, so the Purchase
 *     module was silently dropped for every tenant provisioned under the current catalogue.
 *   • `restaurant` / `recipe` were inferred from `pos` and `hospitality` was unmapped, so
 *     deselecting them had no effect while Hospitality could never be granted at all.
 */
function backendModulesToFrontend(backendModules: string[]): ModuleKey[] {
  // Pure UI surfaces, never part of plan entitlement. These match hasModuleAccess step 2, which
  // short-circuits before the enabledModules check — listed here only for consistency.
  const keys = new Set<ModuleKey>(["dashboard", "notifications"]);

  for (const m of backendModules) {
    const key = canonicalModuleCode(m);
    if (key) keys.add(key);
  }

  // NOTE: `file-manager` is deliberately NOT seeded from the claim alone yet — the super-admin
  // module selector (module-selector.tsx ALL_MODULES) does not expose it, so a tenant whose
  // modules were saved from that screen has no `file-manager` entry to pass through. Until the
  // selector lists it, keep it on for every tenant rather than silently removing File Manager.
  keys.add("file-manager");

  // Self-administration is never a plan feature: without Settings and Users an admin cannot invite
  // a colleague or assign a role. The backend forces these into every tenant's module set too —
  // adding them here as well means tokens issued before that change still grant access.
  keys.add("settings");
  keys.add("users");

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

  // Country chosen at signup, straight from the JWT. `country` and `timezone` used to be hardcoded
  // to Pakistan / Asia-Karachi here, so a UAE tenant saw a Pakistani tax regime in Settings.
  const country = (claims["country"] as string | undefined)?.trim() || "";
  const countryMeta = country ? findCountry(country) : undefined;

  // Operating/display currency from the JWT (set at signup from the browser locale). When the
  // tenant never got one persisted, derive it from their country rather than defaulting to USD —
  // that is what produced "UAE country, USD currency" mismatches.
  const currencyClaim = (claims["currency"] as string | undefined)?.trim().toUpperCase();
  const currency = (currencyClaim && currencyClaim !== "USD" ? currencyClaim : null)
    ?? countryMeta?.currencyCode
    ?? currencyClaim
    ?? "USD";

  const backendModules = modulesCsv
    ? modulesCsv.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  const enabledModules = backendModules.length > 0
    ? backendModulesToFrontend(backendModules)
    // No modules claim in JWT (old token) — fall back to enterprise for super-admin.
    // NOTE: this over-grants (Project Management included). It is unreachable for any current
    // token: ResolvedModules always contains at least settings+users, so the claim is never
    // empty. Left permissive on purpose — tightening it would log out live legacy sessions.
    : (["dashboard", "pos", "inventory", "finance", "hr", "crm",
        "sales", "purchase", "reports", "settings", "users",
        "notifications", "file-manager", "project-management", "visa"] as ModuleKey[]);

  return {
    id:             (claims["tenant_id"] as string | undefined) ?? "unknown",
    name,
    slug,
    industry:       "retail",
    currency,
    country:        countryMeta?.name ?? country,
    timezone:       countryMeta?.timezone ?? "",
    plan,
    status:         "active",
    vertical:       (claims["industry"] as string | undefined) ?? undefined,
    // Subscription gate + trial countdown, straight off the JWT so the UI needs no extra call.
    subscriptionState: (claims["subscription_state"] as string | undefined) ?? undefined,
    trialDaysLeft:     claims["trial_days_left"] !== undefined && claims["trial_days_left"] !== null
                         ? Number(claims["trial_days_left"])
                         : null,
    enabledModules,
    branding: {
      primaryColor: "#2563eb",
      companyName:  name,
      tagline:      "Smarter Business, Simpler Operations",
    },
    settings: {
      fiscalYearStart:  7,
      vatEnabled:       false,
      defaultCurrency:  currency as any,
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
  currency: "USD",
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

  /** Set while a super-admin is viewing the app AS a tenant (impersonation). null = not impersonating. */
  impersonation: { tenantId: string; tenantName: string; tenantSlug: string } | null;
  /** The super-admin's own session, saved so exitImpersonation() can restore it. */
  superSession: {
    token: string | null; refreshToken: string | null;
    user: User | null; tenant: Tenant | null; rawPermissions: string[];
  } | null;

  // Actions
  setUser: (user: User) => void;
  setTenant: (tenant: Tenant) => void;
  setToken: (token: string) => void;
  setRefreshToken: (token: string) => void;

  /** Called after a successful Identity.API /login response. */
  loginFromApi: (accessToken: string, refreshToken: string, userDto: UserDto) => void;

  /** Super-admin enters a tenant: swap to the tenant-scoped token, saving the super session. */
  enterImpersonation: (accessToken: string, info: { tenantId: string; tenantName: string; tenantSlug: string }) => void;
  /** Restore the super-admin session. */
  exitImpersonation: () => void;

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
      impersonation: null,
      superSession: null,

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
          ? { ...mappedUser, role: 'super_admin' as UserRole, roleName: mappedUser.roleName ?? 'Super Admin' }
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

      enterImpersonation: (accessToken, info) => {
        const s = get();
        const claims = decodeJwtPayload(accessToken);
        const tenant = buildTenantFromClaims(claims);
        // Permission keys live in the token's `permission` claims (string or string[]).
        const permClaim = claims["permission"];
        const rawPermissions = Array.isArray(permClaim)
          ? (permClaim as string[])
          : permClaim ? [String(permClaim)] : [];
        // Keep the super-admin's identity, but act as a tenant admin so hasModuleAccess is scoped
        // to THIS tenant's enabled modules (a super_admin role would unlock every module).
        const impersUser: User | null = s.user
          ? { ...s.user, role: "tenant_admin" as UserRole, roleName: "Administrator" }
          : s.user;
        set({
          superSession: {
            token: s.token, refreshToken: s.refreshToken,
            user: s.user, tenant: s.tenant, rawPermissions: s.rawPermissions,
          },
          token: accessToken,
          refreshToken: null,           // don't auto-refresh into a super token; exit on expiry
          user: impersUser,
          tenant,
          rawPermissions,
          impersonation: info,
        });
        // Drop any super-admin (pooled) query cache so the tenant view starts clean.
        queryClient.clear();
      },

      exitImpersonation: () => {
        const s = get();
        if (!s.superSession) return;
        set({
          token:          s.superSession.token,
          refreshToken:   s.superSession.refreshToken,
          user:           s.superSession.user,
          tenant:         s.superSession.tenant,
          rawPermissions: s.superSession.rawPermissions,
          impersonation:  null,
          superSession:   null,
        });
        queryClient.clear();
      },

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
          impersonation:   null,
          superSession:    null,
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

        // ── 1. Platform super-admin: ONLY the super-admin console — no operational modules.
        //       They manage tenants and must "Open" a tenant (impersonation) to view its data,
        //       which flips the role to tenant_admin so this branch no longer applies. Prevents
        //       pooled cross-tenant data and lets ModuleGuard bounce operational routes. ─────────
        if (user.role === "super_admin") return (module as string) === "super-admin";

        if (!tenant) return false;

        // ── 2. Always-on UI modules (not part of plan/module entitlements) ──────
        //    file-manager was here too, which is why it could never be granted or withheld: it was
        //    open to every authenticated user regardless of role. It now carries real permission
        //    keys (file-manager.view/export) and falls through to the normal checks below, so a
        //    tenant can decide who browses stored documents. Admins/managers still pass at step 4,
        //    and every legacy role in ROLE_DEFAULTS lists it, so only custom roles need the grant.
        if (module === "dashboard" || module === "notifications" ||
            module === "ai-assistant") return true;

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
        impersonation:   state.impersonation,
        superSession:    state.superSession,
      }),
    }
  )
);
