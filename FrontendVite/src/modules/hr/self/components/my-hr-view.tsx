import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  CalendarOff, Clock, FileText, LogIn, LogOut, Plus, AlertCircle, CheckCircle2, Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Pager } from "@/components/ui/pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import {
  useMyProfile, useMyLeaves, useMyLeaveBalances, useMyAttendance, useMyAttendanceToday,
  useMyPayslips, useApplyForLeave, useCancelMyLeave, useCheckIn, useCheckOut,
} from "@/hooks/hr/use-self";
import type { EmployeePayslipDto } from "@/lib/hr/hr.api";
import { exportPayslipPdf } from "./payslip-pdf";

type Tab = "overview" | "leave" | "attendance" | "payslips";

const TODAY = () => new Date().toISOString().split("T")[0];

// These three lists grow for as long as the person is employed, so none of them is fetched whole.
const LEAVE_PAGE_SIZE      = 25;
const ATTENDANCE_PAGE_SIZE = 31;
const PAYSLIP_PAGE_SIZE    = 24;

const LEAVE_STATUS: Record<string, string> = {
  approved:  "text-success bg-success/10",
  pending:   "text-warning bg-warning/10",
  rejected:  "text-destructive bg-destructive/10",
  cancelled: "text-muted-foreground bg-muted",
};

/**
 * Employee self-service — everything the signed-in person can see and do about themselves.
 *
 * Holds no employee id: every hook talks to /api/hr/me, which resolves the subject from the token.
 */
export function MyHrView() {
  const { t } = useTranslation("hr");
  const currency = useCurrency();
  const [tab, setTab] = React.useState<Tab>("overview");

  const { data: profile, isLoading, error } = useMyProfile();

  // A login with no employee record is a normal state (an external accountant, the tenant owner),
  // so it gets an explanation and not an error page.
  if (!isLoading && !profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("self.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("self.subtitle")}</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">{t("self.notLinked")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as Error | null)?.message ?? t("self.notLinkedHint")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("self.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profile ? `${profile.fullName} · ${profile.employeeNumber}` : t("self.subtitle")}
          </p>
        </div>
        <CheckInOutButton />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["overview", "leave", "attendance", "payslips"] as const).map(x => (
          <button key={x} onClick={() => setTab(x)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === x ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}>
            {t(`self.tab.${x}`)}
          </button>
        ))}
      </div>

      {tab === "overview"   && <OverviewTab currency={currency} />}
      {tab === "leave"      && <LeaveTab />}
      {tab === "attendance" && <AttendanceTab />}
      {tab === "payslips"   && <PayslipsTab currency={currency} />}
    </div>
  );
}

function CheckInOutButton() {
  const { t } = useTranslation("hr");
  const { data: today } = useMyAttendanceToday();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  if (!today) return null;

  if (!today.checkIn) {
    return (
      <div className="flex items-center gap-3">
        {/* Stated before arriving, not only after: knowing the deadline is what lets someone
            avoid being late, and it costs nothing to show. */}
        {today.scheduleStart && (
          <span className="text-xs text-muted-foreground">
            {t("self.officeHours", { start: today.scheduleStart, end: today.scheduleEnd })}
          </span>
        )}
        <Button className="h-9 gap-1.5" disabled={checkIn.isPending} onClick={() => checkIn.mutate()}>
          <LogIn className="h-4 w-4" />{t("self.checkIn")}
        </Button>
      </div>
    );
  }

  if (!today.checkOut) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{t("self.checkedInAt", { time: today.checkIn })}</span>
        <LateChip minutes={today.lateMinutes} />
        <Button variant="outline" className="h-9 gap-1.5" disabled={checkOut.isPending} onClick={() => checkOut.mutate()}>
          <LogOut className="h-4 w-4" />{t("self.checkOut")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {t("self.doneForToday", { inTime: today.checkIn, outTime: today.checkOut })}
      </span>
      <LateChip minutes={today.lateMinutes} />
    </div>
  );
}

/**
 * The verdict on one arrival: on time, or how late.
 *
 * Renders nothing when the value is null — that means nothing was judged (no office hours set, or
 * an unreadable time), and "on time" would be a claim the data does not support.
 */
function LateChip({ minutes }: { minutes?: number | null }) {
  const { t } = useTranslation("hr");
  if (minutes == null) return null;

  return minutes > 0 ? (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning shrink-0 whitespace-nowrap">
      {t("self.lateBy", { minutes })}
    </span>
  ) : (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success shrink-0">
      {t("self.onTime")}
    </span>
  );
}

