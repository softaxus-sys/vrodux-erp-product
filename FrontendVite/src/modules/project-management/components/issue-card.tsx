import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bookmark } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import type { IssueSummaryDto } from "@/lib/project-management/issues.api";
import { ISSUE_TYPE_CONFIG, ISSUE_PRIORITY_CONFIG } from "../lib/issue-meta";

interface IssueCardContentProps {
  issue: IssueSummaryDto;
  onClick?: () => void;
  className?: string;
}

export function IssueCardContent({ issue, onClick, className }: IssueCardContentProps) {
  const typeCfg = ISSUE_TYPE_CONFIG[issue.type];
  const priorityCfg = ISSUE_PRIORITY_CONFIG[issue.priority];
  const TypeIcon = typeCfg.icon;
  const PriorityIcon = priorityCfg.icon;

  return (
    <div onClick={onClick}
      className={cn("bg-card border border-border rounded-lg p-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer space-y-2", className)}>
      {issue.epicTitle && (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-purple-500">
          <Bookmark className="h-3 w-3" /> {issue.epicTitle}
        </div>
      )}
      <p className="text-sm font-medium leading-snug line-clamp-3">{issue.title}</p>

      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {issue.labels.map(l => (
            <span key={l.id} className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: `${l.color}22`, color: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className={cn("h-5 w-5 rounded flex items-center justify-center", typeCfg.bg)}>
            <TypeIcon className={cn("h-3 w-3", typeCfg.color)} />
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">{issue.issueKey}</span>
          <PriorityIcon className={cn("h-3.5 w-3.5", priorityCfg.color)} />
        </div>
        <div className="flex items-center gap-1.5">
          {issue.storyPoints != null && (
            <span className="h-5 min-w-5 px-1 rounded-full bg-muted/50 text-[10px] font-bold flex items-center justify-center">
              {issue.storyPoints}
            </span>
          )}
          {issue.assigneeName && (
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary" title={issue.assigneeName}>
              {getInitials(issue.assigneeName)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SortableIssueCardProps {
  issue: IssueSummaryDto;
  onClick?: () => void;
  canDrag?: boolean;
}

export function SortableIssueCard({ issue, onClick, canDrag = true }: SortableIssueCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...(canDrag ? { ...attributes, ...listeners } : {})}>
      <IssueCardContent issue={issue} onClick={onClick} />
    </div>
  );
}
