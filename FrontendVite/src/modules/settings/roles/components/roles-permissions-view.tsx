import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Plus, Shield, Users, Check, Copy, Trash2, Search,
  Lock, Save, X, Loader2, RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useRoles, useRole, useCreateRole, useUpdateRole,
  useDeleteRole, useUpdateRolePermissions, useAllPermissions,
} from "@/hooks/identity/use-roles";
import { rolesApi } from "@/lib/identity/roles.api";
import type { RoleSummaryDto, PermissionDto } from "@/lib/identity/types";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import type { ModuleKey } from "@/types";
import {
  ACTION_ORDER, actionShortLabel, GROUP_ORDER, MODULE_GROUPS,
  groupPermissions, moduleLabel, moduleGroupLabel, groupLabel, UBIQUITOUS_MODULES,
} from "@/lib/identity/permission-matrix";
import { Can } from "@/components/auth/can";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_ICONS = ["🔑","👔","💼","📊","🎯","🛡️","👁️","⚙️","🔧","📋"];
const ROLE_COLORS = [
  "bg-destructive/10 text-destructive border-destructive/20",
  "bg-primary/10 text-primary border-primary/20",
  "bg-violet-500/10 text-violet-600 border-violet-500/20",
  "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
];

// ── Confirm Delete Modal ───────────────────────────────────────────────────────

