import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ArrowLeft, ListIcon, ListTodo, ListChecks, Plus, Loader2, Play, CheckCircle2, Trash2, AlertTriangle, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useProject } from "@/hooks/project-management/use-projects";
import {
  useSprints, useCreateSprint, useStartSprint, useCompleteSprint, useDeleteSprint,
} from "@/hooks/project-management/use-sprints";
import { useIssues, useMoveIssueToSprint, useCreateIssue } from "@/hooks/project-management/use-issues";
import type { IssueSummaryDto } from "@/lib/project-management/issues.api";
import type { SprintDto } from "@/lib/project-management/sprints.api";
import { SortableIssueCard } from "./issue-card";
import { IssueDetailDrawer } from "./issue-detail-drawer";
import { useAuthStore } from "@/store/auth.store";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planned:   { label: "Planned",   color: "text-muted-foreground", bg: "bg-muted/50" },
  active:    { label: "Active",    color: "text-success",          bg: "bg-success/10" },
  completed: { label: "Completed", color: "text-primary",          bg: "bg-primary/10" },
};

function Section({
  containerId, title, badge, issues, onCardClick, onQuickAdd, children, canDrag, canCreate,
}: {
  containerId: string;
  title: React.ReactNode;
  badge?: React.ReactNode;
  issues: IssueSummaryDto[];
  onCardClick: (id: string) => void;
  onQuickAdd: (title: string) => void;
  children?: React.ReactNode;
  canDrag: boolean;
  canCreate: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: containerId });
  const [adding, setAdding] = React.useState(false);
  const [title2, setTitle2] = React.useState("");

  const submit = () => {
    if (!title2.trim()) { setAdding(false); return; }
    onQuickAdd(title2.trim());
    setTitle2("");
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {title}
          <span className="text-xs text-muted-foreground">({issues.length} issue{issues.length === 1 ? "" : "s"})</span>
        </div>
        {badge}
      </div>
      <div ref={setNodeRef} className={cn("p-2 space-y-2 min-h-[64px] transition-colors", isOver && "bg-primary/5")}>
        <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map(issue => (
            <SortableIssueCard key={issue.id} issue={issue} onClick={() => onCardClick(issue.id)} canDrag={canDrag} />
          ))}
        </SortableContext>
        {issues.length === 0 && (
          <div className="h-12 rounded-lg border border-dashed border-border/60 flex items-center justify-center text-[11px] text-muted-foreground">
            Drop issues here
          </div>
        )}
        {canCreate && (adding ? (
          <Input value={title2} onChange={e => setTitle2(e.target.value)} autoFocus
            placeholder="Issue title…"
            onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setTitle2(""); } }}
            onBlur={submit}
            className="h-8 text-sm" />
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add issue
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

