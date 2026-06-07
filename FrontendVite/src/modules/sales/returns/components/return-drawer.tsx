import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, RotateCcw, CheckCircle2, Ban, Clock, RefreshCw,
  Building2, Calendar, FileText, CreditCard, AlertCircle,
  Banknote, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { SalesReturnDto as SalesReturn, ReturnStatus, ReturnReason } from "@/lib/sales/returns.api";

const STATUS_CONFIG: Record<ReturnStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "text-slate-600",    bg: "bg-slate-100 dark:bg-slate-800/50", icon: Clock },
  approved:  { label: "Approved",  color: "text-blue-600",     bg: "bg-blue-50 dark:bg-blue-900/20",    icon: CheckCircle2 },
  rejected:  { label: "Rejected",  color: "text-destructive",  bg: "bg-destructive/10",                 icon: Ban },
  refunded:  { label: "Refunded",  color: "text-success",      bg: "bg-success/10",                     icon: Banknote },
  completed: { label: "Completed", color: "text-success",      bg: "bg-success/10",                     icon: CheckCircle2 },
};

const REASON_LABELS: Record<ReturnReason, string> = {
  defective:       "Defective / Bug",
  wrong_item:      "Wrong Item Delivered",
  not_as_described: "Not As Described",
  duplicate_order: "Duplicate Order",
  changed_mind:    "Customer Changed Mind",
  other:           "Other",
};

const REFUND_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  credit_note:   "Credit Note",
  cash:          "Cash Refund",
};

interface Props { ret: SalesReturn | null; open: boolean; onClose: () => void; }

export function ReturnDrawer({ ret, open, onClose }: Props) {
  React.useEffect(() => { if (open) {} }, [open]);
  if (!ret) return null;

  const sc = STATUS_CONFIG[ret.status];
  const StatusIcon = sc.icon;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-[560px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", sc.bg)}>
                  <StatusIcon className={cn("h-5 w-5", sc.color)} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-base leading-tight">{ret.returnNumber}</p>
                  <p className="text-sm text-muted-foreground">{ret.customerName}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      {sc.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Ref: {ret.orderNumber}</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Refund amount */}
              <div className={cn("border rounded-xl p-5", ret.status === "refunded" || ret.status === "completed"
                ? "bg-success/5 border-success/20"
                : "bg-muted/30 border-border")}>
                <p className="text-xs text-muted-foreground mb-1">Refund Amount</p>
                <p className={cn("text-3xl font-bold", ret.status === "refunded" || ret.status === "completed" ? "text-success" : "text-foreground")}>
                  {formatCurrency(ret.refundAmount, ret.currency)}
                </p>
                {ret.refundMethod && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <CreditCard className="h-3 w-3" />
                    {REFUND_METHOD_LABELS[ret.refundMethod]}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Return Reason</h4>
                <div className="bg-muted/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-warning shrink-0" />
                    <span className="text-sm font-semibold">{REASON_LABELS[ret.reason]}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ret.reasonDetail}</p>
                </div>
              </div>

              {/* Return details */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Details</h4>
                <div className="bg-muted/30 rounded-xl p-4 space-y-0">
                  {[
                    { icon: Building2,   label: "Customer",       value: ret.customerName },
                    { icon: FileText,    label: "Order Ref",      value: ret.orderNumber },
                    { icon: Calendar,    label: "Request Date",   value: formatDate(ret.requestDate, "medium") },
                    ...(ret.processedBy ? [{ icon: User, label: "Processed By", value: ret.processedBy }] : []),
                    ...(ret.processedDate ? [{ icon: Calendar, label: "Processed On", value: formatDate(ret.processedDate, "medium") }] : []),
                    ...(ret.creditNote ? [{ icon: FileText, label: "Credit Note", value: <span className="font-mono text-xs">{ret.creditNote}</span> }] : []),
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

              {/* Items */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Return Items ({ret.items.length})</h4>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-xs text-muted-foreground">
                        <th className="text-left px-4 py-3 font-semibold">Description</th>
                        <th className="text-right px-4 py-3 font-semibold">Qty</th>
                        <th className="text-right px-4 py-3 font-semibold">Unit Price</th>
                        <th className="text-right px-4 py-3 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ret.items.map((item, i) => (
                        <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium">{item.description}</td>
                          <td className="px-4 py-3 text-right text-sm">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-sm">{formatCurrency(item.unitPrice, ret.currency)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.total, ret.currency)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex justify-between items-center px-1">
                  <span className="text-sm text-muted-foreground">Refund Total (incl. VAT)</span>
                  <span className="font-bold text-base">{formatCurrency(ret.refundAmount, ret.currency)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 flex items-center gap-2">
              {ret.status === "pending" && (
                <>
                  <Button size="sm" className="gap-1.5 h-9 bg-success hover:bg-success/90">
                    <CheckCircle2 className="h-3.5 w-3.5" />Approve Return
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 h-9 text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Ban className="h-3.5 w-3.5" />Reject
                  </Button>
                </>
              )}
              {ret.status === "approved" && (
                <Button size="sm" className="gap-1.5 h-9">
                  <RefreshCw className="h-3.5 w-3.5" />Process Refund
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 h-9 ml-auto">
                <FileText className="h-3.5 w-3.5" />Credit Note
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

