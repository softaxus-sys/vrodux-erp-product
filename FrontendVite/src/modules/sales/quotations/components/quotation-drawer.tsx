import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, FileText, Send, ArrowRight, Copy,
  Building2, Calendar, CheckCircle2,
  AlertCircle, Clock, Ban, Percent, Loader2, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { type SalesQuotationSummaryDto } from "@/lib/pos/types";
import { useSalesQuotation, useConvertQuotationToOrder, useDeleteSalesQuotation } from "@/hooks/sales/use-sales-quotations";

type Tab = "overview" | "items";
type QuoteStatus = "draft" | "sent" | "approved" | "rejected" | "converted" | "expired";

const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:     { label: "Draft",     color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", icon: FileText },
  sent:      { label: "Sent",      color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    icon: Send },
  approved:  { label: "Approved",  color: "text-success",     bg: "bg-success/10",                     icon: CheckCircle2 },
  rejected:  { label: "Rejected",  color: "text-destructive", bg: "bg-destructive/10",                 icon: Ban },
  expired:   { label: "Expired",   color: "text-warning",     bg: "bg-warning/10",                     icon: Clock },
  converted: { label: "Converted", color: "text-primary",     bg: "bg-primary/10",                     icon: ArrowRight },
};

interface Props {
  quotation: SalesQuotationSummaryDto | null;
  open: boolean;
  onClose: () => void;
}

