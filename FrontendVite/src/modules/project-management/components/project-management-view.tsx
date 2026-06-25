import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, FolderKanban, Loader2, AlertTriangle, Archive, ArchiveRestore,
  Trash2, KanbanSquare, ListTodo, ListChecks, MoreVertical, User, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  useProjects, useArchiveProject, useActivateProject, useDeleteProject,
} from "@/hooks/project-management/use-projects";
import type { ProjectSummaryDto } from "@/lib/project-management/projects.api";
import { CreateProjectForm } from "./create-project-form";
import { ManageMembersModal } from "./manage-members-modal";

export function ProjectManagementView() {
  const navigate = useNavigate();
  const { hasRawPermission } = useAuthStore();
  const canCreate = hasRawPermission("project-management.projects.create");
  const canEdit = hasRawPermission("project-management.projects.edit");
  const canDelete = hasRawPermission("project-management.projects.delete");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"active" | "archived" | "all">("active");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<ProjectSummaryDto | null>(null);
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [membersProject, setMembersProject] = React.useState<ProjectSummaryDto | null>(null);

  const { data, isLoading } = useProjects();
  const archive = useArchiveProject();
  const activate = useActivateProject();
  const deleteProject = useDeleteProject();

  const projects = (data ?? []).filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.key.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteProject.mutate(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Project Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Plan, track and ship work with Kanban boards, sprints and issues</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Project
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search projects…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
          {(["active", "archived", "all"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors",
                statusFilter === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading projects…</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FolderKanban className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">No projects found</p>
            <p className="text-xs text-muted-foreground mt-0.5">Create a project to get started with boards, sprints and issues.</p>
          </div>
          {canCreate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => {
            const total = p.totalIssues || 0;
            const segments = [
              { count: p.doneCount, color: "bg-success" },
              { count: p.inProgressCount, color: "bg-primary" },
              { count: p.todoCount, color: "bg-muted-foreground/40" },
            ];

            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="group relative bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                onClick={() => navigate(`/project-management/${p.id}/board`)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{p.key}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      {p.leadName && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <User className="h-3 w-3" /> {p.leadName}
                        </p>
                      )}
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMembersProject(p); }}
                      title="Manage members"
                      className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Users className="h-4 w-4" />
                    </button>
                  )}

                  {(canEdit || canDelete) && (
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id); }}
                        className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      <AnimatePresence>
                        {openMenuId === p.id && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg z-10 py-1">
                            {canEdit && (p.status === "active" ? (
                              <button onClick={() => { archive.mutate(p.id); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/30 text-left">
                                <Archive className="h-3.5 w-3.5" /> Archive
                              </button>
                            ) : (
                              <button onClick={() => { activate.mutate(p.id); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/30 text-left">
                                <ArchiveRestore className="h-3.5 w-3.5" /> Activate
                              </button>
                            ))}
                            {canDelete && (
                              <button onClick={() => { setPendingDelete(p); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-destructive/10 text-destructive text-left">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {p.description && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{p.description}</p>
                )}

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">{total} issue{total === 1 ? "" : "s"}</span>
                    <span className="text-xs font-semibold text-success">{total > 0 ? Math.round((p.doneCount / total) * 100) : 0}% done</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden flex">
                    {total > 0 && segments.map((s, idx) => s.count > 0 && (
                      <div key={idx} className={cn("h-full", s.color)} style={{ width: `${(s.count / total) * 100}%` }} />
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><ListTodo className="h-3 w-3" /> {p.todoCount} to do</span>
                  <span className="flex items-center gap-1"><KanbanSquare className="h-3 w-3" /> {p.inProgressCount} in progress</span>
                  <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> {p.doneCount} done</span>
                </div>

                {p.status === "archived" && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                    Archived
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <CreateProjectForm open={createOpen} onClose={() => setCreateOpen(false)} />

      <AnimatePresence>
        {membersProject && (
          <ManageMembersModal
            projectId={membersProject.id}
            projectName={membersProject.name}
            onClose={() => setMembersProject(null)}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {pendingDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Delete Project?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">"{pendingDelete.name}" and its boards, sprints and issues will be removed.</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleteProject.isPending}>
                  {deleteProject.isPending ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
