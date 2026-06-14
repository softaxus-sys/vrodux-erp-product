import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ListIcon, ListTodo, ListChecks, Plus, Search, Loader2, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { useProject } from "@/hooks/project-management/use-projects";
import { useIssues } from "@/hooks/project-management/use-issues";
import { ISSUE_TYPES, ISSUE_PRIORITIES, type IssueSummaryDto } from "@/lib/project-management/issues.api";
import { ISSUE_TYPE_CONFIG, ISSUE_PRIORITY_CONFIG } from "../lib/issue-meta";
import { CreateIssueForm } from "./create-issue-form";
import { IssueDetailDrawer } from "./issue-detail-drawer";

type SortKey = "issueKey" | "title" | "priority" | "dueDate" | "storyPoints";

export function IssuesView() {
  const { projectId = "" } = useParams<{ projectId: string }>();

  const { data: project } = useProject(projectId);
  const { data: issues = [], isLoading } = useIssues({ projectId });

  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [priorityFilter, setPriorityFilter] = React.useState("");
  const [assigneeFilter, setAssigneeFilter] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("issueKey");
  const [sortDir, setSortDir] = React.useState<1 | -1>(1);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedIssueId, setSelectedIssueId] = React.useState<string | null>(null);

  const assignees = React.useMemo(
    () => Array.from(new Set(issues.map(i => i.assigneeName).filter(Boolean))) as string[],
    [issues]
  );

  const filtered = React.useMemo(() => {
    let rows = issues.filter(i => {
      if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.issueKey.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter && i.type !== typeFilter) return false;
      if (priorityFilter && i.priority !== priorityFilter) return false;
      if (assigneeFilter && i.assigneeName !== assigneeFilter) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
    return rows;
  }, [issues, search, typeFilter, priorityFilter, assigneeFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  };

  const exportCsv = () => {
    const csv = toCsv(filtered.map((i: IssueSummaryDto) => ({
      "Key": i.issueKey,
      "Title": i.title,
      "Type": ISSUE_TYPE_CONFIG[i.type].label,
      "Priority": ISSUE_PRIORITY_CONFIG[i.priority].label,
      "Status": i.boardColumnName,
      "Assignee": i.assigneeName ?? "",
      "Story Points": i.storyPoints ?? "",
      "Due Date": i.dueDate ?? "",
    })), ["Key", "Title", "Type", "Priority", "Status", "Assignee", "Story Points", "Due Date"]);
    downloadFile(`${project?.key ?? "issues"}_issues_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: `${project?.name ?? "Project"} — Issues`,
    subtitle: `${filtered.length} issues`,
    columns: ["Key", "Title", "Type", "Priority", "Status", "Assignee"],
    rows: filtered.map(i => [i.issueKey, i.title, ISSUE_TYPE_CONFIG[i.type].label, ISSUE_PRIORITY_CONFIG[i.priority].label, i.boardColumnName, i.assigneeName ?? "—"]),
    landscape: true,
  });

  const SortHeader = ({ label, sk }: { label: string; sk: SortKey }) => (
    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground" onClick={() => toggleSort(sk)}>
      <span className="inline-flex items-center gap-1">{label} {sortKey === sk && <ArrowUpDown className="h-3 w-3" />}</span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/project-management" className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{project?.name ?? "Issues"}</h1>
            {project && <p className="text-xs text-muted-foreground font-mono">{project.key}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
            <Link to={`/project-management/${projectId}/board`} className="px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <ListIcon className="h-3.5 w-3.5" /> Board
            </Link>
            <Link to={`/project-management/${projectId}/backlog`} className="px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5" /> Backlog
            </Link>
            <Link to={`/project-management/${projectId}/issues`} className="px-3 py-1.5 rounded-md text-xs font-semibold bg-card text-foreground shadow-sm flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" /> Issues
            </Link>
          </div>
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} />
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Issue
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search issues…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">All types</option>
          {ISSUE_TYPES.map(t => <option key={t} value={t}>{ISSUE_TYPE_CONFIG[t].label}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">All priorities</option>
          {ISSUE_PRIORITIES.map(p => <option key={p} value={p}>{ISSUE_PRIORITY_CONFIG[p].label}</option>)}
        </select>
        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">All assignees</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading issues…</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <SortHeader label="Key" sk="issueKey" />
                <SortHeader label="Title" sk="title" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <SortHeader label="Priority" sk="priority" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Assignee</th>
                <SortHeader label="Points" sk="storyPoints" />
                <SortHeader label="Due" sk="dueDate" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No issues found.</td></tr>
              ) : filtered.map((issue, i) => {
                const typeCfg = ISSUE_TYPE_CONFIG[issue.type];
                const priorityCfg = ISSUE_PRIORITY_CONFIG[issue.priority];
                const TypeIcon = typeCfg.icon;
                const PriorityIcon = priorityCfg.icon;
                return (
                  <motion.tr key={issue.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    onClick={() => setSelectedIssueId(issue.id)}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-5 w-5 rounded flex items-center justify-center", typeCfg.bg)}>
                          <TypeIcon className={cn("h-3 w-3", typeCfg.color)} />
                        </div>
                        <span className="font-mono text-xs font-semibold">{issue.issueKey}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{issue.title}</p>
                      {issue.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {issue.labels.map(l => (
                            <span key={l.id} className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: `${l.color}22`, color: l.color }}>
                              {l.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-muted-foreground">{issue.boardColumnName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <PriorityIcon className={cn("h-3.5 w-3.5", priorityCfg.color)} /> {priorityCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{issue.assigneeName ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{issue.storyPoints ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">{formatDate(issue.dueDate)}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>

      <CreateIssueForm open={createOpen} projectId={projectId} onClose={() => setCreateOpen(false)} />
      <IssueDetailDrawer issueId={selectedIssueId} projectId={projectId} onClose={() => setSelectedIssueId(null)} />
    </div>
  );
}
