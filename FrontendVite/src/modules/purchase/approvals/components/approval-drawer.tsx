import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CheckCircle2, Ban, Clock, AlertTriangle,
  User, Calendar, Building2, Tag, FileText,
  ShoppingBag, Zap,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { PurchaseApprovalDto as PurchaseApproval, ApprovalStatus, ApprovalPriority } from "@/lib/purchase/approvals.api";
import { CATEGORY_LABELS } from "@/lib/purchase/approvals.api";
import { useApproveApproval, useRejectApproval } from "@/hooks/purchase/use-approvals";
import { useAuthStore } from "@/store/auth.store";
import { Can } from "@/components/auth/can";

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "text-warning",      bg: "bg-warning/10",     icon: Clock },
  approved:  { label: "Approved",  color: "text-success",      bg: "bg-success/10",     icon: CheckCircle2 },
  rejected:  { label: "Rejected",  color: "text-destructive",  bg: "bg-destructive/10", icon: Ban },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", bg: "bg-muted",      icon: Ban },
};

const PRIORITY_CONFIG: Record<ApprovalPriority, { label: string; color: string; bg: string }> = {
  low:    { label: "Low",    color: "text-muted-foreground", bg: "bg-muted" },
  medium: { label: "Medium", color: "text-blue-600",         bg: "bg-blue-50 dark:bg-blue-900/20" },
  high:   { label: "High",   color: "text-warning",          bg: "bg-warning/10" },
  urgent: { label: "Urgent", color: "text-destructive",      bg: "bg-destructive/10" },
};

interface Props { approval: PurchaseApproval | null; open: boolean; onClose: () => void; }

export function ApprovalDrawer({ approval, open, onClose }: Props) {
  const approve = useApproveApproval();
  const reject  = useRejectApproval();
  const by = useAuthStore(s => s.user?.name) ?? "System";
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  React.useEffect(() => { if (!open) { setRejecting(false); setReason(""); } }, [open]);
  if (!approval) return null;

  const busy = approve.isPending || reject.isPending;
  const sc = STATUS_CONFIG[approval.status];
  const pc = PRIORITY_CONFIG[approval.priority];
  const StatusIcon = sc.icon;

  const isOverdue = new Date(approval.requiredBy) < new Date() && approval.status === "pending";

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
                  <p className="font-bold text-base leading-tight">{approval.requestNumber}</p>
                  <p className="text-sm text-muted-foreground truncate">{approval.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <StatusIcon className="h-3 w-3" />{sc.label}
                    </span>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", pc.color, pc.bg)}>
                      {approval.priority === "urgent" && <Zap className="h-3 w-3" />}
                      {pc.label} Priority
                    </span>
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-destructive bg-destructive/10">
                        <AlertTriangle className="h-3 w-3" />Overdue
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Total */}
              <div className={cn("border rounded-xl p-5",
                approval.status === "approved" ? "bg-success/5 border-success/20" :
                approval.status === "rejected" ? "bg-destructive/5 border-destructive/20" :
                "bg-muted/30 border-border")}>
                <p className="text-xs text-muted-foreground mb-1">Requested Budget</p>
                <p className={cn("text-3xl font-bold",
                  approval.status === "approved" ? "text-success" :
                  approval.status === "rejected" ? "text-destructive" : "text-foreground")}>
                  {formatCurrency(approval.totalAmount, approval.currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">{approval.currency} · {CATEGORY_LABELS[approval.category]}</p>
              </div>

              {/* Justification */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Business Justification</h4>
                <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 leading-relaxed">{approval.justification}</p>
              </div>

              {/* Details */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Request Details</h4>
                <div className="bg-muted/30 rounded-xl p-4 space-y-0">
                  {[
                    { icon: User,       label: "Requested By",    value: approval.requestedBy },
                    { icon: Building2,  label: "Department",      value: approval.department },
                    { icon: Calendar,   label: "Request Date",    value: formatDate(approval.requestDate, "medium") },
                    { icon: Calendar,   label: "Required By",     value: <span className={cn(isOverdue ? "text-destructive font-semibold" : "")}>{formatDate(approval.requiredBy, "medium")}</span> },
                    { icon: Tag,        label: "Category",        value: CATEGORY_LABELS[approval.category] },
                    ...(approval.vendorSuggestion ? [{ icon: Building2, label: "Preferred Vendor", value: approval.vendorSuggestion }] : []),
                    ...(approval.approvedBy ? [{ icon: User, label: "Reviewed By", value: approval.approvedBy }] : []),
                    ...(approval.approvedDate ? [{ icon: Calendar, label: "Reviewed On", value: formatDate(approval.approvedDate, "medium") }] : []),
                    ...(approval.convertedToPO ? [{ icon: ShoppingBag, label: "PO Created", value: <span className="font-mono text-xs text-primary">{approval.convertedToPO}</span> }] : []),
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

              {/* Rejection reason */}
              {approval.status === "rejected" && approval.rejectionReason && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rejection Reason</h4>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3">
                    <p className="text-sm text-destructive leading-relaxed">{approval.rejectionReason}</p>
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Requested Items ({approval.items.length})
                </h4>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-xs text-muted-foreground">
                        <th className="text-left px-4 py-3 font-semibold">Description</th>
                        <th className="text-right px-4 py-3 font-semibold">Qty</th>
                        <th className="text-right px-4 py-3 font-semibold">Est. Unit</th>
                        <th className="text-right px-4 py-3 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approval.items.map((item, i) => (
                        <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium">{item.description}</td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-sm">{formatCurrency(item.estimatedUnitPrice, approval.currency)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.total, approval.currency)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex justify-between items-center px-1">
                  <span className="text-sm text-muted-foreground">Estimated Total</span>
                  <span className="font-bold text-base">{formatCurrency(approval.totalAmount, approval.currency)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 flex items-center gap-2">
              {approval.status === "pending" && (
                <Can permission="purchase.approvals.approve">
                  {rejecting ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input autoFocus value={reason} onChange={e => setReason(e.target.value)}
                        placeholder="Rejection reason…" className="h-9 flex-1 text-sm" />
                      <Button variant="outline" size="sm" className="h-9 text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={busy || !reason.trim()}
                        onClick={() => reject.mutate({ id: approval.id, by, reason: reason.trim() }, { onSuccess: onClose })}>
                        {reject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm Reject"}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-9" onClick={() => setRejecting(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <>
                      <Button size="sm" className="gap-1.5 h-9 bg-success hover:bg-success/90" disabled={busy}
                        onClick={() => approve.mutate({ id: approval.id, by }, { onSuccess: onClose })}>
                        {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Approve
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 h-9 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={busy}
                        onClick={() => setRejecting(true)}>
                        <Ban className="h-3.5 w-3.5" />Reject
                      </Button>
                    </>
                  )}
                </Can>
              )}
              {approval.status === "approved" && !approval.convertedToPO && (
                <Button size="sm" className="gap-1.5 h-9">
                  <ShoppingBag className="h-3.5 w-3.5" />Create PO
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 h-9 ml-auto">
                <FileText className="h-3.5 w-3.5" />Export
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

