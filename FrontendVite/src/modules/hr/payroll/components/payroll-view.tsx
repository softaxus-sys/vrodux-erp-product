import * as React from "react";
import { useTranslation, Trans } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, FileText, CheckCircle2, Clock, DollarSign,
  TrendingUp, Users, X, ChevronRight, Send, Printer,
  Building2, CreditCard, Calendar, BarChart3, AlertCircle,
  ArrowLeft, Mail, MailCheck, Search, Trash2, Pencil, Save, RotateCcw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { hrApi } from "@/lib/hr/hr.api";
import type { PayrollRunDto as PayrollRun } from "@/lib/hr/hr.api";
import { usePayrollRuns, usePayrollSummary, usePayrollRunById, useProcessPayrollRun, usePayPayrollRun, useSendPayslipEmail, useDeletePayrollRun, useRejectPayrollRun, useReopenPayrollRun, useUpdatePayrollSlip } from "@/hooks/hr/use-hr";
import { downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { AddPayrollForm } from "./add-payroll-form";
import { Can } from "@/components/auth/can";

const STATUS_CONFIG: Record<string, { key: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:      { key: "draft",      color: "text-muted-foreground", bg: "bg-muted",             icon: FileText },
  processing: { key: "processing", color: "text-info",             bg: "bg-info/10",           icon: Clock },
  processed:  { key: "processed",  color: "text-primary",          bg: "bg-primary/10",        icon: CheckCircle2 },
  approved:   { key: "approved",   color: "text-primary",          bg: "bg-primary/10",        icon: CheckCircle2 },
  paid:       { key: "paid",       color: "text-success",          bg: "bg-success/10",        icon: CheckCircle2 },
  failed:     { key: "failed",     color: "text-destructive",      bg: "bg-destructive/10",    icon: X },
  rejected:   { key: "rejected",   color: "text-destructive",      bg: "bg-destructive/10",    icon: X },
};
const STATUS_FALLBACK = { key: "unknown", color: "text-muted-foreground", bg: "bg-muted", icon: FileText };

// Normalise raw backend slip to a consistent internal shape
function normaliseSlip(s: any, run: { period: string; paidAt?: string | null; status: string }) {
  return {
    id:             s.id as string,
    employeeId:     s.employeeId as string,
    employeeName:   s.employeeName as string,
    employeeNumber: (s.employeeNumber ?? s.employeeId ?? "—") as string,
    department:     (s.departmentName ?? s.department ?? "—") as string,
    designation:    (s.jobTitle ?? s.designation ?? "—") as string,
    basicSalary:    (s.basicSalary ?? 0) as number,
    allowances:     (typeof s.allowances === "number" ? s.allowances : 0) as number,
    deductions:     (typeof s.deductions === "number" ? s.deductions : 0) as number,
    grossSalary:    (s.grossSalary ?? (s.basicSalary ?? 0) + (typeof s.allowances === "number" ? s.allowances : 0)) as number,
    netSalary:      (s.netSalary ?? 0) as number,
    iban:           (s.iban ?? "") as string,
    bank:           (s.bank ?? "") as string,
    emailSentAt:    s.emailSentAt as string | null | undefined,
    emailSentTo:    s.emailSentTo as string | null | undefined,
    payPeriod:      run.period,
    paidAt:         run.paidAt,
    runStatus:      run.status,
  };
}
type NormalisedSlip = ReturnType<typeof normaliseSlip>;

// ── Payslip detail view (rendered inside the run drawer panel) ────────────────
function PayslipDetailView({
  slip, runId, onBack,
}: { slip: NormalisedSlip; runId: string; onBack: () => void }) {
  const { t } = useTranslation("hr");
  const currency = useCurrency();
  const sendEmail = useSendPayslipEmail();
  const [sentTo,   setSentTo]   = React.useState<string | null>(slip.emailSentTo ?? null);
  const [sentAt,   setSentAt]   = React.useState<string | null>(slip.emailSentAt ?? null);

  const handleDownload = () => {
    exportPdf({
      title:    t("payroll.payslip.pdfTitle", { name: slip.employeeName }),
      subtitle: t("payroll.payslip.pdfSubtitle", { period: slip.payPeriod }),
      columns:  [t("payroll.payslip.earnings"), `${currency}`],
      rows: [
        [t("payroll.payslip.basicSalary"),  slip.basicSalary.toFixed(2)],
        [t("payroll.payslip.allowances"),   slip.allowances.toFixed(2)],
        [t("payroll.payslip.grossSalary"),  slip.grossSalary.toFixed(2)],
        [t("payroll.payslip.deductions"),   `- ${slip.deductions.toFixed(2)}`],
        [t("payroll.payslip.netSalary"),    slip.netSalary.toFixed(2)],
      ],
    });
  };

  const handleSendEmail = () => {
    sendEmail.mutate({ runId, slipId: slip.id }, {
      onSuccess: (data) => { setSentTo(data.sentTo); setSentAt(data.sentAt); },
    });
  };

  return (
    <motion.div
      key="payslip-detail"
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="absolute inset-0 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{slip.employeeName}</p>
          <p className="text-[11px] text-muted-foreground">{slip.payPeriod} · {slip.designation || slip.department}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleDownload}>
            <Printer className="h-3.5 w-3.5" />{t("payroll.payslip.downloadPdf")}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Employee card */}
        <div className="flex items-center gap-4 p-4 bg-muted/40 rounded-2xl">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
              {getInitials(slip.employeeName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base">{slip.employeeName}</p>
            <p className="text-sm text-muted-foreground">{slip.designation || "—"}</p>
            <p className="text-xs text-muted-foreground">{slip.department}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("payroll.payslip.netSalary")}</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(slip.netSalary, currency)}</p>
          </div>
        </div>

        {/* Earnings */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">{t("payroll.payslip.earnings")}</p>
          <div className="bg-muted/30 rounded-xl divide-y divide-border/50">
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-muted-foreground">{t("payroll.payslip.basicSalary")}</span>
              <span className="font-semibold">{formatCurrency(slip.basicSalary, currency)}</span>
            </div>
            {slip.allowances > 0 && (
              <div className="flex justify-between items-center px-4 py-3 text-sm">
                <span className="text-muted-foreground">{t("payroll.payslip.allowances")}</span>
                <span className="text-success">+ {formatCurrency(slip.allowances, currency)}</span>
              </div>
            )}
            <div className="flex justify-between items-center px-4 py-3 text-sm font-bold bg-muted/20 rounded-b-xl">
              <span>{t("payroll.payslip.grossSalary")}</span>
              <span className="text-primary">{formatCurrency(slip.grossSalary, currency)}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        {slip.deductions > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">{t("payroll.payslip.deductions")}</p>
            <div className="bg-muted/30 rounded-xl divide-y divide-border/50">
              <div className="flex justify-between items-center px-4 py-3 text-sm">
                <span className="text-muted-foreground">{t("payroll.payslip.totalDeductions")}</span>
                <span className="text-destructive font-semibold">- {formatCurrency(slip.deductions, currency)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Net summary */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">{t("payroll.payslip.netSalary")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("payroll.payslip.amountToCredit")}</p>
          </div>
          <p className="text-2xl font-bold text-primary">{formatCurrency(slip.netSalary, currency)}</p>
        </div>

        {/* Payment info */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">{t("payroll.payslip.paymentDetails")}</p>
          <div className="bg-muted/30 rounded-xl divide-y divide-border/50">
            {[
              { icon: Building2, label: t("payroll.payslip.bank"),      value: slip.bank || "—" },
              { icon: CreditCard,label: t("payroll.payslip.iban"),      value: slip.iban || "—" },
              { icon: Calendar,  label: t("payroll.payslip.payPeriod"), value: slip.payPeriod },
              { icon: Calendar,  label: t("payroll.payslip.paidOn"),    value: slip.paidAt ? formatDate(slip.paidAt, "medium") : t("payroll.payslip.pending") },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 px-4 py-3">
                <row.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground flex-1">{row.label}</span>
                <span className="text-xs font-mono text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Email sent banner */}
        {(sentTo || sentAt) && (
          <div className="flex items-center gap-3 p-3 bg-success/10 border border-success/20 rounded-xl">
            <MailCheck className="h-4 w-4 text-success shrink-0" />
            <div className="text-xs text-success">
              <span className="font-semibold">{t("payroll.payslip.payslipSent")}</span> {sentTo}
              {sentAt && <span className="text-success/70"> · {formatDate(sentAt, "medium")}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-border px-5 py-4 flex gap-2 shrink-0">
        <Button variant="outline" size="sm" className="flex-1 h-9 gap-1.5" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />{t("payroll.payslip.downloadPdf")}
        </Button>
        <Button
          size="sm"
          className={cn("flex-1 h-9 gap-1.5", sentTo ? "bg-success/10 text-success border border-success/30 hover:bg-success/20" : "")}
          variant={sentTo ? "outline" : "default"}
          disabled={sendEmail.isPending}
          onClick={handleSendEmail}
        >
          {sendEmail.isPending ? (
            <><Clock className="h-3.5 w-3.5 animate-spin" />{t("payroll.payslip.sending")}</>
          ) : sentTo ? (
            <><MailCheck className="h-3.5 w-3.5" />{t("payroll.payslip.resendEmail")}</>
          ) : (
            <><Mail className="h-3.5 w-3.5" />{t("payroll.payslip.sendToEmployee")}</>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

// ── Payroll run drawer (single panel, push-navigation for payslip detail) ─────
function PayrollRunDrawer({ run, open, onClose }: { run: PayrollRun | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation("hr");
  const currency = useCurrency();
  const [selectedSlip,  setSelectedSlip]  = React.useState<NormalisedSlip | null>(null);
  const [search,        setSearch]        = React.useState("");
  const [showReject,    setShowReject]    = React.useState(false);
  const [rejectReason,  setRejectReason]  = React.useState("");
  const [editMode,      setEditMode]      = React.useState(false);
  // localEdits: slipId → { allowances, deductions }
  const [localEdits, setLocalEdits] = React.useState<Record<string, { allowances: number; deductions: number }>>({});

  const processRun   = useProcessPayrollRun();
  const payRun       = usePayPayrollRun();
  const rejectRun    = useRejectPayrollRun();
  const reopenRun    = useReopenPayrollRun();
  const updateSlip   = useUpdatePayrollSlip();
  const deleteRun    = useDeletePayrollRun();

  const { data: runDetail, isLoading: detailLoading } = usePayrollRunById(open && run ? run.id : null);

  React.useEffect(() => {
    if (!open) {
      setSelectedSlip(null); setSearch("");
      setShowReject(false);  setRejectReason("");
      setEditMode(false);    setLocalEdits({});
    }
  }, [open]);

  if (!run) return null;

  const activeRun  = runDetail ?? run;
  const sc         = STATUS_CONFIG[activeRun.status] ?? STATUS_FALLBACK;
  const rawSlips: any[] = (runDetail as any)?.slips ?? [];
  const payslips   = rawSlips.map(s => normaliseSlip(s, activeRun));
  const grossTotal = activeRun.totalBasicSalary + activeRun.totalAllowances;

  const filtered = payslips.filter(p =>
    !search || p.employeeName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => { if (!selectedSlip) onClose(); else setSelectedSlip(null); }}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-2xl bg-background border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* ── List view ── */}
            <div className="absolute inset-0 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <div>
                  <p className="font-bold text-lg">{t("payroll.runTitle", { period: activeRun.period })}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <sc.icon className="h-3 w-3" />{t(`payrollStatus.${sc.key}`)}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("payroll.employeesCount", { count: activeRun.slipCount })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Use runDetail?.status (freshly fetched) not the cached list status */}
                  {detailLoading && (
                    <Clock className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!detailLoading && activeRun.status === "draft" && !showReject && (
                    <>
                      <Button size="sm" variant="outline"
                        className="h-8 text-xs gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                        onClick={() => setShowReject(true)}>
                        <Trash2 className="h-3.5 w-3.5" />{t("payroll.reject")}
                      </Button>
                      <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90"
                        disabled={processRun.isPending}
                        onClick={() => processRun.mutate(activeRun.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {processRun.isPending ? t("payroll.processing") : t("payroll.acceptProcess")}
                      </Button>
                    </>
                  )}
                  {!detailLoading && activeRun.status === "processed" && (
                    <Button size="sm" className="h-8 text-xs gap-1.5 bg-success hover:bg-success/90"
                      disabled={payRun.isPending}
                      onClick={() => payRun.mutate(activeRun.id, { onSuccess: onClose })}>
                      <DollarSign className="h-3.5 w-3.5" />
                      {payRun.isPending ? t("payroll.markingPaid") : t("payroll.markAsPaid")}
                    </Button>
                  )}
                  {!detailLoading && activeRun.status === "rejected" && !editMode && (
                    <Button size="sm" className="h-8 text-xs gap-1.5"
                      onClick={() => { setEditMode(true); setLocalEdits({}); }}>
                      <Pencil className="h-3.5 w-3.5" />{t("payroll.editResubmit")}
                    </Button>
                  )}
                  {editMode && (
                    <>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                        onClick={() => { setEditMode(false); setLocalEdits({}); }}>
                        {t("payroll.cancel")}
                      </Button>
                      <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90"
                        disabled={reopenRun.isPending}
                        onClick={async () => {
                          // save each edited slip sequentially then reopen
                          const entries = Object.entries(localEdits);
                          try {
                            await Promise.all(entries.map(([slipId, vals]) =>
                              hrApi.updatePayrollSlip(activeRun.id, slipId, vals)
                            ));
                          } catch { /* individual errors toasted by hook */ }
                          reopenRun.mutate(activeRun.id, {
                            onSuccess: () => { setEditMode(false); setLocalEdits({}); }
                          });
                        }}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        {reopenRun.isPending ? t("payroll.resubmitting") : t("payroll.resubmitAsDraft")}
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3 px-6 pt-4 pb-3 shrink-0">
                {[
                  { label: t("payroll.grossPayroll"),   value: formatCurrency(grossTotal, currency),                    color: "text-foreground" },
                  { label: t("payroll.deductionsLabel"), value: formatCurrency(activeRun.totalDeductions, currency),     color: "text-destructive" },
                  { label: t("payroll.netPayrollLabel"), value: formatCurrency(activeRun.totalNetSalary, currency),      color: "text-primary" },
                ].map(s => (
                  <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={cn("font-bold text-base mt-0.5", s.color)}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Reject reason panel — shown when admin clicks Reject */}
              <AnimatePresence>
                {showReject && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mx-6 mb-3 overflow-hidden shrink-0"
                  >
                    <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
                      <p className="text-sm font-semibold text-destructive mb-0.5">{t("payroll.rejectTitle")}</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        <Trans t={t} i18nKey="payroll.rejectDescription" components={{ 1: <span className="font-medium text-destructive" /> }} />
                      </p>
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder={t("payroll.rejectPlaceholder")}
                        rows={3}
                        className="w-full rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-destructive/50 mb-3"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8 text-xs flex-1"
                          onClick={() => { setShowReject(false); setRejectReason(""); }}>
                          {t("payroll.cancel")}
                        </Button>
                        <Button size="sm"
                          className="h-8 text-xs flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
                          disabled={rejectRun.isPending}
                          onClick={() => rejectRun.mutate(
                            { id: activeRun.id, reason: rejectReason.trim() || undefined },
                            { onSuccess: () => { setShowReject(false); setRejectReason(""); onClose(); } }
                          )}>
                          <Trash2 className="h-3.5 w-3.5" />
                          {rejectRun.isPending ? t("payroll.rejecting") : t("payroll.confirmRejection")}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Rejection info banner — shown when run is already rejected */}
              {activeRun.status === "rejected" && (
                <div className="mx-6 mb-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl shrink-0">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-destructive">
                        {t("payroll.rejectedBy", { by: activeRun.rejectedByName ? t("payroll.byName", { name: activeRun.rejectedByName }) : "" })}
                        {activeRun.rejectedAt ? <span className="font-normal text-muted-foreground text-xs ml-2">{formatDate(activeRun.rejectedAt, "medium")}</span> : ""}
                      </p>
                      {activeRun.rejectionReason && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">"{activeRun.rejectionReason}"</p>
                      )}
                      {activeRun.createdByName && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {t("payroll.originallyCreatedBy", { name: activeRun.createdByName })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Approval trail */}
              {(activeRun.processedAt || activeRun.paidAt || activeRun.notes) && (
                <div className="px-6 pb-3 flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  {activeRun.processedAt && <span>{t("payroll.processedOn", { date: formatDate(activeRun.processedAt, "medium") })}</span>}
                  {activeRun.paidAt && <span>{t("payroll.paidOnLabel", { date: formatDate(activeRun.paidAt, "medium") })}</span>}
                  {activeRun.notes && <span className="truncate italic">{activeRun.notes}</span>}
                </div>
              )}

              {/* Search */}
              <div className="px-6 pb-3 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={t("payroll.searchPlaceholder")}
                    className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Payslip list */}
              <div className="flex-1 overflow-y-auto">
                {detailLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                    <Clock className="h-6 w-6 opacity-40 animate-spin" />
                    <p className="text-sm">{t("payroll.loadingPayslips")}</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                    <FileText className="h-8 w-8 opacity-30" />
                    <p className="text-sm">{search ? t("payroll.noMatch") : t("payroll.noPayslips")}</p>
                  </div>
                ) : editMode ? (
                  // ── Edit mode: inline editable slips ──
                  <table className="w-full text-sm">
                    <thead className="border-y border-border bg-amber-500/10 sticky top-0">
                      <tr>
                        {[
                          ["employee", t("payroll.editTable.employee")], ["basic", t("payroll.editTable.basic")],
                          ["allowances", t("payroll.editTable.allowances")], ["deductions", t("payroll.editTable.deductions")],
                          ["net", t("payroll.editTable.net")],
                        ].map(([k, h]) => (
                          <th key={k} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((ps, i) => {
                        const edit = localEdits[ps.id];
                        const allowances = edit?.allowances ?? ps.allowances;
                        const deductions = edit?.deductions ?? ps.deductions;
                        const net = ps.basicSalary + allowances - deductions;
                        const changed = edit !== undefined;
                        return (
                          <motion.tr key={ps.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className={cn("border-b border-border/40 last:border-0", changed && "bg-amber-500/5")}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7 shrink-0">
                                  <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{getInitials(ps.employeeName)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">{ps.employeeName}</p>
                                  <p className="text-[10px] text-muted-foreground">{ps.designation || ps.department}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{formatCurrency(ps.basicSalary, currency)}</td>
                            <td className="px-4 py-2">
                              <input type="number" min={0} step={0.01}
                                value={allowances}
                                onChange={e => setLocalEdits(prev => ({ ...prev, [ps.id]: { allowances: +e.target.value, deductions: prev[ps.id]?.deductions ?? ps.deductions } }))}
                                className="w-28 h-8 rounded-md border border-amber-400/50 bg-amber-500/5 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min={0} step={0.01}
                                value={deductions}
                                onChange={e => setLocalEdits(prev => ({ ...prev, [ps.id]: { allowances: prev[ps.id]?.allowances ?? ps.allowances, deductions: +e.target.value } }))}
                                className="w-28 h-8 rounded-md border border-destructive/30 bg-destructive/5 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-destructive/50"
                              />
                            </td>
                            <td className={cn("px-4 py-3 text-sm font-bold", changed ? "text-amber-500" : "text-primary")}>
                              {formatCurrency(net, currency)}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  // ── Normal view: clickable slip rows ──
                  <table className="w-full text-sm">
                    <thead className="border-y border-border bg-muted/30 sticky top-0">
                      <tr>
                        {[
                          ["employee", t("payroll.listTable.employee")], ["department", t("payroll.listTable.department")],
                          ["basic", t("payroll.listTable.basic")], ["net", t("payroll.listTable.net")],
                          ["email", t("payroll.listTable.email")], ["actions", ""],
                        ].map(([k, h]) => (
                          <th key={k} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((ps, i) => (
                        <motion.tr key={ps.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="erp-table-row cursor-pointer group"
                          onClick={() => setSelectedSlip(ps)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{getInitials(ps.employeeName)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{ps.employeeName}</p>
                                <p className="text-[10px] text-muted-foreground">{ps.designation || ps.department}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{ps.department}</td>
                          <td className="px-4 py-3 text-sm">{formatCurrency(ps.basicSalary, currency)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-primary">{formatCurrency(ps.netSalary, currency)}</td>
                          <td className="px-4 py-3">
                            {ps.emailSentAt ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                                <MailCheck className="h-3 w-3" />{t("payroll.sent")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" /></td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* ── Payslip detail view — slides over the list ── */}
            <AnimatePresence>
              {selectedSlip && (
                <PayslipDetailView
                  key={selectedSlip.id}
                  slip={selectedSlip}
                  runId={activeRun.id}
                  onBack={() => setSelectedSlip(null)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── WPS SIF file generator ────────────────────────────────────────────────────
// UAE Wage Protection System — Salary Information File (SIF) format
function generateWpsSif(run: PayrollRun): string {
  const payslips = run.payslips ?? [];
  const [year, month] = run.period.split("-");
  const period = `${year}${month}`;
  const companyName = "COMPANY";
  const totalCents = Math.round(run.totalNetSalary * 100);
  const lines: string[] = [];

  // EDR — Employer Detail Record
  lines.push(`EDR|MOB|${companyName}|${period}|${payslips.length}|${totalCents}|AED`);

  // SDR — Salary Detail Record per employee
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  const startDate = `${year}${month}01`;
  const endDate   = `${year}${month}${String(daysInMonth).padStart(2, "0")}`;
  for (const ps of payslips) {
    const netCents   = Math.round(ps.netSalary * 100);
    const basicCents = Math.round(ps.basicSalary * 100);
    const varCents   = Math.round((ps.grossSalary - ps.basicSalary) * 100);
    const iban = (ps.iban ?? "").replace(/\s/g, "");
    lines.push(`SDR|${ps.employeeNumber}|MOB|${iban}|${netCents}|${startDate}|${endDate}|${daysInMonth}|${basicCents}|${varCents}|0`);
  }

  // EOS — End of Salary record
  lines.push(`EOS|MOB|${companyName}|${period}|${payslips.length}|${totalCents}|AED`);

  return lines.join("\r\n");
}

// ── WPS Submit Modal ──────────────────────────────────────────────────────────
function WpsSubmitModal({ runId, period, open, onClose }: {
  runId: string | null; period: string; open: boolean; onClose: () => void;
}) {
  const { t } = useTranslation("hr");
  const currency = useCurrency();
  const { data: run, isLoading } = usePayrollRunById(runId);
  const [submitted, setSubmitted] = React.useState(false);

  const payslips = run?.payslips ?? [];

  const handleDownloadSif = () => {
    if (!run) return;
    const sif = generateWpsSif(run);
    downloadFile(`WPS_SIF_${run.period}.txt`, sif, "text/plain");
  };

  const handleConfirmSubmit = () => {
    if (!run) return;
    const sif = generateWpsSif(run);
    downloadFile(`WPS_SIF_${run.period}.txt`, sif, "text/plain");
    setSubmitted(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-xl bg-background border-l border-border shadow-2xl z-50 flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <p className="font-bold text-base">{t("payroll.wps.title")}</p>
                <p className="text-xs text-muted-foreground">{t("payroll.wps.subtitle", { period })}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Info banner */}
              <div className="flex items-start gap-3 p-4 bg-info/10 border border-info/20 rounded-xl">
                <AlertCircle className="h-4 w-4 text-info mt-0.5 shrink-0" />
                <div className="text-xs text-info leading-relaxed">
                  {t("payroll.wps.infoBanner")}
                </div>
              </div>

              {/* Summary */}
              {run && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: t("payroll.wps.payPeriod"),    value: run.period },
                    { label: t("payroll.wps.employees"),     value: run.slipCount },
                    { label: t("payroll.wps.totalPayroll"), value: formatCurrency(run.totalNetSalary, currency) },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                      <p className="font-bold text-sm mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* SIF preview */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("payroll.wps.sifPreview")}</h4>
                {isLoading ? (
                  <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground text-center">{t("payroll.wps.loadingData")}</div>
                ) : payslips.length === 0 ? (
                  <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground text-center">
                    {t("payroll.wps.noPayslips")}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30 border-b border-border">
                        <tr>
                          {[
                            ["empNo", t("payroll.wps.empNo")], ["name", t("payroll.wps.name")], ["iban", t("payroll.wps.iban")],
                            ["net", t("payroll.wps.netSalary")], ["status", t("payroll.wps.status")],
                          ].map(([k, h]) => (
                            <th key={k} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {payslips.map(ps => (
                          <tr key={ps.id} className="border-b border-border/40 last:border-0">
                            <td className="px-3 py-2 font-mono">{ps.employeeNumber}</td>
                            <td className="px-3 py-2">{ps.employeeName}</td>
                            <td className="px-3 py-2 font-mono text-[10px]">{ps.iban || "—"}</td>
                            <td className="px-3 py-2 font-semibold text-primary">{formatCurrency(ps.netSalary, currency)}</td>
                            <td className="px-3 py-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                                ps.iban ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                              )}>
                                {ps.iban ? t("payroll.wps.ready") : t("payroll.wps.missingIban")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Success confirmation */}
              {submitted && (
                <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/20 rounded-xl">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  <p className="text-xs text-success font-medium">{t("payroll.wps.downloaded")}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 flex gap-2">
              <Button variant="outline" size="sm" className="h-9 gap-1.5 flex-1" onClick={handleDownloadSif} disabled={isLoading || !run}>
                <Download className="h-3.5 w-3.5" />{t("payroll.wps.downloadSif")}
              </Button>
              <Button size="sm" className="h-9 gap-1.5 flex-1 bg-success hover:bg-success/90" onClick={handleConfirmSubmit} disabled={isLoading || !run || payslips.length === 0}>
                <Send className="h-3.5 w-3.5" />{submitted ? t("payroll.wps.reDownloadSif") : t("payroll.wps.submitWps")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function PayrollView() {
  const { t } = useTranslation("hr");
  const currency = useCurrency();
  const [selectedRun, setSelectedRun] = React.useState<PayrollRun | null>(null);
  const [runDrawerOpen, setRunDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [wpsRunId, setWpsRunId] = React.useState<string | null>(null);
  const [wpsOpen, setWpsOpen] = React.useState(false);

  const { data: payrollRuns = [] } = usePayrollRuns();
  const { data: payrollSummary } = usePayrollSummary();

  // Backend summary shape: { allTime: {...}, thisMonth: {...} | null }
  // Derive helper values from nested summary
  const thisMonth    = payrollSummary?.thisMonth;
  const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-06"
  // Backend returns newest first; find current month run or fall back to first
  const currentRun = payrollRuns.find(r => r.period === currentMonth) ?? payrollRuns[0];

  const openRun = (run: PayrollRun) => { setSelectedRun(run); setRunDrawerOpen(true); };
  const openWps = (run: PayrollRun) => { setWpsRunId(run.id); setWpsOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("payroll.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("payroll.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm" onClick={() => currentRun && openWps(currentRun)} disabled={!currentRun}><Download className="h-3.5 w-3.5" />{t("payroll.wpsFile")}</Button>
          <Can permission="hr.payroll.create"><Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setShowAddForm(true)}><CheckCircle2 className="h-4 w-4" />{t("payroll.runPayroll")}</Button></Can>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("payroll.stat.currentMonthNet"), value: formatCurrency(thisMonth?.totalNetSalary ?? currentRun?.totalNetSalary ?? 0, currency), sub: currentMonth ?? currentRun?.period ?? "—", icon: DollarSign, color: "text-primary bg-primary/10" },
          { label: t("payroll.stat.allTimePaid"),     value: formatCurrency(0, currency),                                                                  sub: t("payroll.stat.ytdNotTracked"),                           icon: TrendingUp, color: "text-success bg-success/10" },
          { label: t("payroll.stat.totalEmployees"),  value: thisMonth?.employeeCount ?? currentRun?.slipCount ?? 0,                                    sub: t("payroll.stat.onPayroll"),                               icon: Users,      color: "text-info bg-info/10" },
          { label: t("payroll.stat.paidRuns"),        value: payrollSummary?.allTime?.paid ?? payrollRuns.filter(r => r.status === "paid").length,      sub: t("payroll.stat.allTime"),                                 icon: BarChart3,  color: "text-muted-foreground bg-muted" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}><s.icon className="h-4 w-4" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-bold text-base leading-tight">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground/70">{s.sub}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Current payroll highlight */}
      {currentRun && (() => {
        const summaryStatus = thisMonth?.status ?? currentRun.status;
        const sc = STATUS_CONFIG[summaryStatus] ?? STATUS_FALLBACK;
        return (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">{t("payroll.currentRun")}</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      {t(`payrollStatus.${sc.key}`)}
                    </span>
                  </div>
                  <p className="font-bold text-xl">{currentMonth ?? currentRun.period}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t("payroll.employeesNet", { count: thisMonth?.employeeCount ?? currentRun.slipCount, net: formatCurrency(thisMonth?.totalNetSalary ?? currentRun.totalNetSalary, currency) })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => openRun(currentRun)}>
                    <FileText className="h-3.5 w-3.5" />{t("payroll.viewPayslips")}
                  </Button>
                  <Button size="sm" className="h-9 gap-1.5 bg-success hover:bg-success/90" onClick={() => openWps(currentRun)}>
                    <Send className="h-3.5 w-3.5" />{t("payroll.submitWps")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Payroll history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("payroll.history")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/30">
                <tr>
                  {[
                    ["runNumber", t("payroll.table.runNumber")], ["payPeriod", t("payroll.table.payPeriod")],
                    ["employees", t("payroll.table.employees")], ["gross", t("payroll.table.gross")],
                    ["deductions", t("payroll.table.deductions")], ["netPayroll", t("payroll.table.netPayroll")],
                    ["processed", t("payroll.table.processed")], ["paidOn", t("payroll.table.paidOn")],
                    ["status", t("payroll.table.status")], ["actions", ""],
                  ].map(([k, h]) => (
                    <th key={k} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrollRuns.map((run, i) => {
                  const sc = STATUS_CONFIG[run.status] ?? STATUS_FALLBACK;
                  const gross = run.totalBasicSalary + run.totalAllowances;
                  return (
                    <motion.tr key={run.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }} className="erp-table-row cursor-pointer" onClick={() => openRun(run)}>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{run.runNumber}</td>
                      <td className="px-4 py-3 font-semibold text-sm whitespace-nowrap">{run.period}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{run.slipCount}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{formatCurrency(gross, currency)}</td>
                      <td className="px-4 py-3 text-sm text-destructive whitespace-nowrap">- {formatCurrency(run.totalDeductions, currency)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-primary whitespace-nowrap">{formatCurrency(run.totalNetSalary, currency)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{run.processedAt ? formatDate(run.processedAt, "medium") : "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{run.paidAt ? formatDate(run.paidAt, "medium") : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                          <sc.icon className="h-3 w-3" />{t(`payrollStatus.${sc.key}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-muted-foreground/40" /></td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PayrollRunDrawer run={selectedRun} open={runDrawerOpen} onClose={() => setRunDrawerOpen(false)} />
      <AddPayrollForm open={showAddForm} onClose={() => setShowAddForm(false)} />
      <WpsSubmitModal
        runId={wpsRunId}
        period={currentRun?.period ?? ""}
        open={wpsOpen}
        onClose={() => { setWpsOpen(false); setWpsRunId(null); }}
      />
    </div>
  );
}
