import { cn } from "@/lib/utils";
import type { EmployeeStatus } from "@/lib/hr/hr.api";

const config: Record<string, { label: string; className: string; dot: string }> = {
  active:     { label: "Active",     className: "bg-success/10 text-success",         dot: "bg-success" },
  on_leave:   { label: "On Leave",   className: "bg-info/10 text-info",               dot: "bg-info" },
  probation:  { label: "Probation",  className: "bg-warning/10 text-warning",         dot: "bg-warning" },
  terminated: { label: "Terminated", className: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  suspended:  { label: "Suspended",  className: "bg-muted text-muted-foreground",     dot: "bg-muted-foreground" },
  inactive:   { label: "Inactive",   className: "bg-muted text-muted-foreground",     dot: "bg-muted-foreground" },
};

const fallback = { label: "Unknown", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" };

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const c = config[status] ?? fallback;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", c.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}
