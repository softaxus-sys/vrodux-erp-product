import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Trash2, AlertTriangle, MessageSquare, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { useIssue, useUpdateIssue, useDeleteIssue, useMoveIssueToSprint } from "@/hooks/project-management/use-issues";
import { useLabels } from "@/hooks/project-management/use-labels";
import { useSprints } from "@/hooks/project-management/use-sprints";
import { useComments, useCreateComment, useDeleteComment } from "@/hooks/project-management/use-comments";
import { ISSUE_TYPES, ISSUE_PRIORITIES, type IssueType, type IssuePriority } from "@/lib/project-management/issues.api";
import { ISSUE_TYPE_CONFIG, ISSUE_PRIORITY_CONFIG } from "../lib/issue-meta";
import { useAuthStore } from "@/store/auth.store";

interface IssueDetailDrawerProps {
  issueId: string | null;
  projectId: string;
  onClose: () => void;
}

export function IssueDetailDrawer({ issueId, projectId, onClose }: IssueDetailDrawerProps) {
  const { hasRawPermission } = useAuthStore();
  const canEdit = hasRawPermission("project-management.issues.edit");
  const canDelete = hasRawPermission("project-management.issues.delete");
  const canCreateComment = hasRawPermission("project-management.issues.create");
  const canDeleteComment = hasRawPermission("project-management.issues.delete");

  const { data: issue, isLoading } = useIssue(issueId);
  const { data: labels = [] } = useLabels(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { data: comments = [] } = useComments(issueId);

  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();
  const moveToSprint = useMoveIssueToSprint();
  const createComment = useCreateComment(issueId ?? "");
  const deleteComment = useDeleteComment(issueId ?? "");

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<IssueType>("task");
  const [priority, setPriority] = React.useState<IssuePriority>("medium");
  const [assigneeName, setAssigneeName] = React.useState("");
  const [storyPoints, setStoryPoints] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [labelIds, setLabelIds] = React.useState<string[]>([]);
  const [comment, setComment] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!issue) return;
    setTitle(issue.title);
    setDescription(issue.description ?? "");
    setType(issue.type);
    setPriority(issue.priority);
    setAssigneeName(issue.assigneeName ?? "");
    setStoryPoints(issue.storyPoints != null ? String(issue.storyPoints) : "");
    setDueDate(issue.dueDate ? issue.dueDate.slice(0, 10) : "");
    setLabelIds(issue.labels.map(l => l.id));
  }, [issue]);

  const open = !!issueId;
  const isPending = updateIssue.isPending;

  const handleSave = async () => {
    if (!issue || !title.trim()) return;
    try {
      await updateIssue.mutateAsync({
        id: issue.id,
        payload: {
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          priority,
          assigneeName: assigneeName.trim() || undefined,
          storyPoints: storyPoints.trim() ? Number(storyPoints) : undefined,
          dueDate: dueDate || undefined,
          labelIds,
        },
      });
    } catch { /* hook toasts the error */ }
  };

  const handleSprintChange = (sprintId: string) => {
    if (!issue) return;
    moveToSprint.mutate({ id: issue.id, payload: { sprintId: sprintId || null, sortOrder: 0 } });
  };

  const handleDelete = () => {
    if (!issue) return;
    deleteIssue.mutate(issue.id);
    setConfirmDelete(false);
    onClose();
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !issueId) return;
    try {
      await createComment.mutateAsync(comment.trim());
      setComment("");
    } catch { /* hook toasts the error */ }
  };

  const toggleLabel = (id: string) => {
    setLabelIds(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
  };

  const TypeIcon = ISSUE_TYPE_CONFIG[type]?.icon;

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
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {TypeIcon && (
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", ISSUE_TYPE_CONFIG[type].bg)}>
                    <TypeIcon className={cn("h-4 w-4", ISSUE_TYPE_CONFIG[type].color)} />
                  </div>
                )}
                <span className="font-mono text-sm font-semibold text-muted-foreground">{issue?.issueKey}</span>
              </div>
              <div className="flex items-center gap-1">
                {canDelete && (
                  <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isLoading || !issue ? (
              <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading issue…</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Title */}
                <Input value={title} onChange={e => setTitle(e.target.value)} disabled={!canEdit}
                  className="text-base font-semibold h-10" placeholder="Issue title" />

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} disabled={!canEdit}
                    placeholder="Add a description…"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none disabled:opacity-60" />
                </div>

                {/* Field grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
                    <select value={type} onChange={e => setType(e.target.value as IssueType)} disabled={!canEdit}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60">
                      {ISSUE_TYPES.map(t => <option key={t} value={t}>{ISSUE_TYPE_CONFIG[t].label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</label>
                    <select value={priority} onChange={e => setPriority(e.target.value as IssuePriority)} disabled={!canEdit}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60">
                      {ISSUE_PRIORITIES.map(p => <option key={p} value={p}>{ISSUE_PRIORITY_CONFIG[p].label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assignee</label>
                    <Input value={assigneeName} onChange={e => setAssigneeName(e.target.value)} disabled={!canEdit}
                      placeholder="Unassigned" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Story Points</label>
                    <Input type="number" min={0} value={storyPoints} onChange={e => setStoryPoints(e.target.value)} disabled={!canEdit}
                      placeholder="—" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Date</label>
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={!canEdit} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sprint</label>
                    <select value={issue.sprintId ?? ""} onChange={e => handleSprintChange(e.target.value)} disabled={!canEdit}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60">
                      <option value="">Backlog</option>
                      {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Labels */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Labels
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.length === 0 && <p className="text-xs text-muted-foreground">No labels yet — add some from the board's "Manage Columns" menu.</p>}
                    {labels.map(l => {
                      const active = labelIds.includes(l.id);
                      return (
                        <button key={l.id} type="button" onClick={() => canEdit && toggleLabel(l.id)} disabled={!canEdit}
                          className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors",
                            active ? "border-transparent" : "border-border text-muted-foreground hover:border-foreground/30",
                            !canEdit && "cursor-default opacity-80")}
                          style={active ? { backgroundColor: `${l.color}22`, color: l.color, borderColor: `${l.color}55` } : undefined}>
                          {l.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-4">
                  <span>Reporter: <span className="font-medium text-foreground">{issue.reporterName}</span></span>
                  <span>Created: {formatDate(issue.createdAt)}</span>
                  {issue.updatedAt && <span>Updated: {formatDate(issue.updatedAt)}</span>}
                </div>

                {/* Save */}
                {canEdit && (
                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={!title.trim() || isPending}>
                      {isPending ? "Saving…" : "Save Changes"}
                    </Button>
                  </div>
                )}

                {/* Comments */}
                <div className="border-t border-border pt-4 space-y-3">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Comments ({comments.length})
                  </label>
                  <div className="space-y-3">
                    {comments.map(c => (
                      <div key={c.id} className="flex items-start gap-2.5 group">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                          {getInitials(c.authorName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="bg-muted/30 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold">{c.authorName}</span>
                              <span className="text-[10px] text-muted-foreground">{formatDate(c.createdAt)}</span>
                            </div>
                            <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.body}</p>
                          </div>
                        </div>
                        {canDeleteComment && (
                          <button onClick={() => deleteComment.mutate(c.id)}
                            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {canCreateComment && (
                    <div className="flex items-end gap-2">
                      <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                        placeholder="Add a comment…"
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                      <Button size="sm" onClick={handleAddComment} disabled={!comment.trim() || createComment.isPending}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Delete Issue?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">"{issue?.issueKey} — {issue?.title}" will be permanently removed.</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteIssue.isPending}>
                    {deleteIssue.isPending ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
