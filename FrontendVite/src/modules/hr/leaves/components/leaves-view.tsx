import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Download, X, Check, XCircle, Plane,
  Calendar, User, Building2, Clock, FileText, CheckCircle2, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { LeaveRequestDto as LeaveRequest, LeaveStatus, LeaveType } from "@/lib/hr/hr.api";
import { useLeaveRequests, useLeaveBalances, useLeaveSummary } from "@/hooks/hr/use-hr";
import { AddLeaveForm } from "./add-leave-form";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "text-warning",          bg: "bg-warning/10",     icon: Clock },
  approved:  { label: "Approved",  color: "text-success",          bg: "bg-success/10",     icon: CheckCircle2 },
  rejected:  { label: "Rejected",  color: "text-destructive",      bg: "bg-destructive/10", icon: XCircle },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", bg: "bg-muted",          icon: XCircle },
};
const STATUS_FALLBACK = { label: "Unknown", color: "text-muted-foreground", bg: "bg-muted", icon: FileText };

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Annual Leave", sick: "Sick Leave", unpaid: "Unpaid Leave",
  maternity: "Maternity", paternity: "Paternity", emergency: "Emergency", hajj: "Hajj",
};

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
  const c = STATUS_CONFIG[status] ?? STATUS_FALLBACK;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", c.color, c.bg)}>
      <Icon className="h-3 w-3" />{c.label}
    </span>
  );
}

function LeaveDrawer({ request, open, onClose }: { request: LeaveRequest | null; open: boolean; onClose: () => void }) {
  if (!request) return null;
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
              <p className="font-bold text-base">Leave Request</p>
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
                <span className="text-sm text-muted-foreground">Status</span>
                <LeaveStatusBadge status={request.status} />
              </div>

              {/* Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Request Details</h4>
                {[
                  { icon: FileText,   label: "Leave Type",    value: LEAVE_TYPE_LABELS[request.leaveType] ?? request.leaveType },
                  { icon: Calendar,   label: "From",          value: formatDate(request.fromDate, "medium") },
                  { icon: Calendar,   label: "To",            value: formatDate(request.toDate, "medium") },
                  { icon: Clock,      label: "Duration",      value: `${request.days} day${request.days > 1 ? "s" : ""}` },
                  { icon: Calendar,   label: "Applied On",    value: formatDate(request.appliedOn, "medium") },
                  ...(request.coveringEmployee ? [{ icon: User, label: "Covered By", value: request.coveringEmployee }] : []),
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
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Reason</h4>
                <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3 leading-relaxed">{request.reason}</p>
              </div>

              {/* Approval info */}
              {request.approvedBy && (
                <div className="bg-success/5 border border-success/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    <span className="text-xs font-semibold text-success">Approved</span>
                  </div>
                  <p className="text-sm">by <span className="font-medium">{request.approvedBy}</span></p>
                  <p className="text-xs text-muted-foreground">{formatDate(request.approvedOn!, "medium")}</p>
                </div>
              )}
              {request.rejectionReason && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-xs font-semibold text-destructive">Rejection Reason</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{request.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {request.status === "pending" && (
              <div className="border-t border-border px-6 py-4 flex items-center gap-3">
                <Button className="flex-1 gap-1.5 bg-success hover:bg-success/90">
                  <Check className="h-4 w-4" />Approve
                </Button>
                <Button variant="outline" className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                  <X className="h-4 w-4" />Reject
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
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [selectedRequest, setSelectedRequest] = React.useState<LeaveRequest | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"requests" | "balances">("requests");
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: leaveRequests = [] } = useLeaveRequests();
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
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage leave requests and employee balances</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm"><Download className="h-3.5 w-3.5" />Export</Button>
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />Apply Leave</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Requests",    value: leaveSummary?.totalRequests ?? leaveRequests.length,                                            color: "text-primary bg-primary/10",          icon: FileText },
          { label: "Pending Approval",  value: leaveSummary?.pending       ?? leaveRequests.filter(r => r.status === "pending").length,    color: "text-warning bg-warning/10",          icon: Clock },
          { label: "Approved",          value: leaveSummary?.approved      ?? leaveRequests.filter(r => r.status === "approved").length,   color: "text-success bg-success/10",          icon: CheckCircle2 },
          { label: "Rejected",          value: leaveSummary?.rejected      ?? leaveRequests.filter(r => r.status === "rejected").length,   color: "text-destructive bg-destructive/10",  icon: XCircle },
          { label: "On Leave Today",    value: leaveSummary?.onLeaveToday  ?? 0,                                                           color: "text-info bg-info/10",                icon: Plane },
          { label: "Avg Duration",      value: `${leaveSummary?.avgLeaveDays ?? 0}d`,                                                      color: "text-muted-foreground bg-muted",      icon: Calendar },
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
        {(["requests","balances"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn("px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              activeTab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t === "requests" ? "Leave Requests" : "Leave Balances"}
          </button>
        ))}
      </div>

      {activeTab === "requests" && (
        <Card>
          <CardHeader className="pb-0">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  {["all","pending","approved","rejected"].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
                        statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                      {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="all">All Types</option>
                  {(Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/30">
                  <tr>
                    {["Employee","Leave Type","From","To","Days","Applied On","Status",""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-16 text-muted-foreground text-sm">No requests found.</td></tr>
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
                          {LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType}
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
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-success hover:text-success hover:bg-success/10">
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10">
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
              Showing {filtered.length} of {leaveRequests.length} requests
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</th>
                    {["Annual Leave", "Sick Leave", "Unpaid Leave"].map(h => (
                      <th key={h} colSpan={3} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-l border-border/50">{h}</th>
                    ))}
                  </tr>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="px-4 py-2" />
                    {["Annual","Sick","Unpaid"].map(lt => (
                      <React.Fragment key={lt}>
                        <th className="px-3 py-2 text-center text-[10px] text-muted-foreground border-l border-border/50">Entitled</th>
                        <th className="px-3 py-2 text-center text-[10px] text-muted-foreground">Taken</th>
                        <th className="px-3 py-2 text-center text-[10px] text-muted-foreground">Balance</th>
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


