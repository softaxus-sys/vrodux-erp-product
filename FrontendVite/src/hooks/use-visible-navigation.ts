import * as React from "react";
import { useAuthStore } from "@/store/auth.store";
import { useNavigation } from "@/hooks/use-navigation";
import type { ModuleKey, NavGroup } from "@/types";

/**
 * The navigation the current user may actually reach — modules their tenant owns, pages their
 * permissions open.
 *
 * <p>
 * This lived inside SidebarNav, and the command palette walked the RAW navigationConfig with no
 * filtering at all. So global search offered HR, CRM and Finance to a shop licensed for none of
 * them, and every one of those results navigated to a route ModuleGuard then bounced. The sidebar
 * and the palette are two views of one list; having two traversals is what let them disagree.
 * </p>
 */
export function useVisibleNavigation(): NavGroup[] {
  const { hasModuleAccess, hasRawPermission, canOpenSettingsPage, user, tenant } = useAuthStore();
  const impersonation = useAuthStore((s) => s.impersonation);
  const navigationConfig = useNavigation();

  // A platform super-admin who is NOT impersonating a tenant sees ONLY the super-admin console —
  // never operational modules with pooled cross-tenant data. To see a tenant's records they
  // "Open" that tenant, which flips their role to tenant_admin so normal access applies.
  const superAdminMode = user?.role === "super_admin" && !impersonation;

  return React.useMemo((): NavGroup[] => {
    // Does the TENANT own this module? Deliberately not hasModuleAccess, which also fails when the
    // tenant owns it but this particular user may not open it — the exact case the child rescue
    // below exists for. Items with no module are never blocked here.
    const tenantHasModule = (mod?: string) =>
      !mod || mod === "dashboard" || mod === "notifications" ||
      mod === "ai-assistant" || mod === "support" ||
      Boolean(tenant?.enabledModules?.includes(mod as ModuleKey));

    const itemVisible = (mod?: string, permission?: string) => {
      if (superAdminMode) return mod === "super-admin";
      if (mod && !hasModuleAccess(mod as ModuleKey)) return false;
      // A page the user cannot open should not be offered: a self-service employee holds the HR
      // module but only hr.self.*, so Employees/Payroll would be a list of guaranteed 403s.
      if (!permission) return true;
      // Settings pages use canOpenSettingsPage so the legacy admin tiers keep the blanket Settings
      // access the route guard has always given them; everyone else needs the key.
      return permission.startsWith("settings.")
        ? canOpenSettingsPage(permission)
        : hasRawPermission(permission);
    };

    return navigationConfig
      .map((group) => ({
        ...group,
        items: group.items
          .map((item) => ({
            ...item,
            // Children that carry their own module or permission requirement.
            children: item.children?.filter((child) => itemVisible(child.module, child.requiresPermission)),
          }))
          // A parent is shown when the user may open it, OR when a child carrying its OWN gate
          // survived. "My HR" needs that second case: an ordinary employee holds hr.self.* and
          // deliberately does NOT have the HR module.
          //
          // The "own gate" test is essential — most children are ungated, so "any surviving child"
          // would be always true and would show every module to everyone. And tenantHasModule is
          // the other half: those child gates are permission-only, and a tenant Administrator
          // holds every seeded key, so without it "My HR" and Real Estate's "Website" leaked
          // whole modules onto a site licensed for neither.
          .filter((item) =>
            itemVisible(item.module, item.requiresPermission)
            || (tenantHasModule(item.module)
                && (item.children ?? []).some((child) => child.module || child.requiresPermission))),
      }))
      .filter((group) => group.items.length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tenant, impersonation, navigationConfig, superAdminMode]);
}
