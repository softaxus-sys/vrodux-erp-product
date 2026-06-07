import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, FileText, Send, CheckCircle2, Package, Ban,
  Calendar, Loader2, Building2, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { usePurchaseOrder, useDeletePurchaseOrder } from "@/hooks/purchase/use-purchase-orders";
import type { PurchaseOrderSummaryDto } from "@/lib/pos/types";

interface Props { order: PurchaseOrderSummaryDto | null; open: boolean; onClose: () => void; }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType; step: number }> = {
  draft:    { label: "Draft",    color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", icon: FileText,    step: 0 },
  sent:     { label: "Sent",     color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    icon: Send,        step: 1 },
  partial:  { label: "Partial",  color: "text-primary",     bg: "bg-primary/10",                     icon: Package,     step: 2 },
  received: { label: "Received", color: "text-success",     bg: "bg-success/10",                     icon: CheckCircle2,step: 3 },
  cancelled:{ label: "Cancelled",color: "text-destructive", bg: "bg-destructive/10",                 icon: Ban,         step: -1 },
};

const STEPS = [
  { key: "sent",     label: "Sent" },
  { key: "partial",  label: "Partial" },
  { key: "received", label: "Received" },
];

type Tab = "overview" | "items";

export function PurchaseOrderDrawer({ order, open, onClose }: Props) {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  React.useEffect(() => { if (open) { setTab("overview"); setConfirmDelete(false); } }, [open]);

  const { data: full, isLoading } = usePurchaseOrder(order?.id ?? "");
  const deleteMutation = useDeletePurchaseOrder();

  if (!order) return null;

  const sc = STATUS_CONFIG[order.status] ?? { label: order.status, color: "text-muted-foreground", bg: "bg-muted", icon: FileText, step: 0 };
  const StatusIcon = sc.icon;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-[580px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", sc.bg)}>
                  <StatusIcon className={cn("h-5 w-5", sc.color)} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-base leading-tight">{order.orderNumber}</p>
                  <p className="text-sm text-muted-foreground">{order.vendorName}</p>
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold mt-1.5", sc.color, sc.bg)}>
                    {sc.label}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6">
              {(["overview", "items"] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn("px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                    tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t === "items" ? `Line Items (${full?.items.length ?? order.itemCount})` : "Overview"}
                </button>
              ))}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading…</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {tab === "overview" && full && (
                  <>
                    {/* Total */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                      <p className="text-xs text-muted-foreground mb-1">Purchase Total</p>
                      <p className="text-3xl font-bold text-primary">{formatCurrency(full.total, "PKR")}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span>Subtotal: {formatCurrency(full.subTotal, "PKR")}</span>
                        <span>Tax: {formatCurrency(full.taxAmount, "PKR")}</span>
                      </div>
                    </div>

                    {/* Pipeline */}
                    {order.status !== "cancelled" && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delivery Progress</h4>
                        <div className="bg-muted/30 rounded-xl p-4 flex items-center gap-2">
                          {STEPS.map((step, i) => {
                            const cfg = STATUS_CONFIG[step.key];
                            const StepIcon = cfg.icon;
                            const isComplete = sc.step >= cfg.step;
                            return (
                              <React.Fragment key={step.key}>
                                {i > 0 && <div className={cn("flex-1 h-0.5 rounded-full", isComplete ? "bg-primary" : "bg-muted")} />}
                                <div className={cn("flex flex-col items-center gap-1", isComplete ? "opacity-100" : "opacity-30")}>
                                  <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", isComplete ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                    <StepIcon className="h-3.5 w-3.5" />
                                  </div>
                                  <p className="text-[10px] font-medium">{step.label}</p>
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/30 rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Building2 className="h-3 w-3" />Vendor</p>
                        <p className="text-xs font-semibold">{full.vendorName}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" />Created</p>
                        <p className="text-xs font-semibold">{formatDate(full.createdAt)}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" />Expected</p>
                        <p className="text-xs font-semibold">{full.expectedDate ?? "—"}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" />Received</p>
                        <p className="text-xs font-semibold">{full.receivedDate ?? "—"}</p>
                      </div>
                    </div>

                    {full.notes && (
                      <div className="bg-muted/30 rounded-xl p-4 border border-border">
                        <p className="text-xs text-muted-foreground font-semibold mb-1">Notes</p>
                        <p className="text-sm text-muted-foreground">{full.notes}</p>
                      </div>
                    )}
                  </>
                )}

                {tab === "items" && full && (
                  <div className="space-y-2">
                    {full.items.map((item) => (
                      <div key={item.id} className="bg-muted/30 rounded-xl p-4 border border-border">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight">{item.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.quantity} × {formatCurrency(item.unitCost, "PKR")}
                              {item.taxRate > 0 && ` + ${item.taxRate}% tax`}
                            </p>
                          </div>
                          <p className="font-bold text-sm shrink-0">{formatCurrency(item.lineTotal, "PKR")}</p>
                        </div>
                      </div>
                    ))}
                    {/* Summary */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2 mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Subtotal</span><span>{formatCurrency(full.subTotal, "PKR")}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Tax</span><span>{formatCurrency(full.taxAmount, "PKR")}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t border-primary/20 pt-2">
                        <span>Total</span><span className="text-primary">{formatCurrency(full.total, "PKR")}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-border flex items-center gap-2">
              <Button variant="outline" className="h-9" onClick={onClose}>Close</Button>
              {order.status === "draft" && (
                confirmDelete ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-destructive font-medium">Delete this PO?</span>
                    <Button variant="destructive" size="sm" className="h-8 text-xs" disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(order.id, { onSuccess: onClose })}>
                      {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                    onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </Button>
                )
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

