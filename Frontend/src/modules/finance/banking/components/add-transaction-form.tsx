"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BANK_ACCOUNTS = [
  "Emirates NBD – AED 1001 (Main Operating)",
  "Emirates NBD – USD 1002 (USD Account)",
  "ADCB – AED 2001 (Payroll Account)",
  "FAB – AED 3001 (VAT Reserve)",
  "Petty Cash – AED (Dubai HQ)",
];

const CATEGORIES = [
  "Revenue / Sales Receipt",
  "Customer Payment",
  "Vendor Payment",
  "Salary / Payroll",
  "Rent & Facilities",
  "Utility Bill",
  "Tax Payment",
  "Loan Repayment",
  "Inter-Account Transfer",
  "Bank Charges",
  "Petty Cash",
  "Other",
];

type TxType = "inflow" | "outflow" | "transfer";

interface AddTransactionFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddTransactionForm({ open, onClose }: AddTransactionFormProps) {
  const [txType, setTxType] = React.useState<TxType>("inflow");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [account, setAccount] = React.useState("");
  const [toAccount, setToAccount] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("AED");
  const [category, setCategory] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [party, setParty] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const isValid = date && account && amount && parseFloat(amount) > 0 && category;

  const reset = () => {
    setTxType("inflow"); setDate(new Date().toISOString().split("T")[0]);
    setAccount(""); setToAccount(""); setAmount(""); setCurrency("AED");
    setCategory(""); setReference(""); setParty(""); setNotes("");
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
                <h2 className="text-base font-bold text-foreground">New Bank Transaction</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Record a manual bank transaction</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Transaction type */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Transaction Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "inflow",   label: "Money In",  icon: ArrowDownLeft,  color: "text-success",     ring: "ring-success/40  bg-success/5" },
                    { value: "outflow",  label: "Money Out", icon: ArrowUpRight,   color: "text-destructive", ring: "ring-destructive/40 bg-destructive/5" },
                    { value: "transfer", label: "Transfer",  icon: ArrowLeftRight, color: "text-primary",     ring: "ring-primary/40  bg-primary/5" },
                  ] as const).map(opt => {
                    const Icon = opt.icon;
                    const active = txType === opt.value;
                    return (
                      <button key={opt.value} onClick={() => setTxType(opt.value)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-medium ${
                          active ? `border-current ring-2 ${opt.ring} ${opt.color}` : "border-border text-muted-foreground hover:border-primary/30"
                        }`}>
                        <Icon className={`w-5 h-5 ${active ? opt.color : ""}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date *</label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {["AED", "USD", "EUR", "GBP", "SAR"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {txType === "transfer" ? "From Account" : "Bank Account"} *
                  </label>
                  <select value={account} onChange={e => setAccount(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Select account…</option>
                    {BANK_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                {txType === "transfer" && (
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To Account *</label>
                    <select value={toAccount} onChange={e => setToAccount(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select account…</option>
                      {BANK_ACCOUNTS.filter(a => a !== account).map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                )}

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">{currency}</span>
                    <Input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="0.00" className="h-9 text-sm pl-12 text-right font-semibold" />
                  </div>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category *</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Select category…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {txType === "inflow" ? "Payer" : txType === "outflow" ? "Payee" : "Reference"}
                  </label>
                  <Input value={party} onChange={e => setParty(e.target.value)}
                    placeholder={txType === "inflow" ? "Customer / source…" : txType === "outflow" ? "Vendor / recipient…" : "Transfer ref…"}
                    className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference #</label>
                  <Input value={reference} onChange={e => setReference(e.target.value)}
                    placeholder="Cheque, TT ref, INV #…" className="h-9 text-sm" />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Additional details…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Save Transaction</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
