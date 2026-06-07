import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, FileText, CheckCircle2, Clock, DollarSign,
  TrendingUp, Users, X, ChevronRight, Send, Printer,
  Building2, CreditCard, Calendar, Check, BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { PayrollRunDto as PayrollRun, PayslipDto as Payslip, PayrollStatus } from "@/lib/hr/hr.api";
import { usePayrollRuns, usePayrollSummary } from "@/hooks/hr/use-hr";
import { AddPayrollForm } from "./add-payroll-form";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:      { label: "Draft",      color: "text-muted-foreground", bg: "bg-muted",             icon: FileText },
  processing: { label: "Processing", color: "text-info",             bg: "bg-info/10",           icon: Clock },
  processed:  { label: "Processed",  color: "text-primary",          bg: "bg-primary/10",        icon: CheckCircle2 },
  approved:   { label: "Approved",   color: "text-primary",          bg: "bg-primary/10",        icon: CheckCircle2 },
  paid:       { label: "Paid",       color: "text-success",          bg: "bg-success/10",        icon: CheckCircle2 },
  failed:     { label: "Failed",     color: "text-destructive",      bg: "bg-destructive/10",    icon: X },
};
const STATUS_FALLBACK = { label: "Unknown", color: "text-muted-foreground", bg: "bg-muted", icon: FileText };

