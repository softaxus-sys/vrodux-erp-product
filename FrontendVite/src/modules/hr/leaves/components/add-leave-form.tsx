import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateLeave, useEmployees } from "@/hooks/hr/use-hr";

const LEAVE_TYPES = [
  { value: "annual",    emoji: "🌴" },
  { value: "sick",      emoji: "🏥" },
  { value: "emergency", emoji: "🚨" },
  { value: "maternity", emoji: "👶" },
  { value: "paternity", emoji: "👶" },
  { value: "unpaid",    emoji: "📋" },
  { value: "hajj",      emoji: "🕌" },
  { value: "study",     emoji: "📚" },
  { value: "other",     emoji: "📎" },
];

interface AddLeaveFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddLeaveForm({ open, onClose, onSuccess }: AddLeaveFormProps) {
  const { t } = useTranslation("hr");
  const createLeave = useCreateLeave();
  const { data: employees = [] } = useEmployees();

  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState("");
  const [leaveType, setLeaveType]     = React.useState("annual");
  const [startDate, setStartDate]     = React.useState("");
  const [endDate, setEndDate]         = React.useState("");
  const [halfDay, setHalfDay]         = React.useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = React.useState<"morning" | "afternoon">("morning");
  const [reason, setReason]           = React.useState("");
  const [contactDuringLeave, setContactDuringLeave] = React.useState("");
  const [handoverTo, setHandoverTo]   = React.useState("");
  const [notes, setNotes]             = React.useState("");
  const [apiError, setApiError]       = React.useState<string | null>(null);

  const daysCount = React.useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end   = new Date(endDate);
    const diff  = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return halfDay ? 0.5 : Math.max(0, diff);
  }, [startDate, endDate, halfDay]);

  const isValid = selectedEmployeeId && leaveType && startDate && (halfDay || endDate) && reason.trim();

  const selectedEmployee = React.useMemo(
    () => employees.find(e => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId]
  );

  const reset = () => {
    setSelectedEmployeeId(""); setLeaveType("annual"); setStartDate(""); setEndDate("");
    setHalfDay(false); setHalfDayPeriod("morning");
    setReason(""); setContactDuringLeave(""); setHandoverTo(""); setNotes("");
    setApiError(null);
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSubmit = () => {
    if (!isValid || !selectedEmployee) return;
    setApiError(null);
    const effectiveEndDate = halfDay ? startDate : endDate;
    const totalDays = halfDay ? 0.5 : daysCount;
    createLeave.mutate(
      {
        employeeId:   selectedEmployee.id,
        employeeName: selectedEmployee.fullName,
        leaveType,
        startDate,
        endDate:      effectiveEndDate,
        totalDays,
        reason:       reason.trim() || undefined,
      },
      {
        onSuccess: () => { reset(); onSuccess?.(); onClose(); },
        onError:   (err: Error) => setApiError(err.message),
      }
    );
  };

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
                <h2 className="text-base font-bold text-foreground">{t("leaves.form.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("leaves.form.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* API Error */}
              {apiError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {apiError}
                </div>
              )}

              {/* Employee Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("leaves.form.employee")}</label>
                <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">{t("leaves.form.selectEmployee")}</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </select>
              </div>

              {/* Leave Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("leaves.form.leaveType")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {LEAVE_TYPES.map(lt => (
                    <button key={lt.value} onClick={() => setLeaveType(lt.value)}
                      className={`text-left px-3 py-2 rounded-lg border-2 text-xs transition-all ${
                        leaveType === lt.value
                          ? "border-primary bg-primary/5 text-primary font-semibold"
                          : "border-border text-foreground hover:border-primary/30"
                      }`}>
                      {lt.emoji} {t(`leaveType.${lt.value}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Half day toggle */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/20 rounded-xl border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("leaves.form.halfDay")}</p>
                  <p className="text-xs text-muted-foreground">{t("leaves.form.halfDayHint")}</p>
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
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("leaves.form.halfDayPeriod")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["morning", "afternoon"] as const).map(p => (
                      <button key={p} onClick={() => setHalfDayPeriod(p)}
                        className={`py-2 rounded-lg border-2 text-xs transition-all ${
                          halfDayPeriod === p ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border text-foreground hover:border-primary/30"
                        }`}>
                        {t(`leaves.form.${p}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {halfDay ? t("leaves.form.date") : t("leaves.form.fromDate")}
                  </label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
                </div>
                {!halfDay && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("leaves.form.toDate")}</label>
                    <Input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                )}
              </div>

              {/* Days summary */}
              {daysCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    {t("leaves.form.daysRequested", { count: daysCount })}
                  </span>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("leaves.form.reason")}</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder={t("leaves.form.reasonPlaceholder")} rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {/* Handover */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("leaves.form.handoverTo")}</label>
                  <Input value={handoverTo} onChange={e => setHandoverTo(e.target.value)} placeholder={t("leaves.form.handoverToPlaceholder")} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("leaves.form.contactDuringLeave")}</label>
                  <Input value={contactDuringLeave} onChange={e => setContactDuringLeave(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                </div>
              </div>

              {/* Info banner */}
              <div className="flex items-start gap-2 px-3 py-2.5 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {t("leaves.form.infoBanner")}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={createLeave.isPending}>{t("leaves.form.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={!isValid || createLeave.isPending}>
                {createLeave.isPending ? t("leaves.form.submitting") : t("leaves.form.submitRequest")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

