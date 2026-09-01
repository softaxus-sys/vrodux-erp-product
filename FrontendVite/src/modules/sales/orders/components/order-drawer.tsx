import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Package, Truck, CheckCircle2, Clock, Ban,
  Calendar, DollarSign, Loader2, User, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate, fitTextClass } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useSalesOrder, useDeleteSalesOrder } from "@/hooks/sales/use-sales-orders";
import { Can } from "@/components/auth/can";
import type { SalesOrderSummaryDto } from "@/lib/pos/types";

interface Props { order: SalesOrderSummaryDto | null; open: boolean; onClose: () => void; }

const STATUS_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType; step: number }> = {
  pending:   { color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", icon: Clock,        step: 0 },
  confirmed: { color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    icon: CheckCircle2, step: 1 },
  shipped:   { color: "text-primary",     bg: "bg-primary/10",                     icon: Truck,        step: 2 },
  delivered: { color: "text-success",     bg: "bg-success/10",                     icon: CheckCircle2, step: 3 },
  cancelled: { color: "text-destructive", bg: "bg-destructive/10",                 icon: Ban,          step: -1 },
};

const STEPS = [
  { key: "confirmed" },
  { key: "shipped" },
  { key: "delivered" },
];

type Tab = "overview" | "items";

export function OrderDrawer({ order, open, onClose }: Props) {
  const { t } = useTranslation("sales");
  const currency = useCurrency();
  const [tab, setTab] = React.useState<Tab>("overview");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  React.useEffect(() => { if (open) { setTab("overview"); setConfirmDelete(false); } }, [open]);

  const { data: full, isLoading } = useSalesOrder(order?.id ?? "");
  const deleteMutation = useDeleteSalesOrder();

  if (!order) return null;

  const sc = STATUS_STYLES[order.status] ?? { color: "text-muted-foreground", bg: "bg-muted", icon: Clock, step: 0 };
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
                  <p className="text-sm text-muted-foreground">{order.customerName ?? "Walk-in"}</p>
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold mt-1.5", sc.color, sc.bg)}>
                    {t(`orders.status.${order.status}`)}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6">
              {(["overview", "items"] as Tab[]).map(tabKey => (
                <button key={tabKey} onClick={() => setTab(tabKey)}
                  className={cn("px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                    tab === tabKey ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {tabKey === "items" ? t("orders.drawer.items", { count: full?.items.length ?? order.itemCount }) : t("orders.drawer.overview")}
                </button>
              ))}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">{t("orders.drawer.loading")}</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {tab === "overview" && full && (
                  <>
                    {/* Total */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">{t("orders.drawer.total")}</p>
                      <p className={cn("font-bold text-primary truncate", fitTextClass(formatCurrency(full.total, currency), "3xl"))}
                         title={formatCurrency(full.total, currency)}>
                        {formatCurrency(full.total, currency)}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span>{t("orders.drawer.subtotal")}: {formatCurrency(full.subTotal, currency)}</span>
                        <span>{t("orders.drawer.tax")}: {formatCurrency(full.taxAmount, currency)}</span>
                      </div>
                    </div>

                    {/* Pipeline */}
                    {order.status !== "cancelled" && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("orders.drawer.fulfillment")}</h4>
                        <div className="bg-muted/30 rounded-xl p-4 flex items-center gap-2">
                          {STEPS.map((step, i) => {
                            const cfg = STATUS_STYLES[step.key];
                            const StepIcon = cfg.icon;
                            const isComplete = sc.step >= cfg.step;
                            const isCurrent  = sc.step === cfg.step;
                            return (
                              <React.Fragment key={step.key}>
                                {i > 0 && <div className={cn("flex-1 h-0.5 rounded-full", isComplete ? "bg-primary" : "bg-muted")} />}
                                <div className={cn("flex flex-col items-center gap-1", isCurrent ? "opacity-100" : isComplete ? "opacity-80" : "opacity-30")}>
                                  <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", isComplete ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                    <StepIcon className="h-3.5 w-3.5" />
                                  </div>
                                  <p className="text-[10px] font-medium">{t(`orders.status.${step.key}`)}</p>
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
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" />{t("orders.drawer.created")}</p>
                        <p className="text-xs font-semibold">{formatDate(full.createdAt)}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" />{t("orders.drawer.expected")}</p>
                        <p className="text-xs font-semibold">{full.expectedDate ?? "—"}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><User className="h-3 w-3" />{t("orders.drawer.customer")}</p>
                        <p className="text-xs font-semibold">{full.customerName ?? t("orders.walkIn")}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><DollarSign className="h-3 w-3" />{t("orders.drawer.status")}</p>
                        <p className="text-xs font-semibold">{t(`orders.status.${full.status}`)}</p>
                      </div>
                    </div>

                    {full.notes && (
                      <div className="bg-muted/30 rounded-xl p-4 border border-border">
                        <p className="text-xs text-muted-foreground font-semibold mb-1">{t("orders.drawer.notes")}</p>
                        <p className="text-sm text-muted-foreground">{full.notes}</p>
                      </div>
                    )}
                  </>
                )}

                {tab === "items" && full && (
                  <div className="space-y-2">
                    {full.items.map((item, i) => (
                      <div key={item.id} className="bg-muted/30 rounded-xl p-4 border border-border">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight">{item.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.quantity} × {formatCurrency(item.unitPrice, currency)}
                              {item.discountPercent > 0 && ` − ${item.discountPercent}% disc`}
                              {item.taxRate > 0 && ` + ${item.taxRate}% tax`}
                            </p>
                          </div>
                          <p className="font-bold text-sm shrink-0">{formatCurrency(item.lineTotal, currency)}</p>
                        </div>
                      </div>
                    ))}

                    {/* Summary */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2 mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t("orders.drawer.subtotal")}</span><span>{formatCurrency(full.subTotal, currency)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t("orders.drawer.tax")}</span><span>{formatCurrency(full.taxAmount, currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t border-primary/20 pt-2">
                        <span>{t("orders.drawer.total")}</span><span className="text-primary">{formatCurrency(full.total, currency)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-border flex items-center gap-2">
              <Button variant="outline" className="h-9" onClick={onClose}>{t("orders.drawer.button.close")}</Button>
              {["pending", "cancelled"].includes(order.status) && (
                <Can permission="sales.orders.edit">{
                confirmDelete ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-destructive font-medium">{t("orders.drawer.deleteConfirm")}</span>
                    <Button variant="destructive" size="sm" className="h-8 text-xs" disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(order.id, { onSuccess: onClose })}>
                      {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("orders.drawer.button.confirm")}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setConfirmDelete(false)}>{t("orders.drawer.button.cancel")}</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                    onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3.5 w-3.5" />{t("orders.drawer.button.delete")}
                  </Button>
                )
                }</Can>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

