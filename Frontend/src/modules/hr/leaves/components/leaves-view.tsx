"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, X, Check, XCircle, Plane,
  Calendar, Clock, FileText, CheckCircle2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { useLeaves, useApproveLeave, useRejectLeave, useCancelLeave } from "@/hooks/hr/use-leaves";
import { useCreateLeave } from "@/hooks/hr/use-leaves";
import { useEmployeesSimple } from "@/hooks/hr/use-employees";
import type { LeaveDto } from "@/lib/hr/leaves.api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "text-warning",          bg: "bg-warning/10",     icon: Clock },
  approved:  { label: "Approved",  color: "text-success",          bg: "bg-success/10",     icon: CheckCircle2 },
  rejected:  { label: "Rejected",  color: "text-destructive",      bg: "bg-destructive/10", icon: XCircle },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", bg: "bg-muted",          icon: XCircle },
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  annual:    "bg-primary/10 text-primary",
  sick:      "bg-warning/10 text-warning",
  unpaid:    "bg-muted text-muted-foreground",
  maternity: "bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400",
  paternity: "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  emergency: "bg-destructive/10 text-destructive",
};

function LeaveDrawer({
  leave, onClose,
}: { leave: LeaveDto; onClose: () => void }) {
  const sc = STATUS_CONFIG[leave.status] ?? { label: leave.status, color: "text-foreground", bg: "bg-muted", icon: Clock };
  const approve = useApproveLeave();
  const reject  = useRejectLeave();
  const cancel  = useCancelLeave();

  // Use a placeholder approverId — in a real app this comes from the auth store
  const APPROVER_ID = "00000000-0000-0000-0000-000000000001";

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="font-bold text-base">Leave Request</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Employee */}
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="font-bold bg-primary/10 text-primary">
                {getInitials(leave.employeeName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold">{leave.employeeName}</p>
              <p className="text-xs text-muted-foreground">{leave.leaveNumber}</p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
              <sc.icon className="h-3 w-3" />{sc.label}
            </span>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Request Details</h4>
            {[
              { icon: FileText,  label: "Leave Type", value: leave.leaveType },
              { icon: Calendar,  label: "From",       value: formatDate(leave.startDate, "medium") },
              { icon: Calendar,  label: "To",         value: formatDate(leave.endDate, "medium") },
              { icon: Clock,     label: "Duration",   value: `${leave.totalDays} day${leave.totalDays !== 1 ? "s" : ""}` },
              { icon: Calendar,  label: "Submitted",  value: formatDate(leave.createdAt, "medium") },
            ].map(row => (
              <div key={row.label} className="flex items-start gap-3 py-2 border-b border-border/40">
                <row.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 flex justify-between">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-medium capitalize">{row.value}</span>
                </div>
              </div>
            ))}
          </div>

          {leave.reason && (
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Reason</p>
              <p className="text-sm">{leave.reason}</p>
            </div>
          )}
          {leave.approverNotes && (
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Approver Notes</p>
              <p className="text-sm">{leave.approverNotes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {leave.status === "pending" && (
          <div className="border-t border-border px-6 py-4 flex gap-2">
            <Button size="sm" className="flex-1 gap-1.5 bg-success hover:bg-success/90"
              disabled={approve.isPending}
              onClick={() => { approve.mutate({ id: leave.id, approverId: APPROVER_ID }); onClose(); }}>
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
              disabled={reject.isPending}
              onClick={() => { reject.mutate({ id: leave.id, approverId: APPROVER_ID }); onClose(); }}>
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        )}
        {(leave.status === "pending" || leave.status === "approved") && (
          <div className="px-6 pb-4">
            <Button size="sm" variant="outline" className="w-full"
              disabled={cancel.isPending}
              onClick={() => { cancel.mutate(leave.id); onClose(); }}>
              Cancel Leave
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function AddLeaveModal({ onClose }: { onClose: () => void }) {
  const { data: employees = [] } = useEmployeesSimple();
  const createLeave = useCreateLeave();

  const [employeeId, setEmployeeId]   = React.useState("");
  const [leaveType, setLeaveType]     = React.useState("annual");
  const [startDate, setStartDate]     = React.useState("");
  const [endDate, setEndDate]         = React.useState("");
  const [reason, setReason]           = React.useState("");

  const totalDays = React.useMemo(() => {
    if (!startDate || !endDate) return 0;
    const diff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000;
    return Math.max(0, diff + 1);
  }, [startDate, endDate]);

  const isValid = employeeId && leaveType && startDate && endDate && totalDays > 0;
  const emp = employees.find(e => e.id === employeeId);

  const handleSubmit = async () => {
    if (!isValid || !emp) return;
    await createLeave.mutateAsync({
      employeeId,
      employeeName: emp.fullName,
      leaveType,
      startDate,
      endDate,
      totalDays,
      reason: reason || null,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="font-bold text-base">New Leave Request</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee *</label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm">
              <option value="">— Select employee —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Leave Type *</label>
            <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm capitalize">
              {["annual","sick","unpaid","maternity","paternity","emergency"].map(t => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date *</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End Date *</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9" />
            </div>
          </div>
          {totalDays > 0 && (
            <p className="text-xs text-muted-foreground">Duration: <span className="font-semibold text-foreground">{totalDays} day{totalDays !== 1 ? "s" : ""}</span></p>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              rows={3} placeholder="Reason for leave…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || createLeave.isPending}>
            {createLeave.isPending ? "Submitting…" : "Submit Request"}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function LeavesView() {
  const [search, setSearch]           = React.useState("");
  const [statusFilter, setStatus]     = React.useState<string>("all");
  const [leaveTypeFilter, setType]    = React.useState<string>("all");
  const [page, setPage]               = React.useState(1);
  const [selected, setSelected]       = React.useState<LeaveDto | null>(null);
  const [drawerOpen, setDrawerOpen]   = React.useState(false);
  const [showAdd, setShowAdd]         = React.useState(false);

  // Mutations declared at component level (rules of hooks)
  const approve = useApproveLeave();
  const reject  = useRejectLeave();
  const APPROVER_ID = "00000000-0000-0000-0000-000000000001";

  const { data, isLoading } = useLeaves({
    page,
    pageSize:  20,
    search:    search    || undefined,
    status:    statusFilter  !== "all" ? statusFilter  : undefined,
    leaveType: leaveTypeFilter !== "all" ? leaveTypeFilter : undefined,
  });

  const leaves     = data?.items      ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const pending  = leaves.filter(l => l.status === "pending").length;
  const approved = leaves.filter(l => l.status === "approved").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Review and approve employee leave requests.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> New Request
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total (page)", value: leaves.length,  icon: Plane,       color: "text-primary",   bg: "bg-primary/10" },
          { label: "Pending",      value: pending,         icon: Clock,       color: "text-warning",   bg: "bg-warning/10" },
          { label: "Approved",     value: approved,        icon: CheckCircle2, color: "text-success",  bg: "bg-success/10" },
          { label: "All Records",  value: totalCount,      icon: FileText,    color: "text-primary",   bg: "bg-primary/10" },
        ].map((card, i) => (
          <motion.div key={card.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn("text-lg font-bold", card.color)}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or number…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "pending", "approved", "rejected", "cancelled"] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
        <select value={leaveTypeFilter} onChange={e => { setType(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="all">All Types</option>
          {["annual","sick","unpaid","maternity","paternity","emergency"].map(t => (
            <option key={t} value={t} className="capitalize">{t}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Employee</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Type</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Dates</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Days</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</td></tr>
            ) : leaves.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No leave requests found.</td></tr>
            ) : leaves.map(leave => {
              const sc = STATUS_CONFIG[leave.status] ?? { label: leave.status, color: "text-foreground", bg: "bg-muted", icon: Clock };
              return (
                <tr key={leave.id} onClick={() => { setSelected(leave); setDrawerOpen(true); }}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(leave.employeeName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{leave.employeeName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{leave.leaveNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold capitalize",
                      LEAVE_TYPE_COLORS[leave.leaveType] ?? "bg-muted text-muted-foreground")}>
                      {leave.leaveType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                    {formatDate(leave.startDate, "short")} → {formatDate(leave.endDate, "short")}
                  </td>
                  <td className="px-4 py-3 text-sm text-center hidden lg:table-cell">{leave.totalDays}d</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <sc.icon className="h-3 w-3" />{sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    {leave.status === "pending" ? (
                      <div className="flex justify-center gap-1">
                        <button onClick={() => approve.mutate({ id: leave.id, approverId: APPROVER_ID })}
                          className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => reject.mutate({ id: leave.id, approverId: APPROVER_ID })}
                          className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {totalCount} total</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {drawerOpen && selected && (
          <LeaveDrawer leave={selected} onClose={() => { setDrawerOpen(false); setSelected(null); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAdd && <AddLeaveModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  );
}