export function BacklogView() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { hasRawPermission } = useAuthStore();
  const canCreateSprint = hasRawPermission("project-management.sprints.create");
  const canEditSprint = hasRawPermission("project-management.sprints.edit");
  const canDeleteSprint = hasRawPermission("project-management.sprints.delete");
  const canEditIssues = hasRawPermission("project-management.issues.edit");
  const canCreateIssues = hasRawPermission("project-management.issues.create");

  const { data: project } = useProject(projectId);
  const { data: sprints = [], isLoading: sprintsLoading } = useSprints(projectId);
  const { data: issuesData = [], isLoading: issuesLoading } = useIssues({ projectId });

  const createSprint = useCreateSprint(projectId);
  const startSprint = useStartSprint(projectId);
  const completeSprint = useCompleteSprint(projectId);
  const deleteSprint = useDeleteSprint(projectId);
  const moveToSprint = useMoveIssueToSprint();
  const createIssue = useCreateIssue();

  const [selectedIssueId, setSelectedIssueId] = React.useState<string | null>(null);
  const [creatingSprint, setCreatingSprint] = React.useState(false);
  const [sprintName, setSprintName] = React.useState("");
  const [sprintGoal, setSprintGoal] = React.useState("");
  const [confirmAction, setConfirmAction] = React.useState<{ type: "start" | "complete" | "delete"; sprint: SprintDto } | null>(null);

  const activeSprints = React.useMemo(
    () => [...sprints].filter(s => s.status !== "completed").sort((a, b) => a.sortOrder - b.sortOrder),
    [sprints]
  );

  const [board, setBoard] = React.useState<Record<string, IssueSummaryDto[]>>({});

  React.useEffect(() => {
    const map: Record<string, IssueSummaryDto[]> = { backlog: [] };
    for (const s of activeSprints) map[s.id] = [];
    for (const issue of issuesData) {
      const key = issue.sprintId && map[issue.sprintId] ? issue.sprintId : "backlog";
      map[key].push(issue);
    }
    for (const id of Object.keys(map)) map[id].sort((a, b) => a.sortOrder - b.sortOrder);
    setBoard(map);
  }, [issuesData, activeSprints]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    let sourceKey: string | undefined;
    for (const [key, items] of Object.entries(board)) {
      if (items.some(i => i.id === activeId)) { sourceKey = key; break; }
    }
    if (!sourceKey) return;

    const destKey = board[overId]
      ? overId
      : Object.entries(board).find(([, items]) => items.some(i => i.id === overId))?.[0] ?? sourceKey;

    const sourceItems = [...board[sourceKey]];
    const activeIndex = sourceItems.findIndex(i => i.id === activeId);
    const [moved] = sourceItems.splice(activeIndex, 1);

    let destItems = sourceKey === destKey ? sourceItems : [...board[destKey]];
    let destIndex = destItems.findIndex(i => i.id === overId);
    if (destIndex === -1) destIndex = destItems.length;
    destItems.splice(destIndex, 0, moved);

    setBoard(prev => ({
      ...prev,
      [sourceKey!]: sourceKey === destKey ? destItems : sourceItems,
      [destKey]: destItems,
    }));

    moveToSprint.mutate({ id: activeId, payload: { sprintId: destKey === "backlog" ? null : destKey, sortOrder: destIndex } });
  };

  const handleQuickAdd = (sprintId: string | null) => (title: string) => {
    createIssue.mutate({ projectId, title, type: "task", priority: "medium", sprintId: sprintId ?? undefined });
  };

  const handleCreateSprint = async () => {
    if (!sprintName.trim()) return;
    try {
      await createSprint.mutateAsync({ name: sprintName.trim(), goal: sprintGoal.trim() || undefined });
      setSprintName(""); setSprintGoal(""); setCreatingSprint(false);
    } catch { /* hook toasts the error */ }
  };

  const runConfirmAction = () => {
    if (!confirmAction) return;
    const { type, sprint } = confirmAction;
    if (type === "start") startSprint.mutate(sprint.id);
    if (type === "complete") completeSprint.mutate(sprint.id);
    if (type === "delete") deleteSprint.mutate(sprint.id);
    setConfirmAction(null);
  };

  const isLoading = sprintsLoading || issuesLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/project-management" className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{project?.name ?? "Backlog"}</h1>
            {project && <p className="text-xs text-muted-foreground font-mono">{project.key}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
            <Link to={`/project-management/${projectId}/board`} className="px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <ListIcon className="h-3.5 w-3.5" /> Board
            </Link>
            <Link to={`/project-management/${projectId}/backlog`} className="px-3 py-1.5 rounded-md text-xs font-semibold bg-card text-foreground shadow-sm flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5" /> Backlog
            </Link>
            <Link to={`/project-management/${projectId}/issues`} className="px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" /> Issues
            </Link>
          </div>
          {canCreateSprint && (
            <Button size="sm" onClick={() => setCreatingSprint(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Sprint
            </Button>
          )}
        </div>
      </div>

      {/* New sprint form */}
      <AnimatePresence>
        {creatingSprint && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-xl p-4 space-y-3 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sprint Name *</label>
                <Input value={sprintName} onChange={e => setSprintName(e.target.value)} placeholder="e.g. Sprint 1" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Goal</label>
                <Input value={sprintGoal} onChange={e => setSprintGoal(e.target.value)} placeholder="What's the goal of this sprint?" className="h-9 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setCreatingSprint(false); setSprintName(""); setSprintGoal(""); }}>Cancel</Button>
              <Button size="sm" onClick={handleCreateSprint} disabled={!sprintName.trim() || createSprint.isPending}>
                {createSprint.isPending ? "Creating…" : "Create Sprint"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading backlog…</span>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={canEditIssues ? handleDragEnd : undefined}>
          <div className="space-y-4">
            {activeSprints.map(sprint => {
              const sc = STATUS_CONFIG[sprint.status] ?? STATUS_CONFIG.planned;
              return (
                <Section key={sprint.id} containerId={sprint.id} issues={board[sprint.id] ?? []}
                  onCardClick={setSelectedIssueId} onQuickAdd={handleQuickAdd(sprint.id)}
                  canDrag={canEditIssues} canCreate={canCreateIssues}
                  title={
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold truncate">{sprint.name}</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", sc.color, sc.bg)}>{sc.label}</span>
                      {sprint.goal && <span className="text-xs text-muted-foreground truncate hidden sm:inline">— {sprint.goal}</span>}
                      {(sprint.startDate || sprint.endDate) && (
                        <span className="text-[11px] text-muted-foreground hidden md:inline">
                          {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
                        </span>
                      )}
                    </div>
                  }
                  badge={
                    <div className="flex items-center gap-1.5">
                      {canEditSprint && sprint.status === "planned" && (
                        <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: "start", sprint })}>
                          <Play className="h-3.5 w-3.5 mr-1.5" /> Start Sprint
                        </Button>
                      )}
                      {canEditSprint && sprint.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: "complete", sprint })}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Complete Sprint
                        </Button>
                      )}
                      {canDeleteSprint && sprint.status === "planned" && (board[sprint.id]?.length ?? 0) === 0 && (
                        <button onClick={() => setConfirmAction({ type: "delete", sprint })}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  }
                />
              );
            })}

            <Section containerId="backlog" issues={board.backlog ?? []} onCardClick={setSelectedIssueId} onQuickAdd={handleQuickAdd(null)}
              canDrag={canEditIssues} canCreate={canCreateIssues}
              title={
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-bold">Backlog</span>
                </div>
              }
            />
          </div>
        </DndContext>
      )}

      <IssueDetailDrawer issueId={selectedIssueId} projectId={projectId} onClose={() => setSelectedIssueId(null)} />

      {/* Confirm action modal */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                  confirmAction.type === "delete" ? "bg-destructive/10" : "bg-primary/10")}>
                  <AlertTriangle className={cn("h-5 w-5", confirmAction.type === "delete" ? "text-destructive" : "text-primary")} />
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {confirmAction.type === "start" && "Start Sprint?"}
                    {confirmAction.type === "complete" && "Complete Sprint?"}
                    {confirmAction.type === "delete" && "Delete Sprint?"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {confirmAction.type === "start" && `"${confirmAction.sprint.name}" will become the active sprint. Only one sprint can be active at a time.`}
                    {confirmAction.type === "complete" && `"${confirmAction.sprint.name}" will be marked completed. Incomplete issues move back to the backlog.`}
                    {confirmAction.type === "delete" && `"${confirmAction.sprint.name}" will be permanently removed.`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>Cancel</Button>
                <Button variant={confirmAction.type === "delete" ? "destructive" : "default"} size="sm" onClick={runConfirmAction}>
                  Confirm
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