function PayslipDrawer({ payslip, open, onClose }: { payslip: Payslip | null; open: boolean; onClose: () => void }) {
  if (!payslip) return null;
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
              <div>
                <p className="font-bold text-base">Payslip</p>
                <p className="text-xs text-muted-foreground">{payslip.payPeriod}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"><Printer className="h-3.5 w-3.5" />Print</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Employee */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="font-bold bg-primary/10 text-primary">{getInitials(payslip.employeeName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold">{payslip.employeeName}</p>
                  <p className="text-sm text-muted-foreground">{payslip.designation}</p>
                  <p className="text-xs font-mono text-muted-foreground">{payslip.employeeNumber}</p>
                </div>
              </div>

              {/* Earnings */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Earnings</h4>
                <div className="bg-muted/30 rounded-xl p-4 space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Basic Salary</span>
                    <span className="font-semibold">{formatCurrency(payslip.basicSalary, payslip.currency)}</span>
                  </div>
                  {(payslip.allowances ?? []).map(a => (
                    <div key={a.label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{a.label}</span>
                      <span>{formatCurrency(a.amount, payslip.currency)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                    <span>Gross Salary</span>
                    <span className="text-primary">{formatCurrency(payslip.grossSalary, payslip.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Deductions</h4>
                <div className="bg-muted/30 rounded-xl p-4 space-y-2.5">
                  {(payslip.deductions ?? []).map(d => (
                    <div key={d.label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className="text-destructive">- {formatCurrency(d.amount, payslip.currency)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                    <span>Total Deductions</span>
                    <span className="text-destructive">- {formatCurrency(payslip.totalDeductions, payslip.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Net Salary */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-primary font-semibold uppercase tracking-wide">Net Salary</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Amount to be credited</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(payslip.netSalary, payslip.currency)}</p>
                </div>
              </div>

              {/* Bank details */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Payment Details</h4>
                <div className="space-y-2.5">
                  {[
                    { icon: Building2, label: "Bank",    value: payslip.bank },
                    { icon: CreditCard,label: "IBAN",    value: payslip.iban },
                    { icon: Calendar,  label: "Paid On", value: payslip.paidOn ? formatDate(payslip.paidOn, "medium") : "Pending" },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-3 py-2 border-b border-border/40">
                      <row.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 flex justify-between">
                        <span className="text-xs text-muted-foreground">{row.label}</span>
                        <span className="text-sm font-medium font-mono text-right text-xs">{row.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border px-6 py-4 flex gap-2">
              <Button size="sm" className="flex-1 gap-1.5"><Download className="h-3.5 w-3.5" />Download PDF</Button>
              <Button variant="outline" size="sm" className="flex-1 gap-1.5"><Send className="h-3.5 w-3.5" />Email to Employee</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PayrollRunDrawer({ run, open, onClose }: { run: PayrollRun | null; open: boolean; onClose: () => void }) {
  const [selectedPayslip, setSelectedPayslip] = React.useState<Payslip | null>(null);
  const [payslipOpen, setPayslipOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  if (!run) return null;
  const sc = STATUS_CONFIG[run.status] ?? STATUS_FALLBACK;
  const payslips = run.payslips ?? [];
  const grossTotal = run.totalBasicSalary + run.totalAllowances;

  const filtered = payslips.filter(p =>
    !search || p.employeeName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 h-full w-full max-w-2xl bg-background border-l border-border shadow-2xl z-50 flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <p className="font-bold text-lg">{run.period} Payroll</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <sc.icon className="h-3 w-3" />{sc.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{run.slipCount} employees</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {run.status === "approved" && (
                    <Button size="sm" className="h-8 text-xs gap-1.5 bg-success hover:bg-success/90">
                      <Check className="h-3.5 w-3.5" />Process Payment
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3 px-6 pt-4 pb-2">
                {[
                  { label: "Gross Payroll", value: formatCurrency(grossTotal, "AED"),               color: "text-foreground" },
                  { label: "Deductions",    value: formatCurrency(run.totalDeductions, "AED"),      color: "text-destructive" },
                  { label: "Net Payroll",   value: formatCurrency(run.totalNetSalary, "AED"),       color: "text-primary" },
                ].map(s => (
                  <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={cn("font-bold text-base mt-0.5", s.color)}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Approval trail */}
              <div className="px-6 pb-3 flex items-center gap-6 text-xs text-muted-foreground">
                {run.processedAt && <span>Processed on <span className="font-medium text-foreground">{formatDate(run.processedAt, "medium")}</span></span>}
                {run.paidAt && <span>Paid on <span className="font-medium text-foreground">{formatDate(run.paidAt, "medium")}</span></span>}
                {run.notes && <span className="truncate italic">{run.notes}</span>}
              </div>

              {/* Search */}
              <div className="px-6 pb-3">
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Payslips table */}
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                    <FileText className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No individual payslips available in list view.</p>
                    <p className="text-xs">Open a payroll run detail to view payslips.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-y border-border bg-muted/30 sticky top-0">
                      <tr>
                        {["Employee","Department","Basic","Gross","Net",""].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((ps, i) => (
                        <motion.tr key={ps.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }} className="erp-table-row cursor-pointer"
                          onClick={() => { setSelectedPayslip(ps); setPayslipOpen(true); }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-7 w-7 shrink-0">
                                <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">{getInitials(ps.employeeName)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{ps.employeeName}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{ps.employeeNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{ps.department}</td>
                          <td className="px-4 py-3 text-sm">{formatCurrency(ps.basicSalary, ps.currency)}</td>
                          <td className="px-4 py-3 text-sm">{formatCurrency(ps.grossSalary, ps.currency)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-primary">{formatCurrency(ps.netSalary, ps.currency)}</td>
                          <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-muted-foreground/40" /></td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <PayslipDrawer payslip={selectedPayslip} open={payslipOpen} onClose={() => setPayslipOpen(false)} />
    </>
  );
}

export function PayrollView() {
  const [selectedRun, setSelectedRun] = React.useState<PayrollRun | null>(null);
  const [runDrawerOpen, setRunDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: payrollRuns = [] } = usePayrollRuns();
  const { data: payrollSummary } = usePayrollSummary();

  // Backend returns newest first; find current month run or fall back to first
  const currentRun = payrollRuns.find(r => r.period === payrollSummary?.currentMonth) ?? payrollRuns[0];

  const openRun = (run: PayrollRun) => { setSelectedRun(run); setRunDrawerOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Process salaries, payslips, and WPS submissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm"><Download className="h-3.5 w-3.5" />WPS File</Button>
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setShowAddForm(true)}><CheckCircle2 className="h-4 w-4" />Run Payroll</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Current Month Net",  value: formatCurrency(payrollSummary?.totalNetPayroll ?? currentRun?.totalNetSalary ?? 0, "AED"), sub: payrollSummary?.currentMonth ?? currentRun?.period ?? "—", icon: DollarSign, color: "text-primary bg-primary/10" },
          { label: "YTD Total Paid",     value: formatCurrency(payrollSummary?.ytdTotal ?? 0, "AED"),                                      sub: "Jan–May 2026",                                            icon: TrendingUp, color: "text-success bg-success/10" },
          { label: "Total Employees",    value: payrollSummary?.totalEmployees ?? currentRun?.slipCount ?? 0,                              sub: "On payroll",                                              icon: Users,      color: "text-info bg-info/10" },
          { label: "Paid Runs",          value: payrollSummary?.paidRuns ?? payrollRuns.filter(r => r.status === "paid").length,           sub: "This year",                                               icon: BarChart3,  color: "text-muted-foreground bg-muted" },
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
        const summaryStatus = payrollSummary?.status ?? currentRun.status;
        const sc = STATUS_CONFIG[summaryStatus] ?? STATUS_FALLBACK;
        return (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">Current Payroll Run</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      {sc.label}
                    </span>
                  </div>
                  <p className="font-bold text-xl">{payrollSummary?.currentMonth ?? currentRun.period}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {payrollSummary?.totalEmployees ?? currentRun.slipCount} employees · Net {formatCurrency(payrollSummary?.totalNetPayroll ?? currentRun.totalNetSalary, "AED")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-9 gap-1.5">
                    <FileText className="h-3.5 w-3.5" />View Payslips
                  </Button>
                  <Button size="sm" className="h-9 gap-1.5 bg-success hover:bg-success/90" onClick={() => openRun(currentRun)}>
                    <Send className="h-3.5 w-3.5" />Submit WPS
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
          <CardTitle className="text-sm font-semibold">Payroll History — 2026</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/30">
                <tr>
                  {["Run #","Pay Period","Employees","Gross","Deductions","Net Payroll","Processed","Paid On","Status",""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
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
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{formatCurrency(gross, "AED")}</td>
                      <td className="px-4 py-3 text-sm text-destructive whitespace-nowrap">- {formatCurrency(run.totalDeductions, "AED")}</td>
                      <td className="px-4 py-3 text-sm font-bold text-primary whitespace-nowrap">{formatCurrency(run.totalNetSalary, "AED")}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{run.processedAt ? formatDate(run.processedAt, "medium") : "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{run.paidAt ? formatDate(run.paidAt, "medium") : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                          <sc.icon className="h-3 w-3" />{sc.label}
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
    </div>
  );
}
