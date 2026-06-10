import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, AlertCircle, ChevronRight, ChevronLeft,
  Users, DollarSign, Plus, Minus, Gift, TrendingDown,
  CheckCircle2, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCreatePayrollRun, useEmployees } from "@/hooks/hr/use-hr";
import type { EmployeeDto } from "@/lib/hr/hr.api";

// ── Constants ─────────────────────────────────────────────────────────────────
const PAYROLL_TYPES = [
  { value: "monthly",     label: "Monthly Payroll",        desc: "Regular monthly salary for all active employees" },
  { value: "bonus",       label: "Bonus Run",              desc: "One-time bonus or incentive disbursement" },
  { value: "termination", label: "Termination Settlement", desc: "Final settlement for departing employees" },
  { value: "correction",  label: "Payroll Correction",     desc: "Adjustment to a previously processed run" },
];

// Generate last 13 months + next month dynamically
function buildPeriodOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-AE", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

// ── Per-employee override state ───────────────────────────────────────────────
interface EmpRow {
  employeeId:     string;
  employeeName:   string;
  jobTitle:       string;
  departmentName: string;
  basicSalary:    number;
  allowances:     number;   // single aggregated extra allowance / bonus
  deductions:     number;   // single aggregated deduction
}

function buildRows(employees: EmployeeDto[]): EmpRow[] {
  return employees
    .filter(e => e.status === "active")
    .map(e => ({
      employeeId:     e.id,
      employeeName:   `${e.firstName} ${e.lastName}`.trim(),
      jobTitle:       e.designation ?? "",
      departmentName: e.department ?? "",
      basicSalary:    e.basicSalary ?? 0,
      allowances:     0,
      deductions:     0,
    }));
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface AddPayrollFormProps {
  open:       boolean;
  onClose:    () => void;
  onSuccess?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AddPayrollForm({ open, onClose, onSuccess }: AddPayrollFormProps) {
  const PERIODS = React.useMemo(buildPeriodOptions, []);

  const createPayroll = useCreatePayrollRun();
  const { data: employees = [], isLoading: loadingEmp } = useEmployees();

  // Step 1 state
  const [step,         setStep]         = React.useState<1 | 2>(1);
  const [payrollType,  setPayrollType]  = React.useState("monthly");
  const [period,       setPeriod]       = React.useState(() => PERIODS[1]?.value ?? PERIODS[0].value);
  const [paymentDate,  setPaymentDate]  = React.useState("");
  const [notes,        setNotes]        = React.useState("");
  const [apiError,     setApiError]     = React.useState<string | null>(null);

  // Step 2 state
  const [rows,         setRows]         = React.useState<EmpRow[]>([]);
  const [search,       setSearch]       = React.useState("");
  const [globalBonus,  setGlobalBonus]  = React.useState("");
  const [globalDeduct, setGlobalDeduct] = React.useState("");

  // When moving to step 2, populate rows from employees
  const goToStep2 = () => {
    setRows(buildRows(employees));
    setStep(2);
  };

  // Reset everything
  const reset = () => {
    setStep(1);
    setPayrollType("monthly");
    setPeriod(PERIODS[1]?.value ?? PERIODS[0].value);
    setPaymentDate("");
    setNotes("");
    setRows([]);
    setSearch("");
    setGlobalBonus("");
    setGlobalDeduct("");
    setApiError(null);
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  // Row updaters
  const updateRow = (id: string, key: "allowances" | "deductions", val: number) =>
    setRows(prev => prev.map(r => r.employeeId === id ? { ...r, [key]: Math.max(0, val) } : r));

  // Apply global bonus / deduction to ALL rows
  const applyGlobalBonus = () => {
    const amt = parseFloat(globalBonus);
    if (!amt || isNaN(amt)) return;
    setRows(prev => prev.map(r => ({ ...r, allowances: r.allowances + amt })));
    setGlobalBonus("");
  };
  const applyGlobalDeduct = () => {
    const amt = parseFloat(globalDeduct);
    if (!amt || isNaN(amt)) return;
    setRows(prev => prev.map(r => ({ ...r, deductions: r.deductions + amt })));
    setGlobalDeduct("");
  };

  // Filtered rows for display
  const filteredRows = React.useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r =>
      !search ||
      r.employeeName.toLowerCase().includes(q) ||
      r.departmentName.toLowerCase().includes(q) ||
      r.jobTitle.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Totals
  const totalBasic      = rows.reduce((s, r) => s + r.basicSalary, 0);
  const totalAllowances = rows.reduce((s, r) => s + r.allowances, 0);
  const totalDeductions = rows.reduce((s, r) => s + r.deductions, 0);
  const totalNet        = rows.reduce((s, r) => s + r.basicSalary + r.allowances - r.deductions, 0);

  // Submit
  const handleSubmit = () => {
    if (rows.length === 0) { setApiError("No active employees to include."); return; }
    setApiError(null);
    createPayroll.mutate(
      {
        period,
        notes: notes.trim() || undefined,
        slips: rows.map(r => ({
          employeeId:     r.employeeId,
          employeeName:   r.employeeName,
          jobTitle:       r.jobTitle || undefined,
          departmentName: r.departmentName || undefined,
          basicSalary:    r.basicSalary,
          allowances:     r.allowances,
          deductions:     r.deductions,
        })),
      },
      {
        onSuccess: () => { reset(); onSuccess?.(); onClose(); },
        onError:   (err: Error) => setApiError(err.message),
      }
    );
  };

  const step1Valid = !!period && !!paymentDate;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`fixed right-0 top-0 h-full bg-card border-l border-border z-50 flex flex-col shadow-2xl transition-all
              ${step === 2 ? "w-full max-w-4xl" : "w-full max-w-lg"}`}
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                {step === 2 && (
                  <button onClick={() => setStep(1)} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <div>
                  <h2 className="text-base font-bold">
                    {step === 1 ? "New Payroll Run" : "Review & Adjust Salaries"}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${step === 1 ? "bg-primary/10 text-primary" : "bg-success/10 text-success"}`}>
                      Step 1: Configure
                    </span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${step === 2 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      Step 2: Review Employees
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Step 1: Configure ── */}
            {step === 1 && (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Payroll Type */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payroll Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYROLL_TYPES.map(t => (
                      <button key={t.value} onClick={() => setPayrollType(t.value)}
                        className={`py-3 px-3 rounded-xl border-2 text-left transition-all ${
                          payrollType === t.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}>
                        <p className={`text-xs font-semibold ${payrollType === t.value ? "text-primary" : "text-foreground"}`}>{t.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Period & Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pay Period *</label>
                    <select
                      value={period}
                      onChange={e => setPeriod(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Date *</label>
                    <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes / Description</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Monthly payroll including Q2 bonuses…"
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>

                {/* Employee count preview */}
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      {loadingEmp ? "Loading…" : `${employees.filter(e => e.status === "active").length} active employees`}
                    </p>
                    <p className="text-xs text-muted-foreground">will be included in this payroll run</p>
                  </div>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 px-3 py-2.5 bg-warning/5 border border-warning/20 rounded-xl text-xs text-warning">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Payroll runs require Finance approval before payment disbursement.
                </div>
              </div>
            )}

            {/* ── Step 2: Review employees ── */}
            {step === 2 && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Toolbar */}
                <div className="px-6 py-3 border-b border-border shrink-0 space-y-3">
                  {apiError && (
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{apiError}
                    </div>
                  )}

                  {/* Global adjustments */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Apply to All:</p>

                    {/* Global bonus */}
                    <div className="flex items-center gap-1.5">
                      <Gift className="h-3.5 w-3.5 text-success" />
                      <Input
                        type="number" min={0} step={100}
                        value={globalBonus}
                        onChange={e => setGlobalBonus(e.target.value)}
                        placeholder="Bonus amount"
                        className="h-7 w-32 text-xs"
                        onKeyDown={e => e.key === "Enter" && applyGlobalBonus()}
                      />
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-success border-success/30 hover:bg-success/10" onClick={applyGlobalBonus}>
                        <Plus className="w-3 h-3" />Add Bonus
                      </Button>
                    </div>

                    {/* Global deduction */}
                    <div className="flex items-center gap-1.5">
                      <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                      <Input
                        type="number" min={0} step={100}
                        value={globalDeduct}
                        onChange={e => setGlobalDeduct(e.target.value)}
                        placeholder="Deduction amount"
                        className="h-7 w-32 text-xs"
                        onKeyDown={e => e.key === "Enter" && applyGlobalDeduct()}
                      />
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={applyGlobalDeduct}>
                        <Minus className="w-3 h-3" />Add Deduction
                      </Button>
                    </div>

                    {/* Search */}
                    <div className="relative ml-auto">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search employees…"
                        className="h-7 pl-6 w-44 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Employee table */}
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/30 sticky top-0 z-10">
                      <tr>
                        {["Employee", "Department", "Basic Salary", "Allowances / Bonus", "Deductions", "Net Salary"].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-16 text-muted-foreground text-sm">
                            {search ? "No employees match your search." : "No active employees found."}
                          </td>
                        </tr>
                      ) : filteredRows.map((row, i) => {
                        const net = row.basicSalary + row.allowances - row.deductions;
                        return (
                          <motion.tr
                            key={row.employeeId}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.015 }}
                            className="border-b border-border/40 hover:bg-muted/20"
                          >
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-sm leading-tight">{row.employeeName}</p>
                              <p className="text-[10px] text-muted-foreground">{row.jobTitle}</p>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.departmentName || "—"}</td>
                            <td className="px-4 py-2.5 text-sm font-medium">{formatCurrency(row.basicSalary, "AED")}</td>

                            {/* Allowances input */}
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-success font-medium">+</span>
                                <Input
                                  type="number" min={0} step={100}
                                  value={row.allowances || ""}
                                  onChange={e => updateRow(row.employeeId, "allowances", +e.target.value)}
                                  placeholder="0"
                                  className="h-7 w-28 text-xs text-right border-success/30 focus:ring-success/20"
                                />
                              </div>
                            </td>

                            {/* Deductions input */}
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-destructive font-medium">−</span>
                                <Input
                                  type="number" min={0} step={100}
                                  value={row.deductions || ""}
                                  onChange={e => updateRow(row.employeeId, "deductions", +e.target.value)}
                                  placeholder="0"
                                  className="h-7 w-28 text-xs text-right border-destructive/30 focus:ring-destructive/20"
                                />
                              </div>
                            </td>

                            {/* Net salary */}
                            <td className="px-4 py-2.5 font-bold text-primary text-sm">
                              {formatCurrency(net, "AED")}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>

                    {/* Totals row */}
                    {rows.length > 0 && (
                      <tfoot className="border-t-2 border-border bg-muted/40 sticky bottom-0">
                        <tr>
                          <td className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                            {rows.length} Employees
                          </td>
                          <td />
                          <td className="px-4 py-3 text-sm font-bold">{formatCurrency(totalBasic, "AED")}</td>
                          <td className="px-4 py-3 text-sm font-bold text-success">
                            {totalAllowances > 0 ? `+ ${formatCurrency(totalAllowances, "AED")}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-destructive">
                            {totalDeductions > 0 ? `− ${formatCurrency(totalDeductions, "AED")}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-base font-bold text-primary">{formatCurrency(totalNet, "AED")}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Summary bar */}
                <div className="px-6 py-3 border-t border-border bg-muted/20 shrink-0">
                  <div className="flex items-center gap-6 text-xs flex-wrap">
                    <span className="text-muted-foreground">Period: <span className="font-semibold text-foreground">{period}</span></span>
                    <span className="text-muted-foreground">Employees: <span className="font-semibold text-foreground">{rows.length}</span></span>
                    <span className="text-muted-foreground">Basic: <span className="font-semibold text-foreground">{formatCurrency(totalBasic, "AED")}</span></span>
                    {totalAllowances > 0 && <span className="text-muted-foreground">Allowances: <span className="font-semibold text-success">+{formatCurrency(totalAllowances, "AED")}</span></span>}
                    {totalDeductions > 0 && <span className="text-muted-foreground">Deductions: <span className="font-semibold text-destructive">−{formatCurrency(totalDeductions, "AED")}</span></span>}
                    <span className="ml-auto font-bold">Net Payroll: <span className="text-primary">{formatCurrency(totalNet, "AED")}</span></span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Footer ── */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={createPayroll.isPending}>
                Cancel
              </Button>

              {step === 1 ? (
                <Button
                  onClick={goToStep2}
                  disabled={!step1Valid || loadingEmp}
                  className="gap-1.5"
                >
                  {loadingEmp ? "Loading employees…" : "Review Employees"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={createPayroll.isPending || rows.length === 0}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {createPayroll.isPending ? "Processing…" : `Run Payroll — ${formatCurrency(totalNet, "AED")}`}
                </Button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
