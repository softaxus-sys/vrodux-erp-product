import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, X, Check, XCircle, Plane,
  Calendar, User, Building2, Clock, FileText, CheckCircle2, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { LeaveRequestDto as LeaveRequest, LeaveStatus } from "@/lib/hr/hr.api";
import { useLeaveRequests, useLeaveBalances, useLeaveSummary, useApproveLeave, useRejectLeave } from "@/hooks/hr/use-hr";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { AddLeaveForm } from "./add-leave-form";
import { Can } from "@/components/auth/can";

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  pending:   { color: "text-warning",          bg: "bg-warning/10",     icon: Clock },
  approved:  { color: "text-success",          bg: "bg-success/10",     icon: CheckCircle2 },
  rejected:  { color: "text-destructive",      bg: "bg-destructive/10", icon: XCircle },
  cancelled: { color: "text-muted-foreground", bg: "bg-muted",          icon: XCircle },
};
const STATUS_FALLBACK = { color: "text-muted-foreground", bg: "bg-muted", icon: FileText };

const LEAVE_TYPE_KEYS = ["annual", "sick", "unpaid", "maternity", "paternity", "emergency", "hajj"];

const LEAVE_TYPE_COLORS: Record<string, string> = {
  annual:    "bg-primary/10 text-primary",
  sick:      "bg-warning/10 text-warning",
  unpaid:    "bg-muted text-muted-foreground",
  maternity: "bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400",
  paternity: "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  emergency: "bg-destructive/10 text-destructive",
  hajj:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
};

function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const { t } = useTranslation("hr");
  const c = STATUS_CONFIG[status] ?? STATUS_FALLBACK;
  const Icon = c.icon;
  const label = STATUS_CONFIG[status] ? t(`leaveStatus.${status}`) : t("employeeStatus.unknown");
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", c.color, c.bg)}>
      <Icon className="h-3 w-3" />{label}
    </span>
  );
}

