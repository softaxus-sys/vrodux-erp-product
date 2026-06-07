"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Search, Plus, Calendar, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, X, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { useAttendance, useCreateAttendance } from "@/hooks/hr/use-attendance";
import { useEmployeesSimple } from "@/hooks/hr/use-employees";
import type { AttendanceLogDto } from "@/lib/hr/attendance.api";

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  present:  { label: "Present",   color: "text-success",          bg: "bg-success/10",     icon: CheckCircle2 },
  absent:   { label: "Absent",    color: "text-destructive",      bg: "bg-destructive/10", icon: XCircle },
  late:     { label: "Late",      color: "text-warning",          bg: "bg-warning/10",     icon: Clock },
  halfday:  { label: "Half Day",  color: "text-primary",          bg: "bg-primary/10",     icon: Clock },
  leave:    { label: "Leave",     color: "text-muted-foreground", bg: "bg-muted",          icon: Calendar },
};

function AddAttendanceModal({ onClose }: { onClose: () => void }) {
  const { data: employees = [] } = useEmployeesSimple();
  const createAttendance = useCreateAttendance();

  const today = new Date().toISOString().split("T")[0];
  const [employeeId, setEmployeeId] = React.useState("");
  const [date, setDate]             = React.useState(today);
  const [checkIn, setCheckIn]       = React.useState("09:00");
  const [checkOut, setCheckOut]     = React.useState("18:00");
  const [status, setStatus]         = React.useState("present");
  const [notes, setNotes]           = React.useState("");

  const workingHours = React.useMemo(() => {
    if (!checkIn || !checkOut) return null;
    const [ih, im] = checkIn.split(":").map(Number);
    const [oh, om] = checkOut.split(":").map(Number);
    const diff = (oh * 60 + om) - (ih * 60 + im);
    return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : null;
  }, [checkIn, checkOut]);

  const emp = employees.find(e => e.id === employeeId);
  const isValid = !!employeeId && !!date && !!status;

  const handleSubmit = async () => {
    if (!isValid || !emp) return;
    await createAttendance.mutateAsync({
      employeeId,
      employeeName: emp.fullName,
      date,
      checkIn:      checkIn  || null,
      checkOut:     checkOut || null,
      workingHours: workingHours,
      status,
      notes: notes || null,
    });
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="font-bold text-base">Record Attendance</p>
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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date *</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status *</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm">
              {Object.entries(STATUS_STYLES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          {(status === "present" || status === "late" || status === "halfday") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check In</label>
                <Input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check Out</label>
                <Input type="time" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="h-9" />
              </div>
            </div>
          )}
          {workingHours !== null && (
            <p className="text-xs text-muted-foreground">Working hours: <span className="font-semibold text-foreground">{workingHours}h</span></p>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any additional notes…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || createAttendance.isPending}>
            {createAttendance.isPending ? "Saving…" : "Record"}
          </Button>
        </div>
      </motion.div>
    </>
  );
}

export function AttendanceView() {
  const today = new Date().toISOString().split("T")[0];
  const [dateFilter, setDateFilter]   = React.useState(today);
  const [statusFilter, setStatus]     = React.useState<string>("all");
  const [page, setPage]               = React.useState(1);
  const [showAdd, setShowAdd]         = React.useState(false);

  const { data, isLoading } = useAttendance({
    page,
    pageSize: 30,
    date:     dateFilter || undefined,
    status:   statusFilter !== "all" ? statusFilter : undefined,
  });

  const logs       = data?.items      ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const presentCount = logs.filter(l => l.status === "present").length;
  const absentCount  = logs.filter(l => l.status === "absent").length;
  const lateCount    = logs.filter(l => l.status === "late").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Track and manage daily attendance records.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Record Attendance
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Showing",  value: logs.length,  icon: Users,       color: "text-primary",     bg: "bg-primary/10" },
          { label: "Present",  value: presentCount, icon: CheckCircle2, color: "text-success",    bg: "bg-success/10" },
          { label: "Absent",   value: absentCount,  icon: XCircle,     color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Late",     value: lateCount,    icon: Clock,       color: "text-warning",     bg: "bg-warning/10" },
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
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1); }}
            className="h-9 w-40" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", ...Object.keys(STATUS_STYLES)] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {s === "all" ? "All" : STATUS_STYLES[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Employee</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Date</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Check In</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Check Out</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Hours</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No attendance records found.</td></tr>
            ) : logs.map((log: AttendanceLogDto) => {
              const sc = STATUS_STYLES[log.status] ?? { label: log.status, color: "text-foreground", bg: "bg-muted", icon: Clock };
              return (
                <tr key={log.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(log.employeeName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{log.employeeName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{log.date}</td>
                  <td className="px-4 py-3 text-sm text-center hidden sm:table-cell">{log.checkIn ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-center hidden sm:table-cell">{log.checkOut ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-center hidden lg:table-cell">
                    {log.workingHours != null ? `${log.workingHours}h` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <sc.icon className="h-3 w-3" />{sc.label}
                    </span>
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

      {showAdd && <AddAttendanceModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
