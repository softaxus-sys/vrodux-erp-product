/**
 * VoidConfirmDialog  — simple confirmation for voiding a completed transaction.
 * RefundDialog       — full refund flow: item selection, qty control, payment method, reason.
 *
 * Both hit the backend and invalidate the transaction list so the history tab
 * reflects the change immediately.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, RotateCcw, Loader2, Minus, Plus,
  CheckSquare, Square, ShieldAlert, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { useTransaction, useVoidTransaction, useRefundTransaction } from "@/hooks/pos/use-transactions";
import { usePaymentMethods } from "@/hooks/pos/use-payment-methods";
import { useAuthStore } from "@/store/auth.store";
import type { POSTransactionSummaryDto, POSLineItemDto } from "@/lib/pos/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RefundLineState {
  productId:   string;
  productName: string;
  unitPrice:   number;
  maxQty:      number;
  selectedQty: number;
  checked:     boolean;
  lineTotal:   number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency: string) {
  return formatCurrency(n, currency);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-PK", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// VoidConfirmDialog
// ═══════════════════════════════════════════════════════════════════════════════

interface VoidConfirmDialogProps {
  transaction: POSTransactionSummaryDto | null;
  onClose:     () => void;
}

export function VoidConfirmDialog({ transaction, onClose }: VoidConfirmDialogProps) {
  const { tenant }      = useAuthStore();
  const currency        = tenant?.currency ?? "PKR";
  const voidMutation    = useVoidTransaction();

  const [reason, setReason] = React.useState("");

  // Reset state when dialog opens
  React.useEffect(() => {
    if (transaction) setReason("");
  }, [transaction]);

  const handleVoid = async () => {
    if (!transaction) return;
    try {
      await voidMutation.mutateAsync({
        transactionId: transaction.id,
        reason:        reason.trim() || "Cashier void",
      });
      onClose();
    } catch {
      // error toast handled by mutation
    }
  };

  return (
    <Dialog open={!!transaction} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-base">Void Transaction</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {transaction && (
          <div className="space-y-4">
            {/* Transaction summary */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">
                  {transaction.transactionNumber}
                </span>
                <span className="text-xs text-muted-foreground">
                  {fmtTime(transaction.completedAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Amount</span>
                <span className="text-lg font-bold text-foreground">
                  {fmt(transaction.totalAmount, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment</span>
                <span className="text-xs font-semibold text-foreground">
                  {transaction.primaryPaymentMethod}
                </span>
              </div>
            </div>

            {/* Warning bullets */}
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 space-y-1.5">
              <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Voiding this transaction will:
              </p>
              {[
                "Mark the transaction as Voided in all reports",
                "Restore stock for every item in the sale",
                "Remove this sale from today's totals",
                "This cannot be reversed",
              ].map(bullet => (
                <p key={bullet} className="text-xs text-destructive/80 pl-5 flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5">•</span>{bullet}
                </p>
              ))}
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Reason <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleVoid()}
                placeholder="e.g. Customer changed mind, wrong item…"
                className="text-sm h-9"
                disabled={voidMutation.isPending}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={voidMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleVoid}
                disabled={voidMutation.isPending}
                className="min-w-[130px] gap-2"
              >
                {voidMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Voiding…</>
                  : <><ShieldAlert className="h-3.5 w-3.5" />Void Transaction</>
                }
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RefundDialog
// ═══════════════════════════════════════════════════════════════════════════════

interface RefundDialogProps {
  transaction: POSTransactionSummaryDto | null;
  sessionId:   string | null;
  onClose:     () => void;
}

export function RefundDialog({ transaction, sessionId, onClose }: RefundDialogProps) {
  const { tenant }       = useAuthStore();
  const currency         = tenant?.currency ?? "PKR";
  const paymentMethods   = usePaymentMethods();
  const refundMutation   = useRefundTransaction();

  // Fetch full transaction detail (for line items)
  const { data: fullTxn, isLoading: loadingDetail } = useTransaction(
    transaction?.id ?? ""
  );

  // Line item selection state
  const [lines, setLines] = React.useState<RefundLineState[]>([]);
  const [refundMethod, setRefundMethod] = React.useState<string>("");
  const [reason, setReason] = React.useState("");

  // Sync line state when detail loads
  React.useEffect(() => {
    if (!fullTxn?.lineItems) return;
    setLines(
      fullTxn.lineItems.map((li: POSLineItemDto) => ({
        productId:   li.productId,
        productName: li.productName,
        unitPrice:   li.unitPrice,
        maxQty:      li.quantity,
        selectedQty: li.quantity,
        checked:     true,
        lineTotal:   li.lineTotal,
      }))
    );
    // Default refund method = original payment method or first available
    const original = fullTxn.payments?.[0]?.method ?? "";
    const resolved = paymentMethods.find(
      p => p.id.toLowerCase() === original.toLowerCase()
    );
    setRefundMethod(resolved?.id ?? paymentMethods[0]?.id ?? "Cash");
    setReason("");
  }, [fullTxn, paymentMethods]);

  // Reset when dialog closes/reopens
  React.useEffect(() => {
    if (!transaction) {
      setLines([]);
      setReason("");
    }
  }, [transaction]);

  // Computed refund amount
  const refundAmount = React.useMemo(() => {
    if (!fullTxn) return 0;
    const totalOriginal = fullTxn.totalAmount;
    const selectedSubtotal = lines
      .filter(l => l.checked && l.selectedQty > 0)
      .reduce((s, l) => s + l.unitPrice * l.selectedQty, 0);
    const originalSubtotal = fullTxn.subTotal || fullTxn.totalAmount;
    if (!originalSubtotal) return 0;
    // Pro-rate tax + discounts proportionally
    return (selectedSubtotal / originalSubtotal) * totalOriginal;
  }, [lines, fullTxn]);

  const selectedCount = lines.filter(l => l.checked && l.selectedQty > 0).length;
  const allChecked    = lines.length > 0 && lines.every(l => l.checked && l.selectedQty === l.maxQty);

  // ── Line operations ──────────────────────────────────────────────────────
  const toggleLine = (productId: string) => {
    setLines(prev => prev.map(l =>
      l.productId === productId ? { ...l, checked: !l.checked } : l
    ));
  };

  const setQty = (productId: string, qty: number) => {
    setLines(prev => prev.map(l =>
      l.productId === productId
        ? { ...l, selectedQty: Math.max(1, Math.min(l.maxQty, qty)), checked: true }
        : l
    ));
  };

  const toggleAll = () => {
    if (allChecked) {
      setLines(prev => prev.map(l => ({ ...l, checked: false })));
    } else {
      setLines(prev => prev.map(l => ({
        ...l, checked: true, selectedQty: l.maxQty,
      })));
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleRefund = async () => {
    if (!transaction || !sessionId || selectedCount === 0) return;

    const selectedLines = lines.filter(l => l.checked && l.selectedQty > 0);
    try {
      await refundMutation.mutateAsync({
        transactionId: transaction.id,
        payload: {
          sessionId,
          lineItems: selectedLines.map(l => ({
            productId:       l.productId,
            quantity:        l.selectedQty,
            unitPriceOverride: l.unitPrice,
            discountPercent: 0,
            discountAmount:  0,
          })),
          payments: [{
            method:    refundMethod,
            amount:    Math.round(refundAmount * 100) / 100,
            reference: null,
          }],
          reason: reason.trim() || "Customer refund",
        },
      });
      onClose();
    } catch {
      // error toast handled by mutation
    }
  };

  return (
    <Dialog open={!!transaction} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
              <RotateCcw className="h-5 w-5 text-warning" />
            </div>
            <div>
              <DialogTitle className="text-base">Process Refund</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {transaction?.transactionNumber} · {transaction && fmt(transaction.totalAmount, currency)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading transaction details…</span>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── Line items ───────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Items to Refund
                </p>
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  {allChecked
                    ? <><CheckSquare className="h-3.5 w-3.5" />Deselect All</>
                    : <><Square className="h-3.5 w-3.5" />Select All</>
                  }
                </button>
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                <AnimatePresence initial={false}>
                  {lines.map(line => (
                    <motion.div
                      key={line.productId}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer select-none",
                        line.checked
                          ? "bg-card border-border shadow-sm"
                          : "bg-muted/20 border-dashed border-border/50 opacity-60"
                      )}
                      onClick={() => toggleLine(line.productId)}
                    >
                      {/* Checkbox */}
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                        line.checked
                          ? "bg-primary border-primary"
                          : "bg-transparent border-border"
                      )}>
                        {line.checked && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                            <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Name + price */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {line.productName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {fmt(line.unitPrice, currency)} × {line.maxQty}
                        </p>
                      </div>

                      {/* Qty control */}
                      {line.checked && (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setQty(line.productId, line.selectedQty - 1)}
                            disabled={line.selectedQty <= 1}
                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 disabled:opacity-30 transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold w-5 text-center">
                            {line.selectedQty}
                          </span>
                          <button
                            onClick={() => setQty(line.productId, line.selectedQty + 1)}
                            disabled={line.selectedQty >= line.maxQty}
                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 disabled:opacity-30 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {/* Line total */}
                      <span className="text-xs font-bold w-20 text-right shrink-0">
                        {fmt(line.unitPrice * (line.checked ? line.selectedQty : line.maxQty), currency)}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {selectedCount === 0 && (
                <p className="text-xs text-destructive mt-2 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  Select at least one item to process a refund.
                </p>
              )}
            </div>

            {/* ── Refund total ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-warning/5 border border-warning/20">
              <span className="text-sm font-semibold text-foreground">Refund Amount</span>
              <span className="text-xl font-bold text-warning">
                {fmt(refundAmount, currency)}
              </span>
            </div>

            {/* ── Refund payment method ────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                Refund Via
              </p>
              <div className="flex flex-wrap gap-1.5">
                {paymentMethods.map(pm => {
                  const Icon = pm.icon;
                  return (
                    <button
                      key={pm.id}
                      onClick={() => setRefundMethod(pm.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                        refundMethod === pm.id
                          ? `border-2 ${pm.bg} ${pm.color}`
                          : "border-border bg-muted/20 text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {pm.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Reason ──────────────────────────────────────────────── */}
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Reason <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Defective item, customer dissatisfied…"
                className="text-sm h-9"
                disabled={refundMutation.isPending}
              />
            </div>

            {/* ── Info note ────────────────────────────────────────────── */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Refunded stock will be restored to inventory. The original transaction
                will be marked as <strong>Refunded</strong> in reports.
              </p>
            </div>

            {/* ── Actions ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={refundMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRefund}
                disabled={
                  refundMutation.isPending ||
                  selectedCount === 0 ||
                  refundAmount <= 0 ||
                  !sessionId
                }
                className="min-w-[140px] gap-2 bg-warning text-warning-foreground hover:bg-warning/90"
              >
                {refundMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Processing…</>
                  : <><RotateCcw className="h-3.5 w-3.5" />Process Refund</>
                }
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
