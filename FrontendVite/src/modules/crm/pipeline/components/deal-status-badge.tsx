import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { DealPriority } from "@/lib/crm/crm.api";

const priorityConfig: Record<DealPriority, { className: string }> = {
  high:   { className: "bg-destructive/10 text-destructive" },
  medium: { className: "bg-warning/10 text-warning" },
  low:    { className: "bg-muted text-muted-foreground" },
};

export function DealPriorityBadge({ priority }: { priority: DealPriority }) {
  const { t } = useTranslation("crm");
  const c = priorityConfig[priority];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide", c.className)}>
      {t(`priority.${priority}`)}
    </span>
  );
}
