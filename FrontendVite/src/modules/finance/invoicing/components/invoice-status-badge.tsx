import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/finance/finance.api";

const config: Record<InvoiceStatus, { label: string; className: string }> = {
  draft:     { label: "Draft",     className: "bg-muted text-muted-foreground" },
  sent:      { label: "Sent",      className: "bg-info/10 text-info" },
  paid:      { label: "Paid",      className: "bg-success/10 text-success" },
  overdue:   { label: "Overdue",   className: "bg-destructive/10 text-destructive" },
  partial:   { label: "Partial",   className: "bg-warning/10 text-warning" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground line-through" },
};

const fallback = { label: "Unknown", className: "bg-muted text-muted-foreground" };

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  // Guard against an unexpected/missing status (e.g. a value the backend adds
  // that isn't yet in the union) so a single bad row can't crash the page.
  const c = config[status] ?? {
    ...fallback,
    label: status ? String(status).charAt(0).toUpperCase() + String(status).slice(1) : fallback.label,
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", c.className)}>
      {c.label}
    </span>
  );
}
