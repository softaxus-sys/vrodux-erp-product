import * as React from "react";
import { motion } from "framer-motion";
import {
  Users, UserCheck, Clock, Plane, CalendarDays,
  Search, X, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import type { AttendanceRecordDto as AttendanceRecord, AttendanceStatus } from "@/lib/hr/hr.api";
import { DEPARTMENTS } from "@/lib/hr/hr.api";
import {
  useAttendance, useAttendanceSummary,
  useMarkAttendance, useUpdateAttendance,
  useEmployees,
} from "@/hooks/hr/use-hr";
import { Can } from "@/components/auth/can";
import { toast } from "sonner";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";

const TODAY = new Date().toISOString().split("T")[0];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  present:   { label: "Present",  color: "text-success",          bg: "bg-success/10",          dot: "bg-success" },
  late:      { label: "Late",     color: "text-warning",          bg: "bg-warning/10",          dot: "bg-warning" },
  absent:    { label: "Absent",   color: "text-destructive",      bg: "bg-destructive/10",      dot: "bg-destructive" },
  half_day:  { label: "Half Day", color: "text-info",             bg: "bg-info/10",             dot: "bg-info" },
  "half-day":{ label: "Half Day", color: "text-info",             bg: "bg-info/10",             dot: "bg-info" },
  on_leave:  { label: "On Leave", color: "text-primary",          bg: "bg-primary/10",          dot: "bg-primary" },
  holiday:   { label: "Holiday",  color: "text-violet-600",       bg: "bg-violet-100/50",       dot: "bg-violet-500" },
  weekend:   { label: "Weekend",  color: "text-muted-foreground", bg: "bg-muted/30",            dot: "bg-muted-foreground" },
  remote:    { label: "Remote",   color: "text-teal-600",         bg: "bg-teal-100/50",         dot: "bg-teal-500" },
};