function OverviewTab({ currency }: { currency: string }) {
  const { t } = useTranslation("hr");
  const { data: p } = useMyProfile();
  const { data: balances } = useMyLeaveBalances();
  if (!p) return null;

  const rows = [
    { label: t("self.field.employeeNumber"), value: p.employeeNumber },
    { label: t("self.field.jobTitle"),       value: p.jobTitle || "—" },
    { label: t("self.field.department"),     value: p.departmentName || "—" },
    { label: t("self.field.employmentType"), value: p.employmentType },
    { label: t("self.field.joined"),         value: formatDate(p.joiningDate, "medium") },
    { label: t("self.field.email"),          value: p.email },
    { label: t("self.field.phone"),          value: p.phone || "—" },
    { label: t("self.field.basicSalary"),    value: formatCurrency(p.basicSalary, currency) },
    { label: t("self.field.iban"),           value: p.iban || "—" },
    { label: t("self.field.visaExpiry"),     value: p.visaExpiry ? formatDate(p.visaExpiry, "medium") : "—" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="p-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("self.myDetails")}</h3>
          <div className="space-y-0">
            {rows.map(r => (
              <div key={r.label} className="flex justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                <span className="text-xs text-muted-foreground">{r.label}</span>
                <span className="text-sm font-medium text-right break-all">{r.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("self.myBalances")}</h3>
          {!balances?.length ? (
            <p className="text-xs text-muted-foreground">{t("self.noBalances")}</p>
          ) : (
            <div className="space-y-3">
              {balances.filter(b => b.entitlementDays > 0).map(b => (
                <div key={b.leaveType}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm">{t(`leaveType.${b.leaveType}`, { defaultValue: b.leaveType })}</span>
                    <span className="text-sm font-bold">
                      {b.remainingDays}
                      <span className="text-muted-foreground font-normal"> / {b.entitlementDays}</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min((b.remainingDays / b.entitlementDays) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeaveTab() {
  const { t } = useTranslation("hr");
  const [page, setPage] = React.useState(1);
  const { data: leavePage, isLoading, isFetching } = useMyLeaves({ page, pageSize: LEAVE_PAGE_SIZE });
  const leaves     = leavePage?.items ?? [];
  const leaveTotal = leavePage?.totalCount ?? 0;
  const totalPages = leavePage?.totalPages ?? 1;
  const { data: balances } = useMyLeaveBalances();
  const apply = useApplyForLeave();
  const cancel = useCancelMyLeave();

  const [open, setOpen] = React.useState(false);
  const [leaveType, setLeaveType] = React.useState("");
  const [from, setFrom] = React.useState(TODAY());
  const [to, setTo] = React.useState(TODAY());
  const [reason, setReason] = React.useState("");

  // Inclusive day count — a single-day request is one day, not zero.
  const days = React.useMemo(() => {
    const a = new Date(from).getTime(), b = new Date(to).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
    return Math.round((b - a) / 86_400_000) + 1;
  }, [from, to]);

  const types = (balances ?? []).map(b => b.leaveType);
  const valid = leaveType && days > 0;

  const submit = () => {
    if (!valid) return;
    apply.mutate(
      { leaveType, startDate: from, endDate: to, totalDays: days, reason: reason.trim() || undefined },
      { onSuccess: () => { setOpen(false); setReason(""); } },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="h-9 gap-1.5" onClick={() => setOpen(o => !o)}>
          <Plus className="h-4 w-4" />{t("self.applyLeave")}
        </Button>
      </div>

      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
          <Card>
            <CardContent className="p-5 grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("self.field.leaveType")}</label>
                <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">{t("self.select")}</option>
                  {types.map(x => <option key={x} value={x}>{t(`leaveType.${x}`, { defaultValue: x })}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("self.field.from")}</label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("self.field.to")}</label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("self.field.days")}</label>
                <div className="h-9 px-3 rounded-lg border border-border bg-muted/40 text-sm flex items-center font-medium">{days}</div>
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("self.field.reason")}</label>
                <Input value={reason} onChange={e => setReason(e.target.value)}
                  placeholder={t("self.reasonPlaceholder")} className="h-9 text-sm" />
              </div>
              <div className="flex items-end">
                <Button className="h-9 w-full" disabled={!valid || apply.isPending} onClick={submit}>
                  {apply.isPending ? t("self.submitting") : t("self.submit")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">{t("self.loading")}</p>
          ) : leaveTotal === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("self.noLeaves")}</p>
          ) : (
            <div className="divide-y divide-border">
              {leaves.map(l => (
                <div key={l.id} className="flex items-center gap-3 p-4">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CalendarOff className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t(`leaveType.${l.leaveType}`, { defaultValue: l.leaveType })}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(l.fromDate, "medium")} – {formatDate(l.toDate, "medium")} · {t("self.daysCount", { count: l.days })}
                    </p>
                  </div>
                  <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                    LEAVE_STATUS[l.status] ?? "text-muted-foreground bg-muted")}>
                    {t(`leaveStatus.${l.status}`, { defaultValue: l.status })}
                  </span>
                  {(l.status === "pending" || l.status === "approved") && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0"
                      disabled={cancel.isPending} onClick={() => cancel.mutate(l.id)}>
                      {t("self.cancel")}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {leaveTotal > 0 && (
            <div className="border-t border-border">
              <Pager page={page} totalPages={totalPages} totalCount={leaveTotal}
                pageSize={LEAVE_PAGE_SIZE} busy={isFetching} onPage={setPage} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AttendanceTab() {
  const { t } = useTranslation("hr");
  const [page, setPage] = React.useState(1);
  const { data: attPage, isLoading, isFetching } = useMyAttendance({ page, pageSize: ATTENDANCE_PAGE_SIZE });
  const rows     = attPage?.items ?? [];
  const attTotal = attPage?.totalCount ?? 0;
  const totalPages = attPage?.totalPages ?? 1;

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">{t("self.loading")}</p>
        ) : attTotal === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("self.noAttendance")}</p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-4">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{formatDate(r.date, "medium")}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.checkIn || "—"} → {r.checkOut || "—"}
                    {r.hoursWorked != null && ` · ${t("self.hours", { hours: r.hoursWorked })}`}
                  </p>
                </div>
                <LateChip minutes={r.lateMinutes} />
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
        {attTotal > 0 && (
          <div className="border-t border-border">
            <Pager page={page} totalPages={totalPages} totalCount={attTotal}
              pageSize={ATTENDANCE_PAGE_SIZE} busy={isFetching} onPage={setPage} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PayslipsTab({ currency }: { currency: string }) {
  const { t } = useTranslation("hr");
  const [page, setPage] = React.useState(1);
  const { data: slipPage, isLoading, isFetching } = useMyPayslips({ page, pageSize: PAYSLIP_PAGE_SIZE });
  const slips     = slipPage?.items ?? [];
  const slipTotal = slipPage?.totalCount ?? 0;
  const totalPages = slipPage?.totalPages ?? 1;
  // The employee's own record supplies the name, number and bank details on the document; the
  // payslip row carries only the figures.
  const { data: profile } = useMyProfile();

  const download = (s: EmployeePayslipDto) =>
    exportPayslipPdf(s, profile, currency, {
      title: t("self.payslipTitle"),
      employee: t("self.payslipEmployee"),
      employeeNumber: t("self.payslipEmployeeNumber"),
      designation: t("self.payslipDesignation"),
      department: t("self.payslipDepartment"),
      period: t("self.payslipPeriod"),
      payDate: t("self.payslipPayDate"),
      status: t("self.payslipStatus"),
      earnings: t("self.payslipGross"),
      basic: t("self.payslipBasic"),
      allowances: t("self.payslipAllowances"),
      deductions: t("self.payslipDeductions"),
      netPay: t("self.payslipNet"),
      bank: t("self.payslipBank"),
      iban: t("self.payslipIban"),
      note: t("self.payslipNote"),
    });

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">{t("self.loading")}</p>
        ) : slipTotal === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("self.noPayslips")}</p>
        ) : (
          <div className="divide-y divide-border">
            {slips.map(s => (
              <div key={s.slipId} className="flex items-center gap-3 p-4">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.period}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.runStatus === "paid"
                      ? t("self.paidOn", { date: formatDate(s.paidAt, "medium") })
                      : t("self.processedOn", { date: formatDate(s.processedAt, "medium") })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatCurrency(s.netSalary, currency)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("self.basic", { amount: formatCurrency(s.basicSalary, currency) })}
                  </p>
                </div>
                {s.runStatus === "paid"
                  ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  : <Clock className="h-4 w-4 text-warning shrink-0" />}
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0"
                  onClick={() => download(s)}>
                  <Download className="h-3.5 w-3.5" />{t("self.downloadPdf")}
                </Button>
              </div>
            ))}
          </div>
        )}
        {slipTotal > 0 && (
          <div className="border-t border-border">
            <Pager page={page} totalPages={totalPages} totalCount={slipTotal}
              pageSize={PAYSLIP_PAGE_SIZE} busy={isFetching} onPage={setPage} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
