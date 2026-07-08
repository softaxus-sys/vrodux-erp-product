import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Users, UserCheck, UserX, Mail, Shield,
  X, Edit, Trash2, Eye, Clock, Layers, Loader2, RefreshCw, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDate, getInitials } from "@/lib/utils";
import {
  useUsers, useUser, useCreateUser, useUpdateUser, useDeleteUser,
  useAssignRole, useRemoveRole,
} from "@/hooks/identity/use-users";
import { useRoles } from "@/hooks/identity/use-roles";
import type { UserSummaryDto, UserDto } from "@/lib/identity/types";
import { UserPermissionsTab } from "./user-permissions-tab";
import { Can } from "@/components/auth/can";

// ── Local role/status config ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active:   { label: "Active",   color: "text-success",          bg: "bg-success/10", dot: "bg-success" },
  inactive: { label: "Inactive", color: "text-muted-foreground", bg: "bg-muted",      dot: "bg-muted-foreground" },
  invited:  { label: "Invited",  color: "text-warning",          bg: "bg-warning/10", dot: "bg-warning" },
};

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500",
];

function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const c = STATUS_CONFIG[s] ?? STATUS_CONFIG.inactive;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", c.color, c.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />{c.label}
    </span>
  );
}

function RoleBadge({ roleName }: { roleName: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
      {roleName}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ── Confirm Delete Modal ──────────────────────────────────────────────────────

function ConfirmDeleteModal({
  userName, onConfirm, onCancel, loading,
}: { userName: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <>
      <motion.div className="fixed inset-0 bg-black/40 z-50" initial={{ opacity: 0 }}
        animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} />
      <motion.div className="fixed inset-0 flex items-center justify-center z-[60] p-4"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Delete user?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone.</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            <span className="font-semibold text-foreground">"{userName}"</span> will be permanently
            deleted and all their sessions revoked.
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

// ── User Drawer ───────────────────────────────────────────────────────────────

function UserDrawer({
  userId, onClose, onEdit, onDelete,
}: {
  userId: string;
  onClose: () => void;
  onEdit: (user: UserDto) => void;
  onDelete: (user: UserDto) => void;
}) {
  const { data: user, isLoading } = useUser(userId);
  const [tab, setTab] = React.useState<"profile" | "permissions">("profile");

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Panel — widens for the permission matrix */}
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "fixed right-0 top-0 h-full w-full bg-background border-l border-border z-50 flex flex-col transition-[max-width] duration-300",
          tab === "permissions" ? "max-w-3xl" : "max-w-md",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-1">
            {(["profile", "permissions"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors",
                  tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/40",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {tab === "permissions" ? (
          isLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : user ? (
            <UserPermissionsTab user={user} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">User not found.</p>
          )
        ) : (
        <>
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : user ? (
            <div className="space-y-6">
              {/* Profile header */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className={cn("text-white text-lg font-bold", avatarColor(user.fullName))}>
                    {getInitials(user.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-bold">{user.fullName}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {user.roles.map(r => <RoleBadge key={r.id} roleName={r.name} />)}
                    <StatusBadge status={user.status} />
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-xl p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="text-sm font-medium mt-0.5">{user.username}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium mt-0.5">{user.phoneNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="text-sm font-medium mt-0.5">{formatDate(user.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Login</p>
                  <p className="text-sm font-medium mt-0.5">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt, "relative") : "Never"}
                  </p>
                </div>
              </div>

              {/* Roles + Permissions */}
              {user.roles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Roles & Permissions</p>
                  </div>
                  <div className="space-y-3">
                    {user.roles.map(role => (
                      <div key={role.id} className="border border-border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-semibold">{role.name}</span>
                          {role.isSystem && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-medium text-muted-foreground">SYSTEM</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.map(p => (
                            <span key={p.id} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">
                              {p.key}
                            </span>
                          ))}
                          {role.permissions.length === 0 && (
                            <span className="text-xs text-muted-foreground">No permissions assigned</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">User not found.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-2">
          <Button
            className="flex-1"
            variant="outline"
            disabled={!user}
            onClick={() => user && onEdit(user)}
          >
            <Edit className="h-4 w-4 mr-1.5" />Edit User
          </Button>
          {user && (
            <Button
              variant="destructive"
              size="icon"
              onClick={() => onDelete(user)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        </>
        )}
      </motion.div>
    </>
  );
}

// ── Create User Modal ─────────────────────────────────────────────────────────

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const { data: rolesData } = useRoles({ pageSize: 100 });
  const createUser = useCreateUser();

  const [form, setForm] = React.useState({
    firstName: "", lastName: "", email: "", username: "", password: "", roleId: "",
  });

  const handleCreate = () => {
    if (!form.firstName || !form.email || !form.password) return;
    createUser.mutate(
      {
        firstName: form.firstName,
        lastName:  form.lastName,
        email:     form.email,
        username:  form.username || form.email.split("@")[0],
        password:  form.password,
        roleIds:   form.roleId ? [form.roleId] : [],
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Create New User</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">First Name *</label>
                <Input
                  value={form.firstName}
                  onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                  placeholder="Ahmed"
                  className="h-9 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Name</label>
                <Input
                  value={form.lastName}
                  onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                  placeholder="Khan"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
              <Input
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="ahmed@softaxis.io"
                type="email"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Username</label>
              <Input
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                placeholder="auto-generated from email"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password *</label>
              <Input
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                type="password"
                placeholder="Min 8 chars"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</label>
              <select
                value={form.roleId}
                onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">No role assigned</option>
                {(rolesData?.items ?? []).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="pt-2 flex gap-2">
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={createUser.isPending || !form.firstName || !form.email || !form.password}
              >
                {createUser.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Creating…</>
                  : "Create User"}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={createUser.isPending}>Cancel</Button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Edit User Modal ───────────────────────────────────────────────────────────

// ── Role manager — add / remove a user's roles (live) ──────────────────────────
function RoleManager({ userId }: { userId: string }) {
  // Fetch fresh detail so the list reflects assign/remove immediately (both invalidate this query).
  const { data: user } = useUser(userId);
  const { data: rolesData } = useRoles({ pageSize: 100 });
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const [addRoleId, setAddRoleId] = React.useState("");

  const roles = user?.roles ?? [];
  const assignedIds = new Set(roles.map(r => r.id));
  const available = (rolesData?.items ?? []).filter(r => !assignedIds.has(r.id));
  const busy = assignRole.isPending || removeRole.isPending;

  const add = () => {
    if (!addRoleId) return;
    assignRole.mutate({ userId, roleId: addRoleId }, { onSuccess: () => setAddRoleId("") });
  };

  return (
    <div className="space-y-2 pt-1 border-t border-border">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Roles</label>
      <div className="space-y-1.5">
        {roles.map(role => (
          <div key={role.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center gap-2 min-w-0">
              <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">{role.name}</span>
              {role.isSystem && (
                <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-medium text-muted-foreground shrink-0">SYSTEM</span>
              )}
            </div>
            <button type="button" title="Remove role" disabled={busy}
              onClick={() => removeRole.mutate({ userId, roleId: role.id })}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {roles.length === 0 && (
          <p className="text-xs text-muted-foreground">No roles assigned — add one below.</p>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <select value={addRoleId} onChange={e => setAddRoleId(e.target.value)} disabled={busy || available.length === 0}
          className="flex-1 h-9 px-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50">
          <option value="">{available.length ? "Add a role…" : "All roles assigned"}</option>
          {available.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <Button type="button" size="sm" className="h-9 gap-1.5" onClick={add} disabled={!addRoleId || busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Add
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Changes apply immediately. To switch a user's role, add the new one and remove the old.
      </p>
    </div>
  );
}

function EditUserModal({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const updateUser = useUpdateUser(user.id);
  const [form, setForm] = React.useState({
    firstName:   user.firstName   ?? "",
    lastName:    user.lastName    ?? "",
    phoneNumber: user.phoneNumber ?? "",
  });

  const handleSave = () => {
    updateUser.mutate(
      {
        firstName:   form.firstName,
        lastName:    form.lastName,
        phoneNumber: form.phoneNumber || null,
        avatarUrl:   user.avatarUrl ?? null,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Edit User</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Email (read-only) */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">First Name *</label>
                <Input
                  value={form.firstName}
                  onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                  className="h-9 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Name</label>
                <Input
                  value={form.lastName}
                  onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
              <Input
                value={form.phoneNumber}
                onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))}
                placeholder="+971 50 123 4567"
                className="h-9 text-sm"
              />
            </div>

            {/* Role management — add/remove the user's roles (settings.users.edit only) */}
            <Can permission="settings.users.edit">
              <RoleManager userId={user.id} />
            </Can>

            <div className="pt-2 flex gap-2">
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={updateUser.isPending || !form.firstName.trim()}
              >
                {updateUser.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
                  : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={updateUser.isPending}>Cancel</Button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function UsersView() {
  const [search, setSearch]               = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage]                   = React.useState(1);
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [editUser, setEditUser]           = React.useState<UserDto | null>(null);
  const [deleteTarget, setDeleteTarget]   = React.useState<UserDto | null>(null);
  const [showCreate, setShowCreate]       = React.useState(false);

  const deleteUser = useDeleteUser();

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setPage(1); }, [debouncedSearch]);

  const { data, isLoading, isError, refetch, isFetching } = useUsers({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
  });

  const users       = data?.items ?? [];
  const totalCount  = data?.totalCount ?? 0;
  const totalPages  = data?.totalPages ?? 1;

  // Stats based on current page slice + total from API
  const stats = React.useMemo(() => ({
    total:    totalCount,
    active:   users.filter(u => u.status.toLowerCase() === "active").length,
    inactive: users.filter(u => u.status.toLowerCase() === "inactive").length,
    withRoles: users.filter(u => u.roleCount > 0).length,
  }), [users, totalCount]);

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteUser.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        setSelectedUserId(null);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage team access, roles, and permissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          <Can permission="settings.users.create">
            <Button className="gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />Create User
            </Button>
          </Can>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users"  value={stats.total}     icon={Users}     color="bg-primary/10 text-primary" />
        <StatCard label="Active"       value={stats.active}    icon={UserCheck} color="bg-success/10 text-success" />
        <StatCard label="Inactive"     value={stats.inactive}  icon={UserX}     color="bg-muted text-muted-foreground" />
        <StatCard label="With Roles"   value={stats.withRoles} icon={Shield}    color="bg-destructive/10 text-destructive" />
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load users.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Roles</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Joined</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn("text-white text-xs font-bold", avatarColor(user.fullName))}>
                            {getInitials(user.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.fullName}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.roleCount > 0 ? (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                          {user.roleCount} role{user.roleCount > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No roles</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs">{formatDate(user.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 px-2.5 text-xs gap-1"
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />View
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !isError && users.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No users match your search.
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Showing {users.length} of {totalCount} users
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="outline" size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* User Drawer — AnimatePresence lives in PARENT so exit animation plays */}
      <AnimatePresence>
        {selectedUserId && (
          <UserDrawer
            userId={selectedUserId}
            onClose={() => setSelectedUserId(null)}
            onEdit={(user) => { setEditUser(user); setSelectedUserId(null); }}
            onDelete={(user) => { setDeleteTarget(user); setSelectedUserId(null); }}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDeleteModal
            userName={deleteTarget.fullName}
            loading={deleteUser.isPending}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