function ConfirmDeleteModal({
  roleName, onConfirm, onCancel, loading,
}: { roleName: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  return (
    <>
      <motion.div className="fixed inset-0 bg-black/40 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        exit={{ opacity: 0 }} onClick={onCancel} />
      <motion.div className="fixed inset-0 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">{t("roles.deleteTitle")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t("roles.deleteWarning")}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            {t("roles.deleteBody", { name: roleName })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>{tc("action.cancel")}</Button>
            <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1.5" />{tc("action.delete")}</>}
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Create / Edit Role Modal ───────────────────────────────────────────────────

function RoleFormModal({
  initial, title, onSave, onClose, loading,
}: {
  initial?: { name: string; description: string };
  title: string;
  onSave: (name: string, description: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");

  return (
    <>
      <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="fixed inset-0 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-bold">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("roles.nameLabel")}</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("roles.namePlaceholder")} className="h-9" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("roles.descriptionLabel")}</label>
              <Input value={description} onChange={e => setDescription(e.target.value)}
                placeholder={t("roles.descriptionPlaceholder")} className="h-9" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={() => onSave(name, description)}
                disabled={!name.trim() || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("action.save")}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={loading}>{tc("action.cancel")}</Button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Permission Toggle Cell ─────────────────────────────────────────────────────

function PermCell({
  perm, checked, onChange, disabled,
}: { perm: PermissionDto | null; checked: boolean; onChange: () => void; disabled: boolean }) {
  if (!perm) return (
    <div className="w-8 h-8 flex items-center justify-center">
      <span className="text-xs text-muted-foreground/25">—</span>
    </div>
  );
  return (
    <button onClick={() => !disabled && onChange()} disabled={disabled}
      title={perm.description}
      className={cn(
        "w-8 h-8 rounded-lg transition-all flex items-center justify-center border text-xs font-bold",
        checked
          ? "bg-primary border-primary text-white shadow-sm"
          : "bg-muted/20 border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5",
        disabled && "opacity-40 cursor-not-allowed"
      )}>
      {checked ? <Check className="h-3.5 w-3.5" /> : <span className="opacity-40">+</span>}
    </button>
  );
}

// ── Module Chips (which module(s) a role is linked to) ──────────────────────────

/**
 * Renders the module(s) a role grants access to, derived from RoleSummaryDto.modules.
 * Cross-cutting modules (settings/reports/…) are dropped so the chips reflect the
 * role's real purpose. A role spanning most modules collapses to a single "All modules"
 * chip (the Administrator case). `max` caps how many chips show before a "+N" overflow.
 */
function ModuleChips({
  modules, isSystem, max = 3,
}: { modules: string[]; isSystem: boolean; max?: number }) {
  const { t } = useTranslation("settings");
  const significant = (modules ?? [])
    .map(m => m.toLowerCase())
    .filter(m => !UBIQUITOUS_MODULES.has(m));

  // Total distinct business modules (excludes the ubiquitous cross-cutting ones).
  const businessModuleCount = Object.keys(MODULE_GROUPS)
    .filter(m => !UBIQUITOUS_MODULES.has(m)).length;

  // Administrator / full-access roles touch (almost) everything — one summary chip.
  if (significant.length === 0) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground">
        {isSystem ? t("roles.allModules") : t("roles.general")}
      </span>
    );
  }
  if (significant.length >= businessModuleCount) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-primary/10 text-primary">
        {t("roles.allModules")}
      </span>
    );
  }

  const shown = significant.slice(0, max);
  const extra = significant.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map(m => (
        <span key={m}
          className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-primary/10 text-primary">
          {moduleGroupLabel(m)}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  );
}

// ── Module Row ────────────────────────────────────────────────────────────────

function ModuleRow({
  moduleId, permsMap, selectedIds, onToggle, disabled,
}: {
  moduleId: string;
  permsMap: Record<string, PermissionDto>;  // action → PermissionDto
  selectedIds: Set<string>;
  onToggle: (permId: string) => void;
  disabled: boolean;
}) {
  const availablePerms = Object.values(permsMap);
  const checkedCount   = availablePerms.filter(p => selectedIds.has(p.id)).length;
  const allChecked     = availablePerms.length > 0 && checkedCount === availablePerms.length;

  const toggleAll = () => {
    if (disabled) return;
    if (allChecked) {
      availablePerms.forEach(p => selectedIds.has(p.id) && onToggle(p.id));
    } else {
      availablePerms.forEach(p => !selectedIds.has(p.id) && onToggle(p.id));
    }
  };

  return (
    <div className="flex items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/10 group">
      <div className="w-44 shrink-0">
        <button onClick={toggleAll} disabled={disabled}
          className={cn(
            "text-xs font-semibold transition-colors text-left",
            allChecked ? "text-primary" : "text-foreground",
            !disabled && "hover:text-primary cursor-pointer"
          )}>
          {moduleLabel(moduleId)}
        </button>
        <p className="text-[10px] font-mono text-muted-foreground/60">{moduleId}</p>
      </div>
      <div className="flex items-center gap-1">
        {ACTION_ORDER.map(action => {
          const perm = permsMap[action] ?? null;
          return (
            <PermCell
              key={action}
              perm={perm}
              checked={!!perm && selectedIds.has(perm.id)}
              onChange={() => perm && onToggle(perm.id)}
              disabled={disabled}
            />
          );
        })}
      </div>
      {checkedCount > 0 && (
        <span className="ml-3 text-[10px] text-primary/70 font-semibold">{checkedCount}/{availablePerms.length}</span>
      )}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function RolesPermissionsView() {
  const { t } = useTranslation("settings");
  // ── API data ──────────────────────────────────────────────────────────────────
  const { data: rolesData, isLoading: rolesLoading, refetch: refetchRoles } = useRoles({ pageSize: 100 });
  const { data: allPermsData, isLoading: permsLoading } = useAllPermissions();

  const hasModuleAccess = useAuthStore(s => s.hasModuleAccess);
  const isSuperAdmin    = useAuthStore(s => s.user?.role === "super_admin");

  // A role is relevant to this tenant when:
  //  • super-admin (sees all), or
  //  • it's the full-access Administrator, or
  //  • every *significant* module it grants (excluding ubiquitous ones) is enabled.
  // Applies to BOTH system and custom roles — roles aren't tenant-scoped, so a
  // global custom role like "RetailStoreManager" (Inventory/POS) must be hidden
  // from tenants that don't have those modules.
  const roleIsRelevant = React.useCallback((r: RoleSummaryDto) => {
    if (isSuperAdmin) return true;
    if (r.name.trim().toLowerCase() === "administrator") return true;
    const significant = (r.modules ?? []).filter(m => !UBIQUITOUS_MODULES.has(m.toLowerCase()));
    if (significant.length === 0) return true; // only ubiquitous → generic role
    return significant.every(m => hasModuleAccess(m as ModuleKey));
  }, [isSuperAdmin, hasModuleAccess]);

  const rolesList = (rolesData?.items ?? []).filter(roleIsRelevant);
  const allPerms  = allPermsData ?? [];

  // ── Selected role state ───────────────────────────────────────────────────────
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!selectedRoleId && rolesList.length > 0) setSelectedRoleId(rolesList[0].id);
  }, [rolesList, selectedRoleId]);

  const { data: selectedRole, isLoading: roleDetailLoading } = useRole(selectedRoleId ?? "");

  // ── Local permission draft ────────────────────────────────────────────────────
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = React.useState(false);
  const [search, setSearch]         = React.useState("");
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set(GROUP_ORDER));

  // Sync pendingIds when selected role changes
  React.useEffect(() => {
    if (selectedRole) {
      setPendingIds(new Set(selectedRole.permissions.map(p => p.id)));
      setHasChanges(false);
    }
  }, [selectedRole]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createRole   = useCreateRole();
  const updateRole   = useUpdateRole(selectedRoleId ?? "");
  const deleteRole   = useDeleteRole();
  const savePerms    = useUpdateRolePermissions(selectedRoleId ?? "");

  // ── Modals ────────────────────────────────────────────────────────────────────
  const [showCreate,  setShowCreate]  = React.useState(false);
  const [showEdit,    setShowEdit]    = React.useState(false);
  const [showDelete,  setShowDelete]  = React.useState(false);

  // ── Permission matrix data ────────────────────────────────────────────────────
  const { byModule, byGroup } = React.useMemo(
    () => groupPermissions(allPerms),
    [allPerms]
  );

  // byModule[moduleId][action] = PermissionDto
  const permActionMap = React.useMemo(() => {
    const map: Record<string, Record<string, PermissionDto>> = {};
    for (const [moduleId, perms] of Object.entries(byModule)) {
      map[moduleId] = {};
      for (const perm of perms) {
        map[moduleId][perm.action] = perm;
      }
    }
    return map;
  }, [byModule]);

  // Filter modules by search
  const filteredByGroup = React.useMemo(() => {
    const q = search.toLowerCase();
    const result: Record<string, string[]> = {};
    for (const [group, modules] of Object.entries(byGroup)) {
      const filtered = modules.filter(m => {
        // Hide modules the tenant isn't entitled to (prefix = ModuleKey).
        const prefix = m.split(".")[0];
        if (!isSuperAdmin && !hasModuleAccess(prefix as ModuleKey)) return false;
        return !q || m.toLowerCase().includes(q) || group.toLowerCase().includes(q) || moduleLabel(m).toLowerCase().includes(q);
      });
      if (filtered.length > 0) result[group] = filtered;
    }
    return result;
  }, [byGroup, search, isSuperAdmin, hasModuleAccess]);

  const orderedGroups = GROUP_ORDER.filter(g => filteredByGroup[g]);

  // ── Toggle handler ────────────────────────────────────────────────────────────
  const togglePerm = React.useCallback((permId: string) => {
    setPendingIds(prev => {
      const next = new Set(prev);
      next.has(permId) ? next.delete(permId) : next.add(permId);
      return next;
    });
    setHasChanges(true);
  }, []);

  const toggleGroup = (group: string) =>
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });

  // ── Actions ───────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!selectedRoleId) return;
    savePerms.mutate([...pendingIds], {
      onSuccess: () => setHasChanges(false),
    });
  };

  const handleCreate = (name: string, description: string) => {
    createRole.mutate({ name, description }, {
      onSuccess: (role) => {
        setSelectedRoleId(role.id);
        setShowCreate(false);
      },
    });
  };

  const handleEdit = (name: string, description: string) => {
    updateRole.mutate({ name, description }, {
      onSuccess: () => setShowEdit(false),
    });
  };

  const handleDelete = () => {
    if (!selectedRoleId) return;
    deleteRole.mutate(selectedRoleId, {
      onSuccess: () => {
        setShowDelete(false);
        const remaining = rolesList.filter(r => r.id !== selectedRoleId);
        setSelectedRoleId(remaining[0]?.id ?? null);
      },
    });
  };

  const handleClone = () => {
    if (!selectedRole) return;
    createRole.mutate(
      { name: t("roles.copySuffix", { name: selectedRole.name }), description: selectedRole.description },
      {
        onSuccess: async (newRole) => {
          // Copy permissions directly via API — hooks cannot be called in callbacks
          if (pendingIds.size > 0) {
            try {
              await rolesApi.updatePermissions(newRole.id, [...pendingIds]);
            } catch {
              // non-fatal: role is created, permissions can be set manually
            }
          }
          setSelectedRoleId(newRole.id);
          toast.success(t("roles.cloned"));
        },
      }
    );
  };

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = React.useMemo(() => ({
    total:   rolesList.length,
    system:  rolesList.filter(r => r.isSystem).length,
    custom:  rolesList.filter(r => !r.isSystem).length,
    users:   rolesList.reduce((s, r) => s + r.userCount, 0),
  }), [rolesList]);

  const isReadOnly    = selectedRole?.isSystem ?? false;
  const isLoadingData = rolesLoading || permsLoading;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("roles.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("roles.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetchRoles()}
            disabled={rolesLoading}>
            <RefreshCw className={cn("h-4 w-4", rolesLoading && "animate-spin")} />
          </Button>
          <Can permission="settings.roles.create">
            <Button size="sm" className="gap-1.5 h-9" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />{t("roles.newRole")}
            </Button>
          </Can>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("roles.statTotal"),  value: stats.total },
          { label: t("roles.statSystem"), value: stats.system },
          { label: t("roles.statCustom"), value: stats.custom },
          { label: t("roles.statUsers"),  value: stats.users },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex gap-4" style={{ minHeight: 620 }}>
        {/* Left — Role list */}
        <div className="w-56 shrink-0 space-y-1">
          {rolesLoading ? (
            <div className="flex justify-center pt-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rolesList.map((role, i) => {
            const icon  = ROLE_ICONS[i % ROLE_ICONS.length];
            const color = ROLE_COLORS[i % ROLE_COLORS.length];
            return (
              <button key={role.id}
                onClick={() => { setSelectedRoleId(role.id); setHasChanges(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border text-sm",
                  selectedRoleId === role.id
                    ? "bg-primary/10 border-primary/30 shadow-sm"
                    : "bg-card border-border hover:border-primary/20 hover:bg-muted/20"
                )}>
                <span className={cn("h-8 w-8 rounded-lg border flex items-center justify-center text-base shrink-0", color)}>
                  {icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold truncate text-xs">{role.name}</p>
                    {role.isSystem && <Lock className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t("roles.userCount", { count: role.userCount })}</p>
                  <div className="mt-1">
                    <ModuleChips modules={role.modules} isSystem={role.isSystem} />
                  </div>
                </div>
                {selectedRoleId === role.id && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 self-start mt-1" />}
              </button>
            );
          })}
        </div>

        {/* Right — Permission matrix */}
        <div className="flex-1 bg-card border border-border rounded-2xl flex flex-col overflow-hidden min-w-0">

          {/* Role header bar */}
          {selectedRole ? (
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center text-xl border",
                  ROLE_COLORS[(rolesList.findIndex(r => r.id === selectedRoleId)) % ROLE_COLORS.length]
                )}>
                  {ROLE_ICONS[(rolesList.findIndex(r => r.id === selectedRoleId)) % ROLE_ICONS.length]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold">{selectedRole.name}</h2>
                    {selectedRole.isSystem
                      ? <span className="flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium"><Lock className="h-2.5 w-2.5" />{t("roles.system")}</span>
                      : <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{t("roles.custom")}</span>
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedRole.description || t("roles.noDescription")}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground/70 font-medium">{t("roles.linkedTo")}</span>
                    <ModuleChips
                      modules={rolesList.find(r => r.id === selectedRoleId)?.modules ?? []}
                      isSystem={selectedRole.isSystem}
                      max={8}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {hasChanges && !isReadOnly && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <Button size="sm" className="gap-1.5 h-8" onClick={handleSave} disabled={savePerms.isPending}>
                      {savePerms.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <><Save className="h-3.5 w-3.5" />{t("common:action.save")}</>
                      }
                    </Button>
                  </motion.div>
                )}
                {!isReadOnly && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                    onClick={() => setShowEdit(true)}>
                    {t("roles.edit")}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleClone}
                  disabled={createRole.isPending}>
                  <Copy className="h-3 w-3" />{t("roles.clone")}
                </Button>
                {!isReadOnly && (
                  <Button variant="outline" size="sm"
                    className="h-8 gap-1 text-xs text-destructive hover:text-destructive hover:border-destructive/40"
                    onClick={() => setShowDelete(true)}>
                    <Trash2 className="h-3 w-3" />{t("common:action.delete")}
                  </Button>
                )}
              </div>
            </div>
          ) : roleDetailLoading ? (
            <div className="flex items-center justify-center py-6 border-b border-border">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {/* Column header + search */}
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-3 shrink-0">
            <div className="relative w-44 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input placeholder={t("roles.filterModules")} value={search} onChange={e => setSearch(e.target.value)}
                className="pl-7 h-7 text-xs" />
            </div>
            <div className="flex items-center gap-1 ml-1">
              {ACTION_ORDER.map(action => (
                <div key={action} className="w-8 text-center text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {actionShortLabel(action)}
                </div>
              ))}
            </div>
          </div>

          {/* Module matrix */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : orderedGroups.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">{t("roles.noMatches")}</div>
            ) : (
              orderedGroups.map(group => (
                <div key={group}>
                  <button
                    className="w-full flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border hover:bg-muted/50 transition-colors"
                    onClick={() => toggleGroup(group)}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">{groupLabel(group)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {t("roles.moduleCount", { count: filteredByGroup[group]?.length ?? 0 })}
                      </span>
                    </div>
                    {expandedGroups.has(group)
                      ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </button>
                  <AnimatePresence initial={false}>
                    {expandedGroups.has(group) && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} style={{ overflow: "hidden" }}>
                        {(filteredByGroup[group] ?? []).map(moduleId => (
                          <ModuleRow
                            key={moduleId}
                            moduleId={moduleId}
                            permsMap={permActionMap[moduleId] ?? {}}
                            selectedIds={pendingIds}
                            onToggle={togglePerm}
                            disabled={isReadOnly || !selectedRole}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>

          {/* Footer legend */}
          <div className="px-5 py-2.5 border-t border-border bg-muted/10 flex items-center gap-6 text-[10px] text-muted-foreground shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-lg bg-primary border border-primary flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
              <span>{t("roles.legendGranted")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-lg bg-muted/20 border border-border" />
              <span>{t("roles.legendNotGranted")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground/30 font-mono">—</span>
              <span>{t("roles.legendNotApplicable")}</span>
            </div>
            {selectedRole && (
              <span className="ml-auto font-medium text-foreground">
                {t("roles.grantedCount", { granted: pendingIds.size, total: allPerms.length })}
              </span>
            )}
            {isReadOnly && (
              <div className="flex items-center gap-1 ml-auto">
                <Lock className="h-3 w-3" />
                <span>{t("roles.readOnlyNote")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <RoleFormModal title={t("roles.createTitle")} loading={createRole.isPending}
            onSave={handleCreate} onClose={() => setShowCreate(false)} />
        )}
        {showEdit && selectedRole && (
          <RoleFormModal title={t("roles.editTitle")} loading={updateRole.isPending}
            initial={{ name: selectedRole.name, description: selectedRole.description }}
            onSave={handleEdit} onClose={() => setShowEdit(false)} />
        )}
        {showDelete && selectedRole && (
          <ConfirmDeleteModal roleName={selectedRole.name}
            loading={deleteRole.isPending} onConfirm={handleDelete}
            onCancel={() => setShowDelete(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