export function QuotationDrawer({ quotation: quote, open, onClose }: Props) {
  const [tab, setTab] = React.useState<Tab>("overview");

  React.useEffect(() => { if (open) setTab("overview"); }, [open]);

  // Lazy-load full detail (with line items) only when drawer is open
  const { data: detail, isLoading } = useSalesQuotation(open ? (quote?.id ?? null) : null);

  const convertMutation = useConvertQuotationToOrder();
  const deleteMutation  = useDeleteSalesQuotation();

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  React.useEffect(() => { if (!open) setConfirmDelete(false); }, [open]);

  if (!quote) return null;

  const status  = (quote.status as QuoteStatus) in STATUS_CONFIG ? (quote.status as QuoteStatus) : "draft";
  const sc      = STATUS_CONFIG[status];
  const StatusIcon = sc.icon;

  const isExpiredOrRejected = ["expired", "rejected"].includes(quote.status);
  const isValidUntilPast    = quote.validUntil ? new Date(quote.validUntil) < new Date() : false;

  const items    = detail?.items ?? [];
  const subTotal = detail?.subTotal ?? quote.subTotal;
  const taxAmount = detail?.taxAmount ?? quote.taxAmount;
  const total    = detail?.total ?? quote.total;

  function handleConvert() {
    convertMutation.mutate(quote!.id, { onSuccess: onClose });
  }

  function handleDelete() {
    deleteMutation.mutate(quote!.id, { onSuccess: onClose });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-[620px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", sc.bg)}>
                  <StatusIcon className={cn("h-5 w-5", sc.color)} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-base leading-tight">{quote.quotationNumber}</p>
                  <p className="text-sm text-muted-foreground truncate">{quote.customerName ?? "Walk-in Customer"}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      {sc.label}
                    </span>
                    {isValidUntilPast && !isExpiredOrRejected && quote.status !== "converted" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-warning bg-warning/10">
                        <AlertCircle className="h-2.5 w-2.5" />Expiring Soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* ── Tabs ──────────────────────────────────────────────────── */}
            <div className="flex border-b border-border px-6">
              {(["overview", "items"] as Tab[]).map(t => (
                <button
                  key={t} onClick={() => setTab(t)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                    tab === t
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "items" ? `Line Items${isLoading ? "" : ` (${items.length})`}` : "Overview"}
                </button>
              ))}
            </div>

            {/* ── Body ──────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Loading quotation details…</p>
                </div>
              ) : (
                <>
                  {tab === "overview" && (
                    <>
                      {/* Total value card */}
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                        <p className="text-xs text-muted-foreground mb-1">Total Value (incl. Tax)</p>
                        <p className="text-3xl font-bold text-primary">{formatCurrency(total, "PKR")}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                          <span>Subtotal: {formatCurrency(subTotal, "PKR")}</span>
                          {quote.discountPercent > 0 && (
                            <span className="text-warning">Discount: {quote.discountPercent}%</span>
                          )}
                          <span>Tax: {formatCurrency(taxAmount, "PKR")}</span>
                        </div>
                      </div>

                      {/* Details grid */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Details</h4>
                        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
                          {[
                            { icon: Building2, label: "Customer",    value: quote.customerName ?? "Walk-in" },
                            { icon: Calendar,  label: "Created",     value: formatDate(quote.createdAt, "medium") },
                            { icon: Calendar,  label: "Valid Until", value: quote.validUntil
                                ? <span className={cn(isValidUntilPast && !isExpiredOrRejected ? "text-warning font-semibold" : "")}>
                                    {formatDate(quote.validUntil, "medium")}
                                  </span>
                                : <span className="text-muted-foreground">—</span> },
                            { icon: Percent,   label: "Discount",    value: quote.discountPercent > 0 ? `${quote.discountPercent}%` : "None" },
                            { icon: FileText,  label: "Items",       value: `${quote.itemCount} line item${quote.itemCount !== 1 ? "s" : ""}` },
                          ].map(row => (
                            <div key={row.label} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
                              <row.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="flex-1 flex justify-between gap-4 min-w-0">
                                <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
                                <span className="text-sm font-medium text-right truncate">{row.value}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      {detail?.notes && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h4>
                          <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3 leading-relaxed">
                            {detail.notes}
                          </p>
                        </div>
                      )}

                      {/* Converted notice */}
                      {quote.status === "converted" && quote.convertedOrderId && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-primary">Converted to Sales Order</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Order ID: {quote.convertedOrderId}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {tab === "items" && (
                    <>
                      {items.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                          No line items found.
                        </div>
                      ) : (
                        <>
                          {/* Line items table */}
                          <div className="rounded-xl border border-border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/40 text-xs text-muted-foreground">
                                  <th className="text-left px-4 py-3 font-semibold">Description</th>
                                  <th className="text-right px-4 py-3 font-semibold">Qty</th>
                                  <th className="text-right px-4 py-3 font-semibold">Unit Price</th>
                                  <th className="text-right px-4 py-3 font-semibold">Disc%</th>
                                  <th className="text-right px-4 py-3 font-semibold">Tax%</th>
                                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, i) => (
                                  <motion.tr
                                    key={item.id}
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.04 }}
                                    className="border-t border-border/40 hover:bg-muted/20 transition-colors"
                                  >
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-sm leading-snug">{item.description}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {formatCurrency(item.unitPrice, "PKR")} × {item.quantity}
                                      </p>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm">{item.quantity}</td>
                                    <td className="px-4 py-3 text-right text-sm">{formatCurrency(item.unitPrice, "PKR")}</td>
                                    <td className="px-4 py-3 text-right text-sm">
                                      {item.discountPercent > 0
                                        ? <span className="text-destructive font-medium">{item.discountPercent}%</span>
                                        : <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-muted-foreground">{item.taxRate}%</td>
                                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.lineTotal, "PKR")}</td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Totals */}
                          <div className="bg-muted/30 rounded-xl p-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>{formatCurrency(subTotal, "PKR")}</span>
                              </div>
                              {quote.discountPercent > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Percent className="h-3 w-3" />Discount ({quote.discountPercent}%)
                                  </span>
                                  <span className="text-destructive">−{formatCurrency(subTotal * quote.discountPercent / 100, "PKR")}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax</span>
                                <span>{formatCurrency(taxAmount, "PKR")}</span>
                              </div>
                              <div className="border-t border-border/60 pt-2 flex justify-between font-bold text-base">
                                <span>Total</span>
                                <span className="text-primary">{formatCurrency(total, "PKR")}</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <div className="border-t border-border px-6 py-4 flex items-center gap-2 flex-wrap">
              {quote.status === "draft" && (
                <Button size="sm" className="gap-1.5 h-9">
                  <Send className="h-3.5 w-3.5" />Send to Customer
                </Button>
              )}
              {quote.status === "approved" && (
                <Button
                  size="sm"
                  className="gap-1.5 h-9 bg-success hover:bg-success/90"
                  onClick={handleConvert}
                  disabled={convertMutation.isPending}
                >
                  {convertMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <ArrowRight className="h-3.5 w-3.5" />}
                  Convert to Order
                </Button>
              )}
              {quote.status === "expired" && (
                <Button size="sm" className="gap-1.5 h-9">
                  <Copy className="h-3.5 w-3.5" />Re-issue Quote
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 h-9 ml-auto">
                <Copy className="h-3.5 w-3.5" />Duplicate
              </Button>
              {["draft", "sent"].includes(quote.status) && (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive font-medium">Delete this quote?</span>
                    <Button variant="destructive" size="sm" className="h-8 text-xs" disabled={deleteMutation.isPending}
                      onClick={handleDelete}>
                      {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs"
                      onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
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

