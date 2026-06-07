"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ClipboardList, Clock, CheckCircle2, Ban, DollarSign,
  Search, Plus, Zap, Calendar, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useApprovals, useApprovalSummary, useApproveRequest, useRejectRequest } from "@/hooks/purchase/use-approvals";
import type { ApprovalDto, ApprovalStatus } from "@/lib/purchase/approvals.api";
import { ApprovalDrawer } from "./approval-drawer";

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; bg: string; dot: string }> = {
  pending:   { label: "Pending",   color: "text-warning",          bg: "bg-warning/10",     dot: "bg-warning" },
  approved:  { label: "Approved",  color: "text-success",          bg: "bg-success/10",     dot: "bg-success" },
  rejected:  { label: "Rejected",  color: "text-destructive",      bg: "bg-destructive/10", dot: "bg-destructive" },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", bg: "bg-muted",          dot: "bg-muted-foreground" },
};

type Urgency = "low" | "medium" | "high" | "critical";
const URGENCY_CONFIG: Record<Urgency, { label: string; color: string; bg: string }> = {
  low:      { label: "Low",      color: "text-muted-foreground", bg: "bg-muted" },
  medium:   { label: "Medium",   color: "text-blue-600",         bg: "bg-blue-50 dark:bg-blue-900/20" },
  high:     { label: "High",     color: "text-warning",          bg: "bg-warning/10" },
  critical: { label: "Critical", color: "text-destructive",      bg: "bg-destructive/10" },
};

const TYPE_LABELS: Record<string, string> = {
  purchase_order:       "Purchase Order",
  purchase_requisition: "Purchase Requisition",
  vendor_quote:         "Vendor Quote",
};

const STATUS_FILTERS: { key: ApprovalStatus | "all"; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "pending",  label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export function ApprovalsView() {
  const [search, setSearch]           = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ApprovalStatus | "all">("all");
  const [selected, setSelected]       = React.useState<ApprovalDto | null>(null);
  const [drawerOpen, setDrawerOpen]   = React.useState(false);

  const { data: approvals = [], isLoading } = useApprovals();
  const { data: summary }                   = useApprovalSummary();
  const approveRequest = useApproveRequest();
  const rejectRequest  = useRejectRequest();

  const pendingCount  = approvals.filter(a => a.status === "pending").length;
  const approvedCount = approvals.filter(a => a.status === "approved").length;
  const rejectedCount = approvals.filter(a => a.status === "rejected").length;
  const totalValue    = approvals.reduce((s, a) => s + a.totalAmount, 0);

  const STAT_CARDS = [
    { label: "Total Requests",   value: approvals.length,                                      icon: ClipboardList, color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", format: "number"   },
    { label: "Pending Review",   value: summary?.pending ?? pendingCount,                      icon: Clock,         color: "text-warning",     bg: "bg-warning/10",                     format: "number"   },
    { label: "Approved",         value: summary?.approved ?? approvedCount,                    icon: CheckCircle2,  color: "text-success",     bg: "bg-success/10",                     format: "number"   },
    { label: "Rejected",         value: summary?.rejected ?? rejectedCount,                    icon: Ban,           color: "text-destructive", bg: "bg-destructive/10",                 format: "number"   },
    { label: "Budget Requested", value: summary?.totalValuePending ?? totalValue,              icon: DollarSign,    color: "text-primary",     bg: "bg-primary/10",                     format: "currency" },
  ];

  const filtered = React.useMemo(() => {
    let list = [...approvals].sort((a, b) => {
      const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2);
    });
    if (statusFilter !== "all") list = list.filter(a => a.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(a =>
        a.referenceNumber.toLowerCase().includes(s) ||
        a.description.toLowerCase().includes(s) ||
        a.requestedBy.toLowerCase().includes(s)
      );
    }
    return list;
  }, [approvals, search, statusFilter]);

  function openDrawer(a: ApprovalDto) { setSelected(a); setDrawerOpen(true); }
  function closeDrawer() { setDrawerOpen(false); }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Approvals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review and approve procurement requests from all departments</p>
        </div>
        <Button className="gap-2 h-9"><Plus className="h-4 w-4" />New Request</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", card.bg)}>
                <Icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                <p className="font-bold text-lg leading-tight">
                  {card.format === "currency" ? formatCurrency(card.value as number, "AED") : card.value}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search requests…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key as ApprovalStatus | "all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards layout */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
            No requests found.
          </div>
        ) : filtered.map((a, i) => {
          const sc = STATUS_CONFIG[a.status];
          const uc = URGENCY_CONFIG[a.urgency as Urgency] ?? URGENCY_CONFIG.medium;
          return (
            <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => openDrawer(a)}
              className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{a.referenceNumber}</span>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                    </span>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", uc.color, uc.bg)}>
                      {a.urgency === "critical" && <Zap className="h-2.5 w-2.5" />}{uc.label}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">{a.description}</h3>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />{TYPE_LABELS[a.type] ?? a.type}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(a.requestDate, "short")}
                    </div>
                  </div>
                  {a.notes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{a.notes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-lg">{formatCurrency(a.totalAmount, a.currency)}</p>
                  <p className="text-[10px] text-muted-foreground">{a.currency} · {a.items.length} items</p>
                  {a.status === "pending" && (
                    <div className="flex items-center gap-1.5 mt-3 justify-end" onClick={e => e.stopPropagation()}>
                      <button
                        disabled={approveRequest.isPending}
                        onClick={e => { e.stopPropagation(); approveRequest.mutate({ id: a.id }); }}
                        className="h-7 px-3 rounded-md text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50">
                        Approve
                      </button>
                      <button
                        disabled={rejectRequest.isPending}
                        onClick={e => { e.stopPropagation(); rejectRequest.mutate({ id: a.id, reason: "Rejected" }); }}
                        className="h-7 px-3 rounded-md text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  )}
                  {a.vendorName && (
                    <p className="text-[11px] text-muted-foreground mt-1">{a.vendorName}</p>
                  )}
                </div>
              </div>

              {/* Requester */}
              <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary">
                      {a.requestedBy.split(" ").map(n => n[0]).join("")}
                    </span>
                  </div>
                  {a.requestedBy} · {formatDate(a.requestDate, "short")}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <ApprovalDrawer approval={selected} open={drawerOpen} onClose={closeDrawer} />
    </div>
  );
}
