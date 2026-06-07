"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LEAVE_TYPES = [
  { value: "annual",    label: "🌴 Annual Leave" },
  { value: "sick",      label: "🏥 Sick Leave" },
  { value: "emergency", label: "🚨 Emergency Leave" },
  { value: "maternity", label: "👶 Maternity Leave" },
  { value: "paternity", label: "👶 Paternity Leave" },
  { value: "unpaid",    label: "📋 Unpaid Leave" },
  { value: "hajj",      label: "🕌 Hajj Leave" },
  { value: "study",     label: "📚 Study Leave" },
  { value: "other",     label: "📎 Other" },
];

interface AddLeaveFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddLeaveForm({ open, onClose }: AddLeaveFormProps) {
  const [leaveType, setLeaveType]     = React.useState("annual");
  const [startDate, setStartDate]     = React.useState("");
  const [endDate, setEndDate]         = React.useState("");
  const [halfDay, setHalfDay]         = React.useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = React.useState<"morning" | "afternoon">("morning");
  const [reason, setReason]           = React.useState("");
  const [contactDuringLeave, setContactDuringLeave] = React.useState("");
  const [handoverTo, setHandoverTo]   = React.useState("");
  const [notes, setNotes]             = React.useState("");

  const daysCount = React.useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end   = new Date(endDate);
    const diff  = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return halfDay ? 0.5 : Math.max(0, diff);
  }, [startDate, endDate, halfDay]);

  const isValid = leaveType && startDate && (halfDay || endDate) && reason.trim();

  const reset = () => {
    setLeaveType("annual"); setStartDate(""); setEndDate("");
    setHalfDay(false); setHalfDayPeriod("morning");
    setReason(""); setContactDuringLeave(""); setHandoverTo(""); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Leave Request</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Submit a leave application for approval</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Leave Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Leave Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {LEAVE_TYPES.map(t => (
                    <button key={t.value} onClick={() => setLeaveType(t.value)}
                      className={`text-left px-3 py-2 rounded-lg border-2 text-xs transition-all ${
                        leaveType === t.value
                          ? "border-primary bg-primary/5 text-primary font-semibold"
                          : "border-border text-foreground hover:border-primary/30"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Half day toggle */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/20 rounded-xl border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Half Day</p>
                  <p className="text-xs text-muted-foreground">Request only half a working day</p>
                </div>
                <button
                  onClick={() => setHalfDay(v => !v)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors ${halfDay ? "bg-primary" : "bg-muted"}`}
                  style={{ minWidth: "40px", height: "22px" }}
                >
                  <span className={`absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${halfDay ? "translate-x-[18px]" : ""}`}
                    style={{ width: "18px", height: "18px" }} />
                </button>
              </div>

              {halfDay && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Half Day Period</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["morning", "afternoon"] as const).map(p => (
                      <button key={p} onClick={() => setHalfDayPeriod(p)}
                        className={`py-2 rounded-lg border-2 text-xs capitalize transition-all ${
                          halfDayPeriod === p ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border text-foreground hover:border-primary/30"
                        }`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {halfDay ? "Date *" : "From Date *"}
                  </label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
                </div>
                {!halfDay && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To Date *</label>
                    <Input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                )}
              </div>

              {/* Days summary */}
              {daysCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    {daysCount} {daysCount === 1 ? "day" : "days"} requested
                  </span>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason *</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Briefly describe the reason for your leave…" rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {/* Handover */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Handover To</label>
                  <Input value={handoverTo} onChange={e => setHandoverTo(e.target.value)} placeholder="Colleague name…" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact During Leave</label>
                  <Input value={contactDuringLeave} onChange={e => setContactDuringLeave(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                </div>
              </div>

              {/* Info banner */}
              <div className="flex items-start gap-2 px-3 py-2.5 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Leave requests require manager approval. You will be notified by email once processed.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Submit Request</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
