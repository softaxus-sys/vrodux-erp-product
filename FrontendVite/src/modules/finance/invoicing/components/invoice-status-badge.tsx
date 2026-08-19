import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/finance/finance.api";

const classNames: Record<InvoiceStatus, string> = {
  draft:     "bg-muted text-muted-foreground",
  sent:      "bg-info/10 text-info",
  paid:      "bg-success/10 text-success",
  overdue:   "bg-destructive/10 text-destructive",
  partial:   "bg-warning/10 text-warning",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation("finance");
  // Guard against an unexpected/missing status (e.g. a value the backend adds
  // that isn't yet in the union) so a single bad row can't crash the page.
  const className = classNames[status] ?? "bg-muted text-muted-foreground";
  const label = t(`invoicing.status.${status}`, {
    defaultValue: status
      ? String(status).charAt(0).toUpperCase() + String(status).slice(1)
      : t("invoicing.status.unknown"),
  });
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", className)}>
      {label}
    </span>
  );
}
