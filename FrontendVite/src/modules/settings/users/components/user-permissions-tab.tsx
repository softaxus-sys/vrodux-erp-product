import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Check, X, Save, Loader2, Search, RotateCcw, ChevronDown, ChevronUp, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAllPermissions } from "@/hooks/identity/use-roles";
import { useUpdateUserPermissions } from "@/hooks/identity/use-users";
import { useAuthStore } from "@/store/auth.store";
import type { UserDto } from "@/lib/identity/types";
import type { ModuleKey } from "@/types";
import {
  ACTION_ORDER, actionShortLabel, GROUP_ORDER, groupLabel,
  groupPermissions, buildPermActionMap, moduleLabel,
} from "@/lib/identity/permission-matrix";

// Override value: true = explicit grant, false = explicit deny, undefined = inherit from role.
type OverrideMap = Map<string, boolean>;

// ── Tri-state permission cell ───────────────────────────────────────────────────

function TriCell({
  roleHas, override, onClick,
}: {
  roleHas: boolean | null;   // null = action not applicable for this module
  override: boolean | undefined;
  onClick: () => void;
}) {
  const { t } = useTranslation("settings");
  if (roleHas === null) {
    return (
      <div className="w-8 h-8 flex items-center justify-center">
        <span className="text-xs text-muted-foreground/25">—</span>
      </div>
    );
  }

  const effective = override === undefined ? roleHas : override;
  const isInherited = override === undefined;
  const isDeny      = override === false;
  const isGrant     = override === true;

  let cls = "bg-muted/20 border-border text-muted-foreground hover:border-primary/50";
  let icon: React.ReactNode = <span className="opacity-40">+</span>;
  let title = t("userPermissions.titleNotGranted");

  if (isInherited && roleHas) {
    cls = "bg-muted border-border text-muted-foreground/80";
    icon = <Check className="h-3.5 w-3.5" />;
    title = t("userPermissions.titleInherited");
  } else if (isGrant) {
    cls = "bg-emerald-500 border-emerald-500 text-white shadow-sm";
    icon = <Check className="h-3.5 w-3.5" />;
    title = t("userPermissions.titleGranted");
  } else if (isDeny) {
    cls = "bg-destructive border-destructive text-white shadow-sm";
    icon = <X className="h-3.5 w-3.5" />;
    title = t("userPermissions.titleDenied");
  }

  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "w-8 h-8 rounded-lg transition-all flex items-center justify-center border text-xs font-bold relative",
        cls,
      )}
    >
      {icon}
      {!isInherited && (
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400 border border-background" />
      )}
      {/* effective hint for screen readers / future use */}
      <span className="sr-only">{effective ? t("userPermissions.granted") : t("userPermissions.notGranted")}</span>
    </button>
  );
}

// ── Module row ──────────────────────────────────────────────────────────────────

