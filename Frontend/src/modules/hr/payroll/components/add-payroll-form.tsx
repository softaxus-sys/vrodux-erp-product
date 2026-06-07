"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

const DEPARTMENTS = ["All Departments", "IT", "Finance", "HR", "Sales", "Operations", "Marketing", "Management"];
const PAYROLL_TYPES = [
  { value: "monthly",    label: "Monthly Payroll" },
  { value: "bonus",      label: "Bonus Run" },
  { value: "termination",label: "Termination Settlement" },
  { value: "correction", label: "Payroll Correction" },
];

interface AllowanceLine {
  id: string;
  name: string;
  amount: number;
}

interface DeductionLine {
  id: string;
  name: string;
  amount: number;
}

function newAllowance(): AllowanceLine {
  return { id: String(Date.now() + Math.random()), name: "", amount: 0 };
}
function newDeduction(): DeductionLine {
  return { id: String(Date.now() + Math.random()), name: "", amount: 0 };
}

interface AddPayrollFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddPayrollForm({ open, onClose }: AddPayrollFormProps) {
  const [payrollType, setPayrollType]   = React.useState("monthly");
  const [payPeriod, setPayPeriod]       = React.useState("May 2026");
  const [department, setDepartment]     = React.useState("All Departments");
  const [paymentDate, setPaymentDate]   = React.useState("");
  const [description, setDescription]   = React.useState("");
  const [allowances, setAllowances]     = React.useState<AllowanceLine[]>([
    { id: "a1", name: "Housing Allowance", amount: 0 },
    { id: "a2", name: "Transport Allowance", amount: 0 },
  ]);
  const [deductions, setDeductions]     = React.useState<DeductionLine[]>([
    { id: "d1", name: "GOSI / Social Security", amount: 0 },
  ]);
  const [notes, setNotes]               = React.useState("");

  const totalAllowances = allowances.reduce((s, a) => s + a.amount, 0);
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

  const updateAllowance = (id: string, key: keyof AllowanceLine, value: string | number) =>
    setAllowances(prev => prev.map(a => a.id === id ? { ...a, [key]: value } : a));
  const updateDeduction = (id: string, key: keyof DeductionLine, value: string | number) =>
    setDeductions(prev => prev.map(d => d.id === id ? { ...d, [key]: value } : d));

  const isValid = payPeriod && paymentDate && department;

  const reset = () => {
    setPayrollType("monthly"); setPayPeriod("May 2026"); setDepartment("All Departments");
    setPaymentDate(""); setDescription("");
    setAllowances([{ id: "a1", name: "Housing Allowance", amount: 0 }, { id: "a2", name: "Transport Allowance", amount: 0 }]);
    setDeductions([{ id: "d1", name: "GOSI / Social Security", amount: 0 }]);
    setNotes("");
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
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Payroll Run</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configure and schedule a payroll run</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Payroll Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payroll Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYROLL_TYPES.map(t => (
                    <button key={t.value} onClick={() => setPayrollType(t.value)}
                      className={`py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                        payrollType === t.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Header fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pay Period *</label>
                  <select value={payPeriod} onChange={e => setPayPeriod(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {["May 2026", "April 2026", "March 2026", "February 2026", "January 2026"].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Date *</label>
                  <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department *</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Monthly payroll for May 2026" className="h-9 text-sm" />
                </div>
              </div>

              {/* Allowances */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Additional Allowances</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAllowances(p => [...p, newAllowance()])} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {allowances.map(a => (
                    <div key={a.id} className="flex items-center gap-2">
                      <Input value={a.name} onChange={e => updateAllowance(a.id, "name", e.target.value)} placeholder="Allowance name…" className="h-8 text-xs flex-1" />
                      <Input type="number" min={0} step={50} value={a.amount || ""} onChange={e => updateAllowance(a.id, "amount", +e.target.value)}
                        placeholder="0.00" className="h-8 text-xs w-28 text-right" />
                      <button onClick={() => setAllowances(p => p.filter(x => x.id !== a.id))}
                        className="p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-end px-1">
                    <span className="text-xs text-muted-foreground">Total: <span className="font-semibold text-success">{formatCurrency(totalAllowances, "AED")}</span></span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deductions</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDeductions(p => [...p, newDeduction()])} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {deductions.map(d => (
                    <div key={d.id} className="flex items-center gap-2">
                      <Input value={d.name} onChange={e => updateDeduction(d.id, "name", e.target.value)} placeholder="Deduction name…" className="h-8 text-xs flex-1" />
                      <Input type="number" min={0} step={50} value={d.amount || ""} onChange={e => updateDeduction(d.id, "amount", +e.target.value)}
                        placeholder="0.00" className="h-8 text-xs w-28 text-right" />
                      <button onClick={() => setDeductions(p => p.filter(x => x.id !== d.id))}
                        className="p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-end px-1">
                    <span className="text-xs text-muted-foreground">Total: <span className="font-semibold text-destructive">{formatCurrency(totalDeductions, "AED")}</span></span>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 px-3 py-2.5 bg-warning/5 border border-warning/20 rounded-xl text-xs text-warning">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Payroll runs require Finance approval before payment disbursement.
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Any exceptions, manual overrides, or notes…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={!isValid}>Save as Draft</Button>
                <Button onClick={onClose} disabled={!isValid}>Submit for Approval</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
