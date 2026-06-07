"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
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

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_ORDER = ["view","create","edit","delete","approve","export","print","void","refund","discount","adjust"] as const;
type Action = typeof ACTION_ORDER[number];

const ACTION_LABELS: Record<Action, string> = {
  view: "View", create: "Create", edit: "Edit", delete: "Delete",
  approve: "Approve", export: "Export", print: "Print",
  void: "Void", refund: "Refund", discount: "Discount", adjust: "Adjust",
};

const MODULE_GROUPS: Record<string, string> = {
  inventory: "Inventory", pos: "POS", finance: "Finance", hr: "HR",
  crm: "CRM", sales: "Sales", purchase: "Purchase", settings: "Settings",
};

const GROUP_ORDER = ["POS","Inventory","Finance","Sales","Purchase","CRM","HR","Settings"];

const ROLE_ICONS = ["🔑","👔","💼","📊","🎯","🛡️","👁️","⚙️","🔧","📋"];
const ROLE_COLORS = [
  "bg-destructive/10 text-destructive border-destructive/20",
  "bg-primary/10 text-primary border-primary/20",
  "bg-violet-500/10 text-violet-600 border-violet-500/20",
  "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupPermissions(perms: PermissionDto[]) {
  // moduleId examples: "pos.sessions", "finance.invoicing"
  // group by prefix before first dot
  const byModule: Record<string, PermissionDto[]> = {};
  for (const p of perms) {
    if (!byModule[p.moduleId]) byModule[p.moduleId] = [];
    byModule[p.moduleId].push(p);
  }
  // group modules by prefix
  const byGroup: Record<string, string[]> = {};
  for (const moduleId of Object.keys(byModule)) {
    const prefix = moduleId.split(".")[0];
    const group = MODULE_GROUPS[prefix] ?? prefix;
    if (!byGroup[group]) byGroup[group] = [];
    if (!byGroup[group].includes(moduleId)) byGroup[group].push(moduleId);
  }
  // sort modules within each group
  for (const g of Object.keys(byGroup)) {
    byGroup[g].sort();
  }
  return { byModule, byGroup };
}

function moduleLabel(moduleId: string) {
  const parts = moduleId.split(".");
  if (parts.length < 2) return moduleId;
  return parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

// ── Confirm Delete Modal ───────────────────────────────────────────────────────

function ConfirmDeleteModal({
  roleName, onConfirm, onCancel, loading,
}: { roleName: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
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
              <h3 className="font-bold text-foreground">Delete role?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone.</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            <span className="font-semibold text-foreground">"{roleName}"</span> will be permanently deleted.
            Users assigned this role will lose its permissions.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1.5" />Delete</>}
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role Name *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Warehouse Manager" className="h-9" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
              <Input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Short description of what this role can do" className="h-9" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={() => onSave(name, description)}
                disabled={!name.trim() || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
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
  // ── API data ──────────────────────────────────────────────────────────────────
  const { data: rolesData, isLoading: rolesLoading, refetch: refetchRoles } = useRoles({ pageSize: 100 });
  const { data: allPermsData, isLoading: permsLoading } = useAllPermissions();

  const rolesList = rolesData?.items ?? [];
  const allPerms  = allPermsData?.items ?? [];

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
      const filtered = modules.filter(m =>
        !q || m.toLowerCase().includes(q) || group.toLowerCase().includes(q) || moduleLabel(m).toLowerCase().includes(q)
      );
      if (filtered.length > 0) result[group] = filtered;
    }
    return result;
  }, [byGroup, search]);

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
      { name: `${selectedRole.name} (Copy)`, description: selectedRole.description },
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
          toast.success("Role cloned successfully.");
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
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define what each role can see and do across all modules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetchRoles()}
            disabled={rolesLoading}>
            <RefreshCw className={cn("h-4 w-4", rolesLoading && "animate-spin")} />
          </Button>
          <Button size="sm" className="gap-1.5 h-9" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />New Role
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Roles",  value: stats.total },
          { label: "System Roles", value: stats.system },
          { label: "Custom Roles", value: stats.custom },
          { label: "Total Users",  value: stats.users },
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
                  <p className="text-[10px] text-muted-foreground">{role.userCount} user{role.userCount !== 1 ? "s" : ""}</p>
                </div>
                {selectedRoleId === role.id && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
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
                      ? <span className="flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium"><Lock className="h-2.5 w-2.5" />System</span>
                      : <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Custom</span>
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedRole.description || "No description"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {hasChanges && !isReadOnly && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <Button size="sm" className="gap-1.5 h-8" onClick={handleSave} disabled={savePerms.isPending}>
                      {savePerms.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <><Save className="h-3.5 w-3.5" />Save</>
                      }
                    </Button>
                  </motion.div>
                )}
                {!isReadOnly && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                    onClick={() => setShowEdit(true)}>
                    Edit
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleClone}
                  disabled={createRole.isPending}>
                  <Copy className="h-3 w-3" />Clone
                </Button>
                {!isReadOnly && (
                  <Button variant="outline" size="sm"
                    className="h-8 gap-1 text-xs text-destructive hover:text-destructive hover:border-destructive/40"
                    onClick={() => setShowDelete(true)}>
                    <Trash2 className="h-3 w-3" />Delete
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
              <Input placeholder="Filter modules…" value={search} onChange={e => setSearch(e.target.value)}
                className="pl-7 h-7 text-xs" />
            </div>
            <div className="flex items-center gap-1 ml-1">
              {ACTION_ORDER.map(action => (
                <div key={action} className="w-8 text-center text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {ACTION_LABELS[action].slice(0, 3)}
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
              <div className="py-16 text-center text-sm text-muted-foreground">No modules match your search.</div>
            ) : (
              orderedGroups.map(group => (
                <div key={group}>
                  <button
                    className="w-full flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border hover:bg-muted/50 transition-colors"
                    onClick={() => toggleGroup(group)}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">{group}</span>
                      <span className="text-[10px] text-muted-foreground">
                        ({filteredByGroup[group]?.length ?? 0} modules)
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
              <span>Granted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-lg bg-muted/20 border border-border" />
              <span>Not granted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground/30 font-mono">—</span>
              <span>Not applicable</span>
            </div>
            {selectedRole && (
              <span className="ml-auto font-medium text-foreground">
                {pendingIds.size} / {allPerms.length} permissions granted
              </span>
            )}
            {isReadOnly && (
              <div className="flex items-center gap-1 ml-auto">
                <Lock className="h-3 w-3" />
                <span>System roles are read-only — clone to customise</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <RoleFormModal title="Create New Role" loading={createRole.isPending}
            onSave={handleCreate} onClose={() => setShowCreate(false)} />
        )}
        {showEdit && selectedRole && (
          <RoleFormModal title="Edit Role" loading={updateRole.isPending}
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
