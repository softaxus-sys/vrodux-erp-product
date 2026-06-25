import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, AlertTriangle, Loader2, Search, Crown, Eye, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useProjectMembers, useAddProjectMember, useUpdateProjectMemberRole, useRemoveProjectMember,
} from "@/hooks/project-management/use-project-members";
import type { ProjectMemberDto, ProjectMemberRole } from "@/lib/project-management/project-members.api";
import { usersApi } from "@/lib/identity/users.api";
import type { UserSummaryDto } from "@/lib/identity/types";
import { useAuthStore } from "@/store/auth.store";

interface ManageMembersModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

const ROLE_OPTIONS: { value: ProjectMemberRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const ROLE_ICONS: Record<ProjectMemberRole, React.ReactNode> = {
  owner: <Crown className="h-3 w-3" />,
  member: <UserCog className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />,
};

export function ManageMembersModal({ projectId, projectName, onClose }: ManageMembersModalProps) {
  const { hasRawPermission } = useAuthStore();
  const canManage = hasRawPermission("project-management.projects.edit");

  const { data: members = [], isLoading } = useProjectMembers(projectId);
  const addMember = useAddProjectMember(projectId);
  const updateRole = useUpdateProjectMemberRole(projectId);
  const removeMember = useRemoveProjectMember(projectId);

  const [search, setSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<UserSummaryDto[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<ProjectMemberDto | null>(null);

  const ownerCount = members.filter(m => m.role === "owner").length;
  const memberUserIds = new Set(members.map(m => m.userId));

  React.useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      usersApi.getAll({ search: search.trim(), pageSize: 8 })
        .then(res => { if (active) setSearchResults(res.items.filter(u => !memberUserIds.has(u.id))); })
        .catch(() => { if (active) setSearchResults([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, members.length]);

  const handleAdd = async (user: UserSummaryDto) => {
    try {
      await addMember.mutateAsync({ userId: user.id, userName: user.fullName || user.username, userEmail: user.email, role: "member" });
      setSearch("");
      setSearchResults([]);
    } catch { /* hook toasts the error */ }
  };

  const handleRoleChange = async (member: ProjectMemberDto, role: ProjectMemberRole) => {
    try {
      await updateRole.mutateAsync({ memberId: member.id, role });
    } catch { /* hook toasts the error */ }
  };

  const confirmRemove = () => {
    if (!pendingDelete) return;
    removeMember.mutate(pendingDelete.id);
    setPendingDelete(null);
  };

  const isLastOwner = (m: ProjectMemberDto) => m.role === "owner" && ownerCount <= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold">Project Members</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{projectName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading members…</span>
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No members yet.</p>
          ) : (
            members.map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-muted/20 border border-border rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{m.userName}</p>
                  {m.userEmail && <p className="text-xs text-muted-foreground truncate">{m.userEmail}</p>}
                </div>
                {canManage ? (
                  <select
                    value={m.role}
                    onChange={e => handleRoleChange(m, e.target.value as ProjectMemberRole)}
                    disabled={isLastOwner(m) || updateRole.isPending}
                    className="h-8 text-xs rounded-md border border-border bg-card px-2 capitalize">
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1 rounded bg-muted/40 capitalize">
                    {ROLE_ICONS[m.role]} {m.role}
                  </span>
                )}
                {canManage && (
                  <button
                    onClick={() => setPendingDelete(m)}
                    disabled={isLastOwner(m)}
                    title={isLastOwner(m) ? "Cannot remove the only owner" : "Remove member"}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}

          {canManage && (
            <div className="pt-2 border-t border-border mt-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input placeholder="Search users to add…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm" />
              </div>
              {searching && (
                <div className="flex items-center justify-center py-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </div>
              )}
              {!searching && searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map(u => (
                    <button key={u.id} onClick={() => handleAdd(u)} disabled={addMember.isPending}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/20 text-left transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.fullName || u.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {!searching && search.trim() && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No matching users found.</p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {pendingDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Remove Member?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">"{pendingDelete.userName}" will lose access to this project.</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={confirmRemove} disabled={removeMember.isPending}>
                  {removeMember.isPending ? "Removing…" : "Remove"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
