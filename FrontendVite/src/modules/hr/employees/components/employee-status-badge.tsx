import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { EmployeeStatus } from "@/lib/hr/hr.api";

const config: Record<string, { className: string; dot: string }> = {
  active:     { className: "bg-success/10 text-success",         dot: "bg-success" },
  on_leave:   { className: "bg-info/10 text-info",               dot: "bg-info" },
  probation:  { className: "bg-warning/10 text-warning",         dot: "bg-warning" },
  terminated: { className: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  suspended:  { className: "bg-muted text-muted-foreground",     dot: "bg-muted-foreground" },
  inactive:   { className: "bg-muted text-muted-foreground",     dot: "bg-muted-foreground" },
};

const fallback = { className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" };

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const { t } = useTranslation("hr");
  const c = config[status] ?? fallback;
  const label = config[status] ? t(`employeeStatus.${status}`) : t("employeeStatus.unknown");
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", c.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {label}
    </span>
  );
}
