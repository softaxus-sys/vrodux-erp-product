import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ArrowLeft, Settings2, Plus, Loader2, Search, ListChecks, ListTodo, ListIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useProject } from "@/hooks/project-management/use-projects";
import { useBoardColumns } from "@/hooks/project-management/use-board-columns";
import { useIssues, useMoveIssue, useCreateIssue } from "@/hooks/project-management/use-issues";
import type { IssueSummaryDto } from "@/lib/project-management/issues.api";
import type { BoardColumnDto } from "@/lib/project-management/board-columns.api";
import { SortableIssueCard } from "./issue-card";
import { ManageColumnsModal } from "./manage-columns-modal";
import { IssueDetailDrawer } from "./issue-detail-drawer";

function Column({
  column, issues, onCardClick, onQuickAdd, canDrag, canCreate,
}: {
  column: BoardColumnDto;
  issues: IssueSummaryDto[];
  onCardClick: (id: string) => void;
  onQuickAdd: (columnId: string, title: string) => void;
  canDrag: boolean;
  canCreate: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState("");

  const submit = () => {
    if (!title.trim()) { setAdding(false); return; }
    onQuickAdd(column.id, title.trim());
    setTitle("");
  };

  return (
    <div className="flex flex-col w-72 shrink-0 bg-muted/20 rounded-xl border border-border">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{column.name}</span>
        <span className="text-[11px] font-semibold text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">{issues.length}</span>
      </div>
      <div ref={setNodeRef} className={cn("flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto transition-colors", isOver && "bg-primary/5")}>
        <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map(issue => (
            <SortableIssueCard key={issue.id} issue={issue} onClick={() => onCardClick(issue.id)} canDrag={canDrag} />
          ))}
        </SortableContext>
        {issues.length === 0 && !adding && (
          <div className="h-16 rounded-lg border border-dashed border-border/60 flex items-center justify-center text-[11px] text-muted-foreground">
            No issues
          </div>
        )}
      </div>
      {canCreate && (
        <div className="p-2 border-t border-border/60">
          {adding ? (
            <Input value={title} onChange={e => setTitle(e.target.value)} autoFocus
              placeholder="Issue title…"
              onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setTitle(""); } }}
              onBlur={submit}
              className="h-8 text-sm" />
          ) : (
            <button onClick={() => setAdding(true)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add issue
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function BoardView() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { hasRawPermission } = useAuthStore();
  const canManageBoards = hasRawPermission("project-management.boards.create")
    || hasRawPermission("project-management.boards.edit")
    || hasRawPermission("project-management.boards.delete");
  const canEditIssues = hasRawPermission("project-management.issues.edit");
  const canCreateIssues = hasRawPermission("project-management.issues.create");

  const { data: project } = useProject(projectId);
  const { data: columns = [] } = useBoardColumns(projectId);
  const { data: issuesData = [], isLoading } = useIssues({ projectId });
  const moveIssue = useMoveIssue();
  const createIssue = useCreateIssue();

  const [search, setSearch] = React.useState("");
  const [manageOpen, setManageOpen] = React.useState(false);
  const [selectedIssueId, setSelectedIssueId] = React.useState<string | null>(null);

  const boardColumns = React.useMemo(
    () => [...columns].filter(c => c.category !== "backlog").sort((a, b) => a.sortOrder - b.sortOrder),
    [columns]
  );

  const [board, setBoard] = React.useState<Record<string, IssueSummaryDto[]>>({});

  React.useEffect(() => {
    const map: Record<string, IssueSummaryDto[]> = {};
    for (const col of boardColumns) map[col.id] = [];
    for (const issue of issuesData) {
      if (search && !issue.title.toLowerCase().includes(search.toLowerCase()) && !issue.issueKey.toLowerCase().includes(search.toLowerCase())) continue;
      if (map[issue.boardColumnId]) map[issue.boardColumnId].push(issue);
    }
    for (const id of Object.keys(map)) map[id].sort((a, b) => a.sortOrder - b.sortOrder);
    setBoard(map);
  }, [issuesData, boardColumns, search]);

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

    let sourceColId: string | undefined;
    for (const [colId, items] of Object.entries(board)) {
      if (items.some(i => i.id === activeId)) { sourceColId = colId; break; }
    }
    if (!sourceColId) return;

    const destColId = board[overId]
      ? overId
      : Object.entries(board).find(([, items]) => items.some(i => i.id === overId))?.[0] ?? sourceColId;

    const sourceItems = [...board[sourceColId]];
    const activeIndex = sourceItems.findIndex(i => i.id === activeId);
    const [moved] = sourceItems.splice(activeIndex, 1);

    let destItems = sourceColId === destColId ? sourceItems : [...board[destColId]];
    let destIndex = destItems.findIndex(i => i.id === overId);
    if (destIndex === -1) destIndex = destItems.length;
    destItems.splice(destIndex, 0, moved);

    setBoard(prev => ({
      ...prev,
      [sourceColId!]: sourceColId === destColId ? destItems : sourceItems,
      [destColId]: destItems,
    }));

    moveIssue.mutate({ id: activeId, payload: { boardColumnId: destColId, sortOrder: destIndex } });
  };

  const handleQuickAdd = (columnId: string, title: string) => {
    createIssue.mutate({ projectId, title, type: "task", priority: "medium", boardColumnId: columnId });
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/project-management" className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{project?.name ?? "Board"}</h1>
            {project && <p className="text-xs text-muted-foreground font-mono">{project.key}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search issues…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm w-48" />
          </div>
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
            <Link to={`/project-management/${projectId}/board`} className="px-3 py-1.5 rounded-md text-xs font-semibold bg-card text-foreground shadow-sm flex items-center gap-1.5">
              <ListIcon className="h-3.5 w-3.5" /> Board
            </Link>
            <Link to={`/project-management/${projectId}/backlog`} className="px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5" /> Backlog
            </Link>
            <Link to={`/project-management/${projectId}/issues`} className="px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" /> Issues
            </Link>
          </div>
          {canManageBoards && (
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Manage Columns
            </Button>
          )}
        </div>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading board…</span>
        </div>
      ) : boardColumns.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          No board columns configured. Use "Manage Columns" to add one.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={canEditIssues ? handleDragEnd : undefined}>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 overflow-x-auto pb-2 flex-1 items-start">
            {boardColumns.map(col => (
              <Column key={col.id} column={col} issues={board[col.id] ?? []} onCardClick={setSelectedIssueId} onQuickAdd={handleQuickAdd}
                canDrag={canEditIssues} canCreate={canCreateIssues} />
            ))}
          </motion.div>
        </DndContext>
      )}

      {manageOpen && <ManageColumnsModal projectId={projectId} onClose={() => setManageOpen(false)} />}
      <IssueDetailDrawer issueId={selectedIssueId} projectId={projectId} onClose={() => setSelectedIssueId(null)} />
    </div>
  );
}
