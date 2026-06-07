import { cn } from "@/lib/utils";
import type { DealPriority } from "@/lib/crm/crm.api";

const priorityConfig: Record<DealPriority, { label: string; className: string }> = {
  high:   { label: "High",   className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning" },
  low:    { label: "Low",    className: "bg-muted text-muted-foreground" },
};

export function DealPriorityBadge({ priority }: { priority: DealPriority }) {
  const c = priorityConfig[priority];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide", c.className)}>
      {c.label}
    </span>
  );
}