function LeaveDrawer({ request, open, onClose }: { request: LeaveRequest | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation("hr");
  const [showReject, setShowReject] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();

  React.useEffect(() => {
    if (!open) { setShowReject(false); setRejectReason(""); }
  }, [open]);

  if (!request) return null;

  const handleApprove = async () => {
    try { await approveLeave.mutateAsync(request.id); onClose(); } catch { /* hook toasts */ }
  };

  const handleReject = async () => {
    try { await rejectLeave.mutateAsync({ id: request.id, reason: rejectReason.trim() || undefined }); onClose(); } catch { /* hook toasts */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <p className="font-bold text-base">{t("leaves.drawer.title")}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Employee */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="font-bold bg-primary/10 text-primary">{getInitials(request.employeeName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold">{request.employeeName}</p>
                  <p className="text-sm text-muted-foreground">{request.designation}</p>
                  <p className="text-xs text-muted-foreground">{request.department}</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                <span className="text-sm text-muted-foreground">{t("leaves.drawer.status")}</span>
                <LeaveStatusBadge status={request.status} />
              </div>

              {/* Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("leaves.drawer.requestDetails")}</h4>
                {[
                  { icon: FileText,   label: t("leaves.drawer.leaveType"),  value: t(`leaveType.${request.leaveType}`, { defaultValue: request.leaveType }) },
                  { icon: Calendar,   label: t("leaves.drawer.from"),       value: formatDate(request.fromDate, "medium") },
                  { icon: Calendar,   label: t("leaves.drawer.to"),         value: formatDate(request.toDate, "medium") },
                  { icon: Clock,      label: t("leaves.drawer.duration"),   value: t("leaves.drawer.days", { count: request.days }) },
                  { icon: Calendar,   label: t("leaves.drawer.appliedOn"),  value: formatDate(request.appliedOn, "medium") },
                  ...(request.coveringEmployee ? [{ icon: User, label: t("leaves.drawer.coveredBy"), value: request.coveringEmployee }] : []),
                ].map(row => (
                  <div key={row.label} className="flex items-start gap-3 py-2 border-b border-border/40">
                    <row.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 flex justify-between">
                      <span className="text-xs text-muted-foreground">{row.label}</span>
                      <span className="text-sm font-medium">{row.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reason */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("leaves.drawer.reason")}</h4>
                <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3 leading-relaxed">{request.reason}</p>
              </div>

              {/* Approval info */}
              {request.approvedBy && (
                <div className="bg-success/5 border border-success/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    <span className="text-xs font-semibold text-success">{t("leaves.drawer.approved")}</span>
                  </div>
                  <p className="text-sm">{t("leaves.drawer.approvedBy", { name: request.approvedBy })}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(request.approvedOn!, "medium")}</p>
                </div>
              )}
              {request.rejectionReason && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-xs font-semibold text-destructive">{t("leaves.drawer.rejectionReason")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{request.rejectionReason}</p>
                </div>
              )}

              {/* Inline reject reason input */}
              <AnimatePresence>
                {showReject && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                    className="overflow-hidden">
                    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-destructive">{t("leaves.drawer.rejectionReasonOptional")}</p>
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder={t("leaves.drawer.rejectPlaceholder")}
                        rows={3}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-destructive"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowReject(false)}>{t("leaves.drawer.cancel")}</Button>
                        <Button size="sm" className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                          onClick={handleReject} disabled={rejectLeave.isPending}>
                          {rejectLeave.isPending ? t("leaves.drawer.rejecting") : t("leaves.drawer.confirmReject")}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            {request.status === "pending" && !showReject && (
              <div className="border-t border-border px-6 py-4 flex items-center gap-3">
                <Button className="flex-1 gap-1.5 bg-success hover:bg-success/90 text-white"
                  onClick={handleApprove} disabled={approveLeave.isPending}>
                  <Check className="h-4 w-4" />{approveLeave.isPending ? t("leaves.drawer.approving") : t("leaves.drawer.approve")}
                </Button>
                <Button variant="outline" className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowReject(true)}>
                  <X className="h-4 w-4" />{t("leaves.drawer.reject")}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function LeavesView() {
  const { t } = useTranslation("hr");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [selectedRequest, setSelectedRequest] = React.useState<LeaveRequest | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"requests" | "balances">("requests");
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: leaveRequests = [] } = useLeaveRequests();
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();

  const exportCsv = () => {
    const csv = toCsv(leaveRequests.map(r => ({
      "Employee":    r.employeeName,
      "Department":  r.department,
      "Type":        r.leaveType,
      "From":        r.fromDate ?? "",
      "To":          r.toDate ?? "",
      "Days":        r.days,
      "Status":      r.status,
      "Reason":      r.reason,
      "Applied On":  r.appliedOn ?? "",
    })), ["Employee","Department","Type","From","To","Days","Status","Reason","Applied On"]);
    downloadFile(`leaves_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Leave Requests",
    subtitle: `${leaveRequests.length} requests`,
    columns: ["Employee","Department","Type","From","To","Days","Status","Reason"],
    rows: leaveRequests.map(r => [r.employeeName, r.department, r.leaveType, r.fromDate ?? "—", r.toDate ?? "—", r.days, r.status, r.reason]),
    landscape: true,
  });
  const { data: leaveBalances = [] } = useLeaveBalances();
  const { data: leaveSummary } = useLeaveSummary();

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return leaveRequests.filter(r => {
      const matchSearch = !search || r.employeeName.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchType = typeFilter === "all" || r.leaveType === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [search, statusFilter, typeFilter, leaveRequests]);

  const openDrawer = (r: LeaveRequest) => { setSelectedRequest(r); setDrawerOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("leaves.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("leaves.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} />
          <Can permission="hr.leaves.create"><Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />{t("leaves.applyLeave")}</Button></Can>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: t("leaves.stat.totalRequests"),   value: leaveSummary?.totalRequests ?? leaveRequests.length,                                            color: "text-primary bg-primary/10",          icon: FileText },
          { label: t("leaves.stat.pendingApproval"), value: leaveSummary?.pending       ?? leaveRequests.filter(r => r.status === "pending").length,    color: "text-warning bg-warning/10",          icon: Clock },
          { label: t("leaves.stat.approved"),        value: leaveSummary?.approved      ?? leaveRequests.filter(r => r.status === "approved").length,   color: "text-success bg-success/10",          icon: CheckCircle2 },
          { label: t("leaves.stat.rejected"),        value: leaveSummary?.rejected      ?? leaveRequests.filter(r => r.status === "rejected").length,   color: "text-destructive bg-destructive/10",  icon: XCircle },
          { label: t("leaves.stat.onLeaveToday"),    value: leaveSummary?.onLeaveToday  ?? 0,                                                           color: "text-info bg-info/10",                icon: Plane },
          { label: t("leaves.stat.avgDuration"),     value: `${leaveSummary?.avgLeaveDays ?? 0}d`,                                                      color: "text-muted-foreground bg-muted",      icon: Calendar },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-bold text-lg leading-tight">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border">
        {(["requests","balances"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t(`leaves.tab.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === "requests" && (
        <Card>
          <CardHeader className="pb-0">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder={t("leaves.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  {["all","pending","approved","rejected"].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                        statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                      {s === "all" ? t("leaves.filterAll") : t(`leaveStatus.${s}`)}
                    </button>
                  ))}
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="all">{t("leaves.allTypes")}</option>
                  {LEAVE_TYPE_KEYS.map(k => <option key={k} value={k}>{t(`leaveType.${k}`)}</option>)}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/30">
                  <tr>
                    {[
                      ["employee", t("leaves.table.employee")], ["leaveType", t("leaves.table.leaveType")],
                      ["from", t("leaves.table.from")], ["to", t("leaves.table.to")], ["days", t("leaves.table.days")],
                      ["appliedOn", t("leaves.table.appliedOn")], ["status", t("leaves.table.status")], ["actions", ""],
                    ].map(([k, h]) => (
                      <th key={k} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-16 text-muted-foreground text-sm">{t("leaves.empty")}</td></tr>
                  ) : filtered.map((req, i) => (
                    <motion.tr key={req.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }} className="erp-table-row cursor-pointer" onClick={() => openDrawer(req)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">{getInitials(req.employeeName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{req.employeeName}</p>
                            <p className="text-[11px] text-muted-foreground">{req.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", LEAVE_TYPE_COLORS[req.leaveType] ?? "bg-muted text-muted-foreground")}>
                          {t(`leaveType.${req.leaveType}`, { defaultValue: req.leaveType })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(req.fromDate, "medium")}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(req.toDate, "medium")}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{req.days}d</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(req.appliedOn, "medium")}</td>
                      <td className="px-4 py-3"><LeaveStatusBadge status={req.status} /></td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {req.status === "pending" && (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                              disabled={approveLeave.isPending}
                              onClick={() => approveLeave.mutate(req.id)}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={rejectLeave.isPending}
                              onClick={() => { setSelectedRequest(req); setDrawerOpen(true); }}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              {t("leaves.showing", { shown: filtered.length, total: leaveRequests.length })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "balances" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("leaves.balances.employee")}</th>
                    {[t("leaves.balances.annualLeave"), t("leaves.balances.sickLeave"), t("leaves.balances.unpaidLeave")].map(h => (
                      <th key={h} colSpan={3} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-l border-border/50">{h}</th>
                    ))}
                  </tr>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="px-4 py-2" />
                    {["annual","sick","unpaid"].map(lt => (
                      <React.Fragment key={lt}>
                        <th className="px-3 py-2 text-center text-[10px] text-muted-foreground border-l border-border/50">{t("leaves.balances.entitled")}</th>
                        <th className="px-3 py-2 text-center text-[10px] text-muted-foreground">{t("leaves.balances.taken")}</th>
                        <th className="px-3 py-2 text-center text-[10px] text-muted-foreground">{t("leaves.balances.balance")}</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaveBalances.map((bal, i) => (
                    <motion.tr key={bal.employeeId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }} className="erp-table-row">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">{getInitials(bal.employeeName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{bal.employeeName}</p>
                            <p className="text-[11px] text-muted-foreground">{bal.department}</p>
                          </div>
                        </div>
                      </td>
                      {[bal.annual, bal.sick, bal.unpaid].map((lb, j) => (
                        <React.Fragment key={j}>
                          <td className="px-3 py-3 text-center text-sm border-l border-border/30">{lb.entitled}</td>
                          <td className="px-3 py-3 text-center text-sm text-warning font-medium">{lb.taken}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={cn("text-sm font-bold", lb.balance === 0 ? "text-destructive" : lb.balance <= 5 ? "text-warning" : "text-success")}>
                              {lb.balance}
                            </span>
                          </td>
                        </React.Fragment>
                      ))}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <LeaveDrawer request={selectedRequest} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddLeaveForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}


