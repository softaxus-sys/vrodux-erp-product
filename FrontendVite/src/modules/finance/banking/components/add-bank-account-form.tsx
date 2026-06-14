import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateBankAccount } from "@/hooks/finance/use-finance";
import { useCurrency } from "@/hooks/use-currency";

const CURRENCIES = ["AED", "USD", "EUR", "GBP", "SAR", "INR", "PKR"];

interface AddBankAccountFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddBankAccountForm({ open, onClose }: AddBankAccountFormProps) {
  const tenantCurrency = useCurrency();
  const create = useCreateBankAccount();

  const [accountName, setAccountName]     = React.useState("");
  const [bankName, setBankName]           = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [iban, setIban]                   = React.useState("");
  const [currency, setCurrency]           = React.useState(tenantCurrency);
  const [accountType, setAccountType]     = React.useState<"current" | "savings">("current");

  const reset = () => {
    setAccountName(""); setBankName(""); setAccountNumber(""); setIban("");
    setCurrency(tenantCurrency); setAccountType("current");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValid = accountName.trim() && bankName.trim() && accountNumber.trim() && iban.trim() && currency;

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      await create.mutateAsync({
        accountName:   accountName.trim(),
        bankName:      bankName.trim(),
        accountNumber: accountNumber.trim(),
        iban:          iban.trim().toUpperCase(),
        currency,
        accountType,
      });
      onClose();
    } catch { /* hook toasts the error; keep form open for retry */ }
  };

  const isPending = create.isPending;

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
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Add Bank Account</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Register a new bank account</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account Name *</label>
                  <Input value={accountName} onChange={e => setAccountName(e.target.value)}
                    placeholder="e.g. Operating Account" className="h-9 text-sm" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Name *</label>
                  <Input value={bankName} onChange={e => setBankName(e.target.value)}
                    placeholder="e.g. Emirates NBD" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account Number *</label>
                  <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
                    placeholder="0123456789" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account Type *</label>
                  <select value={accountType} onChange={e => setAccountType(e.target.value as "current" | "savings")}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="current">Current</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">IBAN *</label>
                  <Input value={iban} onChange={e => setIban(e.target.value)}
                    placeholder="AE07 0331 2345 6789 0123 456" className="h-9 text-sm font-mono uppercase" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency *</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The opening balance starts at zero — record an inflow transaction to set the initial balance.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!isValid || isPending}>
                {isPending ? "Saving…" : "Add Account"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
