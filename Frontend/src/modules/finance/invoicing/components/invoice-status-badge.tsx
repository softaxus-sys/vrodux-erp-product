import { cn } from "@/lib/utils";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "partial" | "cancelled";

const config: Record<InvoiceStatus, { label: string; className: string }> = {
  draft:     { label: "Draft",     className: "bg-muted text-muted-foreground" },
  sent:      { label: "Sent",      className: "bg-info/10 text-info" },
  paid:      { label: "Paid",      className: "bg-success/10 text-success" },
  overdue:   { label: "Overdue",   className: "bg-destructive/10 text-destructive" },
  partial:   { label: "Partial",   className: "bg-warning/10 text-warning" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground line-through" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const c = config[status];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", c.className)}>
      {c.label}
    </span>
  );
}