function ModuleRow({
  moduleId, permsMap, roleKeys, overrides, onToggle,
}: {
  moduleId: string;
  permsMap: Record<string, { id: string; key: string }>;
  roleKeys: Set<string>;
  overrides: OverrideMap;
  onToggle: (permId: string, roleHas: boolean) => void;
}) {
  return (
    <div className="flex items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/10">
      <div className="w-44 shrink-0">
        <p className="text-xs font-semibold text-foreground">{moduleLabel(moduleId)}</p>
        <p className="text-[10px] font-mono text-muted-foreground/60">{moduleId}</p>
      </div>
      <div className="flex items-center gap-1">
        {ACTION_ORDER.map(action => {
          const perm = permsMap[action] ?? null;
          const roleHas = perm ? roleKeys.has(perm.key) : null;
          return (
            <TriCell
              key={action}
              roleHas={roleHas}
              override={perm ? overrides.get(perm.id) : undefined}
              onClick={() => perm && onToggle(perm.id, roleHas as boolean)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Main tab ────────────────────────────────────────────────────────────────────

export function UserPermissionsTab({ user }: { user: UserDto }) {
  const { t } = useTranslation("settings");
  const { data: allPermsData, isLoading } = useAllPermissions();
  const allPerms = allPermsData ?? [];
  const savePerms = useUpdateUserPermissions(user.id);

  const isSuperAdmin = useAuthStore(s => s.user?.role === "super_admin");
  const hasModuleAccess = useAuthStore(s => s.hasModuleAccess);

  // Role-inherited permission keys (the baseline this user already has via roles).
  const roleKeys = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of user.roles) for (const p of r.permissions) set.add(p.key);
    return set;
  }, [user.roles]);

  // Local override draft, seeded from the server's saved overrides.
  const initialOverrides = React.useMemo(() => {
    const m: OverrideMap = new Map();
    for (const o of user.permissionOverrides) m.set(o.permissionId, o.isGranted);
    return m;
  }, [user.permissionOverrides]);

  const [overrides, setOverrides] = React.useState<OverrideMap>(initialOverrides);
  React.useEffect(() => setOverrides(initialOverrides), [initialOverrides]);

  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set(GROUP_ORDER));

  const { byModule, byGroup } = React.useMemo(() => groupPermissions(allPerms), [allPerms]);
  const permActionMap = React.useMemo(() => buildPermActionMap(byModule), [byModule]);

  // Filter modules by search + tenant module entitlement.
  const filteredByGroup = React.useMemo(() => {
    const q = search.toLowerCase();
    const result: Record<string, string[]> = {};
    for (const [group, modules] of Object.entries(byGroup)) {
      const filtered = modules.filter(m => {
        const prefix = m.split(".")[0];
        if (!isSuperAdmin && !hasModuleAccess(prefix as ModuleKey)) return false;
        return !q || m.toLowerCase().includes(q) || group.toLowerCase().includes(q) ||
          moduleLabel(m).toLowerCase().includes(q);
      });
      if (filtered.length > 0) result[group] = filtered;
    }
    return result;
  }, [byGroup, search, isSuperAdmin, hasModuleAccess]);

  const orderedGroups = GROUP_ORDER.filter(g => filteredByGroup[g]);

  const hasChanges = React.useMemo(() => {
    if (overrides.size !== initialOverrides.size) return true;
    for (const [k, v] of overrides) if (initialOverrides.get(k) !== v) return true;
    return false;
  }, [overrides, initialOverrides]);

  const overrideCount = overrides.size;

  // Cycle: role-granted ⇄ deny;  not-role-granted ⇄ grant.
  const toggle = React.useCallback((permId: string, roleHas: boolean) => {
    setOverrides(prev => {
      const next = new Map(prev);
      const cur = next.get(permId);
      if (roleHas) {
        // states: inherited(undefined) ⇄ deny(false)
        if (cur === false) next.delete(permId);
        else next.set(permId, false);
      } else {
        // states: off(undefined) ⇄ grant(true)
        if (cur === true) next.delete(permId);
        else next.set(permId, true);
      }
      return next;
    });
  }, []);

  const toggleGroup = (group: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });

  const handleSave = () => {
    const payload = [...overrides.entries()].map(([permissionId, isGranted]) => ({ permissionId, isGranted }));
    savePerms.mutate(payload);
  };

  const handleReset = () => {
    setOverrides(new Map());
    savePerms.mutate([]);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-3 shrink-0">
        <div className="relative w-44 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input placeholder={t("userPermissions.filterModules")} value={search} onChange={e => setSearch(e.target.value)}
            className="pl-7 h-7 text-xs" />
        </div>
        <div className="flex items-center gap-1 ml-1 overflow-x-auto">
          {ACTION_ORDER.map(action => (
            <div key={action} className="w-8 text-center text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
              {actionShortLabel(action)}
            </div>
          ))}
        </div>
      </div>

      {/* Matrix */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orderedGroups.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">{t("userPermissions.noMatches")}</div>
        ) : (
          orderedGroups.map(group => (
            <div key={group}>
              <button
                className="w-full flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border hover:bg-muted/50 transition-colors"
                onClick={() => toggleGroup(group)}>
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">{groupLabel(group)}</span>
                  <span className="text-[10px] text-muted-foreground">({filteredByGroup[group]?.length ?? 0} modules)</span>
                </div>
                {expanded.has(group)
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              <AnimatePresence initial={false}>
                {expanded.has(group) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} style={{ overflow: "hidden" }}>
                    {(filteredByGroup[group] ?? []).map(moduleId => (
                      <ModuleRow
                        key={moduleId}
                        moduleId={moduleId}
                        permsMap={permActionMap[moduleId] ?? {}}
                        roleKeys={roleKeys}
                        overrides={overrides}
                        onToggle={toggle}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      {/* Footer legend + actions */}
      <div className="px-4 py-3 border-t border-border bg-muted/10 shrink-0 space-y-3">
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-muted border border-border flex items-center justify-center"><Check className="h-2.5 w-2.5 text-muted-foreground/80" /></span>
            <span>{t("userPermissions.legendInherited")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center"><Check className="h-2.5 w-2.5 text-white" /></span>
            <span>{t("userPermissions.legendGranted")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-destructive flex items-center justify-center"><X className="h-2.5 w-2.5 text-white" /></span>
            <span>{t("userPermissions.legendDenied")}</span>
          </div>
          <span className="ml-auto font-medium text-foreground">
            {t("userPermissions.overrides", { count: overrideCount })}
          </span>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>{t("userPermissions.superAdminNote")}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5 h-8" onClick={handleSave} disabled={!hasChanges || savePerms.isPending}>
            {savePerms.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5" />{t("userPermissions.saveOverrides")}</>}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
            onClick={handleReset} disabled={overrideCount === 0 || savePerms.isPending}>
            <RotateCcw className="h-3 w-3" />{t("userPermissions.resetDefaults")}
          </Button>
        </div>
      </div>
    </div>
  );
}
