import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCreateContract } from "@/hooks/real-estate/use-re";

const CONTRACT_TYPES  = ["Lease", "Sale", "Management", "Service"];
const PAYMENT_FREQ    = ["Monthly", "Quarterly", "Semi-Annual", "Annual", "One-Time"];
const PAYMENT_METHODS = ["Bank Transfer", "Cheque", "Cash", "Credit Card"];
const CURRENCIES      = ["AED", "USD", "EUR"];

interface AddContractFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddContractForm({ open, onClose }: AddContractFormProps) {
  const createContract = useCreateContract();
  const [contractType, setContractType] = React.useState("Lease");
  const [unit, setUnit]                 = React.useState("");
  const [tenantName, setTenantName]     = React.useState("");
  const [tenantEmail, setTenantEmail]   = React.useState("");
  const [tenantPhone, setTenantPhone]   = React.useState("");
  const [startDate, setStartDate]       = React.useState("");
  const [endDate, setEndDate]           = React.useState("");
  const [rentAmount, setRentAmount]     = React.useState("");
  const [currency, setCurrency]         = React.useState("AED");
  const [paymentFreq, setPaymentFreq]   = React.useState("Monthly");
  const [paymentMethod, setPaymentMethod] = React.useState("Bank Transfer");
  const [deposit, setDeposit]           = React.useState("");
  const [noOfCheques, setNoOfCheques]   = React.useState("1");
  const [brokerName, setBrokerName]     = React.useState("");
  const [commission, setCommission]     = React.useState("");
  const [notes, setNotes]               = React.useState("");

  const annualRent = React.useMemo(() => {
    const r = parseFloat(rentAmount) || 0;
    const multiplier: Record<string, number> = { Monthly: 12, Quarterly: 4, "Semi-Annual": 2, Annual: 1, "One-Time": 1 };
    return r * (multiplier[paymentFreq] || 1);
  }, [rentAmount, paymentFreq]);

  const isValid = unit.trim() && tenantName.trim() && startDate && endDate && rentAmount;

  const reset = () => {
    setContractType("Lease"); setUnit(""); setTenantName(""); setTenantEmail(""); setTenantPhone("");
    setStartDate(""); setEndDate(""); setRentAmount(""); setCurrency("AED"); setPaymentFreq("Monthly");
    setPaymentMethod("Bank Transfer"); setDeposit(""); setNoOfCheques("1");
    setBrokerName(""); setCommission(""); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleCreate = async (asDraft: boolean) => {
    try {
      await createContract.mutateAsync({
        contractType: contractType.toLowerCase(), unit, tenantName, tenantEmail, tenantPhone,
        startDate, endDate, rentAmount: parseFloat(rentAmount) || 0, annualRent,
        currency, paymentFreq, paymentMethod, deposit: parseFloat(deposit) || undefined,
        noOfCheques: parseInt(noOfCheques) || 1, brokerName: brokerName.trim() || undefined,
        commission: parseFloat(commission) || undefined, notes: notes.trim() || undefined,
        status: asDraft ? 'draft' : 'active',
      });
      onClose();
    } catch { /* hook toasts */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Contract</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Create a tenancy or sale agreement</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contract Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {CONTRACT_TYPES.map(t => (
                    <button key={t} onClick={() => setContractType(t)}
                      className={`py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                        contractType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Unit & Parties */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Property & Parties</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit / Property *</label>
                    <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="e.g. Marina Heights – Unit 201" className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tenant / Buyer Name *</label>
                    <Input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Full name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
                    <Input type="email" value={tenantEmail} onChange={e => setTenantEmail(e.target.value)} placeholder="email@example.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                    <Input value={tenantPhone} onChange={e => setTenantPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Contract Period */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contract Period</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date *</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End Date *</label>
                    <Input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Financial Terms */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financial Terms</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</label>
                    <select value={currency} onChange={e => setCurrency(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Frequency</label>
                    <select value={paymentFreq} onChange={e => setPaymentFreq(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {PAYMENT_FREQ.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rent Amount *</label>
                    <Input type="number" min={0} step={1000} value={rentAmount} onChange={e => setRentAmount(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Security Deposit</label>
                    <Input type="number" min={0} step={1000} value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Method</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">No. of Cheques</label>
                    <Input type="number" min={1} max={12} value={noOfCheques} onChange={e => setNoOfCheques(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
                {annualRent > 0 && (
                  <div className="flex items-center justify-between mt-3 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                    <span className="text-xs text-muted-foreground">Annual Rent Value</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(annualRent, currency)}</span>
                  </div>
                )}
              </div>

              {/* Broker */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Broker Name</label>
                  <Input value={brokerName} onChange={e => setBrokerName(e.target.value)} placeholder="Broker / agent…" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission (AED)</label>
                  <Input type="number" min={0} step={500} value={commission} onChange={e => setCommission(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special terms, Ejari notes, maintenance responsibilities…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleCreate(true)} disabled={!isValid || createContract.isPending}>Save as Draft</Button>
                <Button onClick={() => handleCreate(false)} disabled={!isValid || createContract.isPending}>Create Contract</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

