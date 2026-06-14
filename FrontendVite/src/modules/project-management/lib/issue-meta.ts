import {
  Rocket, BookOpen, CheckSquare, Bug,
  ChevronsUp, ChevronsDown, ArrowUp, ArrowDown, Equal,
  type LucideIcon,
} from "lucide-react";
import type { IssueType, IssuePriority } from "@/lib/project-management/issues.api";

export const ISSUE_TYPE_CONFIG: Record<IssueType, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  epic:  { label: "Epic",  icon: Rocket,      color: "text-purple-500", bg: "bg-purple-500/10" },
  story: { label: "Story", icon: BookOpen,    color: "text-success",    bg: "bg-success/10" },
  task:  { label: "Task",  icon: CheckSquare, color: "text-primary",    bg: "bg-primary/10" },
  bug:   { label: "Bug",   icon: Bug,         color: "text-destructive", bg: "bg-destructive/10" },
};

export const ISSUE_PRIORITY_CONFIG: Record<IssuePriority, { label: string; icon: LucideIcon; color: string }> = {
  lowest:  { label: "Lowest",  icon: ChevronsDown, color: "text-muted-foreground" },
  low:     { label: "Low",     icon: ArrowDown,    color: "text-sky-500" },
  medium:  { label: "Medium",  icon: Equal,        color: "text-amber-500" },
  high:    { label: "High",    icon: ArrowUp,      color: "text-orange-500" },
  highest: { label: "Highest", icon: ChevronsUp,   color: "text-destructive" },
};
