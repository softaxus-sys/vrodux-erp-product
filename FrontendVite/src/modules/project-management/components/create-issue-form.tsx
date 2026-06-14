import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCreateIssue } from "@/hooks/project-management/use-issues";
import { useBoardColumns } from "@/hooks/project-management/use-board-columns";
import { useLabels } from "@/hooks/project-management/use-labels";
import { useSprints } from "@/hooks/project-management/use-sprints";
import { useIssues } from "@/hooks/project-management/use-issues";
import { ISSUE_TYPES, ISSUE_PRIORITIES, type IssueType, type IssuePriority } from "@/lib/project-management/issues.api";
import { ISSUE_TYPE_CONFIG, ISSUE_PRIORITY_CONFIG } from "../lib/issue-meta";

interface CreateIssueFormProps {
  open: boolean;
  projectId: string;
  defaultBoardColumnId?: string;
  onClose: () => void;
}

export function CreateIssueForm({ open, projectId, defaultBoardColumnId, onClose }: CreateIssueFormProps) {
  const create = useCreateIssue();
  const { data: columns = [] } = useBoardColumns(projectId);
  const { data: labels = [] } = useLabels(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { data: allIssues = [] } = useIssues(open ? { projectId } : null);
  const epics = allIssues.filter(i => i.type === "epic");

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<IssueType>("task");
  const [priority, setPriority] = React.useState<IssuePriority>("medium");
  const [boardColumnId, setBoardColumnId] = React.useState("");
  const [assigneeName, setAssigneeName] = React.useState("");
  const [epicId, setEpicId] = React.useState("");
  const [sprintId, setSprintId] = React.useState("");
  const [storyPoints, setStoryPoints] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [labelIds, setLabelIds] = React.useState<string[]>([]);

  const reset = () => {
    setTitle(""); setDescription(""); setType("task"); setPriority("medium");
    setBoardColumnId(defaultBoardColumnId ?? ""); setAssigneeName(""); setEpicId("");
    setSprintId(""); setStoryPoints(""); setDueDate(""); setLabelIds([]);
  };

  React.useEffect(() => { if (open) reset(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValid = title.trim().length > 0;
  const isPending = create.isPending;

  const toggleLabel = (id: string) => {
    setLabelIds(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      await create.mutateAsync({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        type, priority,
        boardColumnId: boardColumnId || undefined,
        assigneeName: assigneeName.trim() || undefined,
        epicId: epicId || undefined,
        sprintId: sprintId || undefined,
        storyPoints: storyPoints.trim() ? Number(storyPoints) : undefined,
        dueDate: dueDate || undefined,
        labelIds,
      });
      onClose();
    } catch { /* hook toasts the error; keep form open for retry */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">New Issue</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Create a task, story, bug or epic</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Short, descriptive title" className="h-9 text-sm" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  placeholder="Add more detail…"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
                  <select value={type} onChange={e => setType(e.target.value as IssueType)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {ISSUE_TYPES.map(t => <option key={t} value={t}>{ISSUE_TYPE_CONFIG[t].label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as IssuePriority)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {ISSUE_PRIORITIES.map(p => <option key={p} value={p}>{ISSUE_PRIORITY_CONFIG[p].label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Column</label>
                  <select value={boardColumnId} onChange={e => setBoardColumnId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Default</option>
                    {columns.filter(c => c.category !== "backlog").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assignee</label>
                  <Input value={assigneeName} onChange={e => setAssigneeName(e.target.value)} placeholder="Unassigned" className="h-9 text-sm" />
                </div>
                {type !== "epic" && (
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Epic</label>
                    <select value={epicId} onChange={e => setEpicId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">No epic</option>
                      {epics.map(e => <option key={e.id} value={e.id}>{e.issueKey} — {e.title}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sprint</label>
                  <select value={sprintId} onChange={e => setSprintId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Backlog</option>
                    {sprints.filter(s => s.status !== "completed").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Story Points</label>
                  <Input type="number" min={0} value={storyPoints} onChange={e => setStoryPoints(e.target.value)} placeholder="—" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Date</label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>

              {labels.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Labels</label>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map(l => {
                      const active = labelIds.includes(l.id);
                      return (
                        <button key={l.id} type="button" onClick={() => toggleLabel(l.id)}
                          className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors",
                            active ? "border-transparent" : "border-border text-muted-foreground hover:border-foreground/30")}
                          style={active ? { backgroundColor: `${l.color}22`, color: l.color, borderColor: `${l.color}55` } : undefined}>
                          {l.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!isValid || isPending}>
                {isPending ? "Creating…" : "Create Issue"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
