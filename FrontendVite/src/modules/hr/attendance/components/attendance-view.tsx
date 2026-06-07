import * as React from "react";
import { motion } from "framer-motion";
import {
  Users, UserCheck, Clock, Plane, CalendarDays,
  ChevronLeft, ChevronRight, Search, Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import type { AttendanceRecordDto as AttendanceRecord, AttendanceStatus } from "@/lib/hr/hr.api";
import { DEPARTMENTS } from "@/lib/hr/hr.api";
import { useAttendance, useAttendanceSummary } from "@/hooks/hr/use-hr";

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

// Calendar grid for a single employee or all
function MonthCalendar({ records }: { records: AttendanceRecord[] }) {
  const days = Array.from({ length: 19 }, (_, i) => i + 1);
  // Group by employeeId, show first 5 employees only
  const employeeIds = [...new Set(records.map(r => r.employeeId))].slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Attendance Calendar — May 2026</CardTitle>
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
                const date = new Date(2026, 4, d);
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
            {employeeIds.map((empId, i) => {
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
                    const date = `2026-05-${String(d).padStart(2, "0")}`;
                    const rec = empRecords.find(r => r.date === date);
                    const st = rec?.status ?? "weekend";
                    const c = STATUS_CONFIG[st] ?? STATUS_FALLBACK;
                    const abbr = st === "present" ? "✓"
                      : st === "absent"   ? "✗"
                      : st === "late"     ? "L"
                      : st === "on_leave" ? "OL"
                      : st === "weekend"  ? "—"
                      : st === "holiday"  ? "H"
                      : st === "remote"   ? "R"
                      : "½"; // half_day / half-day
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

export function AttendanceView() {
  const [search, setSearch] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("All Departments");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const { data: attendanceRecords = [] } = useAttendance();
  const { data: attendanceSummary } = useAttendanceSummary();

  const todayRecords = React.useMemo(
    () => attendanceRecords.filter(r => r.date === "2026-05-19"),
    [attendanceRecords]
  );

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return todayRecords.filter(r => {
      const matchSearch = !search || r.employeeName.toLowerCase().includes(q);
      const matchDept = deptFilter === "All Departments" || r.department === deptFilter;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [search, deptFilter, statusFilter, todayRecords, attendanceRecords]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monday, 19 May 2026 · Real-time tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm">
            <Download className="h-3.5 w-3.5" />Export
          </Button>
          <Button size="sm" className="h-9 gap-1.5 text-sm">
            <CalendarDays className="h-4 w-4" />Mark Attendance
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Employees", value: attendanceSummary?.totalEmployees ?? todayRecords.length,                                        sub: "Enrolled",      icon: Users,      color: "text-primary bg-primary/10" },
          { label: "Present Today",   value: attendanceSummary?.presentToday   ?? todayRecords.filter(r => r.status === "present").length,  sub: "On time",       icon: UserCheck,  color: "text-success bg-success/10" },
          { label: "Late Today",      value: attendanceSummary?.lateToday      ?? todayRecords.filter(r => r.status === "late").length,     sub: "After 9:00 AM", icon: Clock,      color: "text-warning bg-warning/10" },
          { label: "Absent Today",    value: attendanceSummary?.absentToday    ?? todayRecords.filter(r => r.status === "absent").length,   sub: "No check-in",   icon: Users,      color: "text-destructive bg-destructive/10" },
          { label: "On Leave",        value: attendanceSummary?.onLeaveToday   ?? todayRecords.filter(r => r.status === "on_leave").length, sub: "Approved leave", icon: Plane,     color: "text-info bg-info/10" },
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
                  <tr><td colSpan={6} className="text-center py-16 text-muted-foreground text-sm">No records found.</td></tr>
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
    </div>
  );
}