const STATUS_FALLBACK = { label: "Unknown", color: "text-muted-foreground", bg: "bg-muted/30", dot: "bg-muted-foreground" };
const MARKABLE_STATUSES: AttendanceStatus[] = ["present","late","absent","half_day","on_leave","remote","holiday","weekend"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: number; sub: string; icon: React.ElementType; color: string }) {
  return (
    <Card className="card-hover">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-bold text-lg leading-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground/70">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_FALLBACK;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", c.color, c.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────

function MonthCalendar({ records }: { records: AttendanceRecord[] }) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days  = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthLabel = now.toLocaleString("en-AE", { month: "long", year: "numeric" });

  const employeeIds = [...new Set(records.map(r => r.employeeId))].slice(0, 6);
  const mm = String(month + 1).padStart(2, "0");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Attendance Calendar — {monthLabel}</CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            {(["present","late","absent","on_leave","remote","weekend"] as AttendanceStatus[]).map(s => {
              const cfg = STATUS_CONFIG[s] ?? STATUS_FALLBACK;
              return (
                <span key={s} className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full", cfg.color, cfg.bg)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                  {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-y border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide w-44">Employee</th>
              {days.map(d => {
                const date = new Date(year, month, d);
                const isWknd = date.getDay() === 5 || date.getDay() === 6;
                return (
                  <th key={d} className={cn("px-1.5 py-2.5 text-center font-medium w-9", isWknd ? "text-muted-foreground/40" : "text-muted-foreground")}>
                    <div>{d}</div>
                    <div className="text-[9px]">{["Su","Mo","Tu","We","Th","Fr","Sa"][date.getDay()]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employeeIds.map(empId => {
              const empRecords = records.filter(r => r.employeeId === empId);
              const empName = empRecords[0]?.employeeName ?? "";
              return (
                <tr key={empId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                          {getInitials(empName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-xs truncate max-w-[100px]">{empName}</span>
                    </div>
                  </td>
                  {days.map(d => {
                    const dateStr = `${year}-${mm}-${String(d).padStart(2, "0")}`;
                    const rec = empRecords.find(r => r.date === dateStr);
                    const date = new Date(year, month, d);
                    const isWknd = date.getDay() === 5 || date.getDay() === 6;
                    const st = rec?.status ?? (isWknd ? "weekend" : undefined);
                    if (!st) return <td key={d} className="px-1 py-1.5 text-center"><div className="h-6 w-6 mx-auto" /></td>;
                    const c = STATUS_CONFIG[st] ?? STATUS_FALLBACK;
                    const abbr = st === "present" ? "✓" : st === "absent" ? "✗" : st === "late" ? "L"
                      : st === "on_leave" ? "OL" : st === "weekend" ? "—" : st === "holiday" ? "H"
                      : st === "remote" ? "R" : "½";
                    return (
                      <td key={d} className="px-1 py-1.5 text-center">
                        <div title={`${c.label}${rec?.checkIn ? ` · ${rec.checkIn}` : ""}`}
                          className={cn("h-6 w-6 mx-auto rounded-md flex items-center justify-center text-[10px] font-bold cursor-default", c.color, c.bg)}>
                          {abbr}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ── Mark Attendance Modal ─────────────────────────────────────────────────────

interface MarkRow {
  employeeId: string;
  employeeName: string;
  department: string;
  existingId?: string;   // set if record already exists for this date
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  notes: string;
}

interface MarkAttendanceModalProps {
  open: boolean;
  onClose: () => void;
  existingRecords: AttendanceRecord[];
}

function MarkAttendanceModal({ open, onClose, existingRecords }: MarkAttendanceModalProps) {
  const { data: employees = [], isLoading: loadingEmps } = useEmployees();
  const markMutation   = useMarkAttendance();
  const updateMutation = useUpdateAttendance();

  const [date, setDate]   = React.useState(TODAY);
  const [search, setSearch] = React.useState("");
  const [rows, setRows]   = React.useState<MarkRow[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Rebuild rows whenever date, employees, or existingRecords change
  React.useEffect(() => {
    if (!open || employees.length === 0) return;
    const recordsForDate = existingRecords.filter(r => r.date === date);
    setRows(employees.map(emp => {
      const existing = recordsForDate.find(r => r.employeeId === emp.id);
      return {
        employeeId:   emp.id,
        employeeName: emp.fullName,
        department:   emp.department,
        existingId:   existing?.id,
        status:       (existing?.status ?? "present") as AttendanceStatus,
        checkIn:      existing?.checkIn  ?? "",
        checkOut:     existing?.checkOut ?? "",
        notes:        existing?.note     ?? "",
      };
    }));
  }, [open, date, employees, existingRecords]);

  const updateRow = <K extends keyof MarkRow>(id: string, key: K, val: MarkRow[K]) =>
    setRows(prev => prev.map(r => r.employeeId === id ? { ...r, [key]: val } : r));

  const visibleRows = React.useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => !search || r.employeeName.toLowerCase().includes(q) || r.department.toLowerCase().includes(q));
  }, [rows, search]);

  const handleSave = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    let saved = 0, failed = 0;
    await Promise.allSettled(
      rows.map(async row => {
        try {
          if (row.existingId) {
            await updateMutation.mutateAsync({
              id: row.existingId,
              payload: {
                status:       row.status,
                checkIn:      row.checkIn  || null,
                checkOut:     row.checkOut || null,
                workingHours: null,
                notes:        row.notes    || null,
              },
            });
          } else {
            await markMutation.mutateAsync({
              employeeId:   row.employeeId,
              employeeName: row.employeeName,
              date,
              status:       row.status,
              checkIn:      row.checkIn  || null,
              checkOut:     row.checkOut || null,
              workingHours: null,
              notes:        row.notes    || null,
            });
          }
          saved++;
        } catch {
          failed++;
        }
      })
    );
    setSaving(false);
    if (failed === 0) {
      toast.success(`Attendance marked for ${saved} employee${saved !== 1 ? "s" : ""}.`);
      onClose();
    } else {
      toast.warning(`${saved} saved, ${failed} failed. Check errors and retry.`);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold">Mark Attendance</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Set attendance status for all employees</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b border-border flex flex-wrap items-center gap-3 shrink-0">
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Date</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-sm w-40" />
          </div>
          <div className="flex-1 min-w-[180px] space-y-0.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Filter</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…" className="pl-7 h-8 text-sm" />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => setRows(prev => prev.map(r => ({ ...r, status: "present" as AttendanceStatus })))}>
              Mark All Present
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => setRows(prev => prev.map(r => ({ ...r, status: "absent" as AttendanceStatus })))}>
              Mark All Absent
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loadingEmps ? (
            <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36">Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">Check In</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">Check Out</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map(row => (
                  <tr key={row.employeeId} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                            {getInitials(row.employeeName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-tight">{row.employeeName}</p>
                          <p className="text-[10px] text-muted-foreground">{row.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select value={row.status}
                        onChange={e => updateRow(row.employeeId, "status", e.target.value as AttendanceStatus)}
                        className="w-full h-7 px-2 rounded border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
                        {MARKABLE_STATUSES.map(s => (
                          <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Input type="time" value={row.checkIn}
                        onChange={e => updateRow(row.employeeId, "checkIn", e.target.value)}
                        className="h-7 text-xs px-2 font-mono" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="time" value={row.checkOut}
                        onChange={e => updateRow(row.employeeId, "checkOut", e.target.value)}
                        className="h-7 text-xs px-2 font-mono" />
                    </td>
                    <td className="px-3 py-2">
                      <Input value={row.notes} placeholder="Optional…"
                        onChange={e => updateRow(row.employeeId, "notes", e.target.value)}
                        className="h-7 text-xs px-2" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <p className="text-xs text-muted-foreground">{rows.length} employees</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || rows.length === 0 || loadingEmps}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : `Save ${rows.length} Records`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function AttendanceView() {
  const [search, setSearch]       = React.useState("");
  const [deptFilter, setDeptFilter]     = React.useState("All Departments");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [markOpen, setMarkOpen]         = React.useState(false);

  const { data: attendanceRecords = [] } = useAttendance();
  const { data: attendanceSummary }      = useAttendanceSummary();

  const todayRecords = React.useMemo(
    () => attendanceRecords.filter(r => r.date === TODAY),
    [attendanceRecords]
  );

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return todayRecords.filter(r => {
      const matchSearch = !search || r.employeeName.toLowerCase().includes(q);
      const matchDept   = deptFilter === "All Departments" || r.department === deptFilter;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [search, deptFilter, statusFilter, todayRecords]);

  const todayLabel = new Date().toLocaleDateString("en-AE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const exportCsv = () => {
    const csv = toCsv(attendanceRecords.map(r => ({
      "Employee":    r.employeeName,
      "Department":  r.department,
      "Date":        r.date,
      "Status":      r.status,
      "Check In":    r.checkIn  ?? "",
      "Check Out":   r.checkOut ?? "",
      "Hours":       r.hoursWorked ?? "",
      "Notes":       r.note ?? "",
    })), ["Employee","Department","Date","Status","Check In","Check Out","Hours","Notes"]);
    downloadFile(`attendance_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Attendance Report",
    subtitle: `${attendanceRecords.length} records · ${todayLabel}`,
    columns: ["Employee","Department","Date","Status","Check In","Check Out","Hours"],
    rows: attendanceRecords.map(r => [r.employeeName, r.department, r.date, r.status, r.checkIn ?? "—", r.checkOut ?? "—", r.hoursWorked ?? "—"]),
    landscape: true,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{todayLabel} · Real-time tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} />
          <Can permission="hr.attendance.create">
            <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setMarkOpen(true)}>
              <CalendarDays className="h-4 w-4" />Mark Attendance
            </Button>
          </Can>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Employees", value: attendanceSummary?.totalEmployees ?? todayRecords.length,                                        sub: "Enrolled",       icon: Users,      color: "text-primary bg-primary/10" },
          { label: "Present Today",   value: attendanceSummary?.presentToday   ?? todayRecords.filter(r => r.status === "present").length,   sub: "On time",        icon: UserCheck,  color: "text-success bg-success/10" },
          { label: "Late Today",      value: attendanceSummary?.lateToday      ?? todayRecords.filter(r => r.status === "late").length,      sub: "After 9:00 AM",  icon: Clock,      color: "text-warning bg-warning/10" },
          { label: "Absent Today",    value: attendanceSummary?.absentToday    ?? todayRecords.filter(r => r.status === "absent").length,    sub: "No check-in",    icon: Users,      color: "text-destructive bg-destructive/10" },
          { label: "On Leave",        value: attendanceSummary?.onLeaveToday   ?? todayRecords.filter(r => r.status === "on_leave").length,  sub: "Approved leave", icon: Plane,      color: "text-info bg-info/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <StatCard {...s} />
          </motion.div>
        ))}
      </div>

      {/* Calendar */}
      <MonthCalendar records={attendanceRecords} />

      {/* Today's table */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
              <div className="flex items-center gap-1">
                {["all","present","late","absent","on_leave"].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize",
                      statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                    {s === "all" ? "All" : s === "on_leave" ? "On Leave" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/30">
                <tr>
                  {["Employee", "Department", "Check In", "Check Out", "Hours", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-16 text-muted-foreground text-sm">No records found for today.</td></tr>
                ) : filtered.map((rec, i) => (
                  <motion.tr key={rec.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }} className="erp-table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                            {getInitials(rec.employeeName)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-medium text-sm">{rec.employeeName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{rec.department}</td>
                    <td className="px-4 py-3">
                      {rec.checkIn
                        ? <span className={cn("font-mono text-sm font-medium", rec.status === "late" ? "text-warning" : "text-foreground")}>{rec.checkIn}</span>
                        : <span className="text-muted-foreground text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {rec.checkOut ? <span className="font-mono text-sm">{rec.checkOut}</span> : <span className="text-muted-foreground text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {rec.hoursWorked ? `${rec.hoursWorked}h` : "—"}
                    </td>
                    <td className="px-4 py-3"><AttendanceBadge status={rec.status} /></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            Showing {filtered.length} of {todayRecords.length} employees today
          </div>
        </CardContent>
      </Card>

      {/* Mark Attendance Modal */}
      <MarkAttendanceModal
        open={markOpen}
        onClose={() => setMarkOpen(false)}
        existingRecords={attendanceRecords}
      />
    </div>
  );
}
