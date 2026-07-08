import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, ChevronLeft, ChevronRight, FileText, Loader2, Building2, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useAuthStore } from "@/store/auth.store";
import { useVisaTypes, useCreateVisaCase, useGenerateCaseInvoice } from "@/hooks/visa/use-visa";
import { useCustomers } from "@/hooks/crm/use-crm";
import { useCan } from "@/components/auth/can";
import type { ApplicantInput } from "@/lib/visa/visa.api";

const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];
const PRIORITIES = ["low", "medium", "high"];
const RELATIONSHIPS = ["primary", "spouse", "child", "parent", "other"];

const emptyApplicant = (relationship = "primary"): ApplicantInput => ({
  firstName: "", lastName: "", nationality: "", passportNumber: "",
  passportExpiry: null, dateOfBirth: null, emiratesId: null, uidNumber: null, relationship,
});

/** Optional seed data, e.g. when creating a case from a CRM lead. */
export interface CaseWizardPrefill {
  customerName?: string;
  customerId?: string | null;
  assignedTo?: string;
  applicant?: Partial<ApplicantInput>;
}

interface Props { open: boolean; onClose: () => void; prefill?: CaseWizardPrefill; }

export function NewCaseWizard({ open, onClose, prefill }: Props) {
  const currency = useCurrency();
  const createdByName = useAuthStore(s => s.user?.name) ?? "";
  const { data: types = [] } = useVisaTypes();
  const { data: accounts = [] } = useCustomers();
  const create = useCreateVisaCase();
  const genInvoice = useGenerateCaseInvoice();
  const canInvoice = useCan("finance.invoicing.create");

  const [step, setStep] = React.useState(1);
  const [typeId, setTypeId] = React.useState("");
  const [emirate, setEmirate] = React.useState("Dubai");
  const [priority, setPriority] = React.useState("medium");
  const [customerName, setCustomerName] = React.useState("");
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [acctOpen, setAcctOpen] = React.useState(false);
  const [assignedTo, setAssignedTo] = React.useState("");
  const [serviceFee, setServiceFee] = React.useState("");
  const [govtFee, setGovtFee] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [makeInvoice, setMakeInvoice] = React.useState(true);
  const [applicants, setApplicants] = React.useState<ApplicantInput[]>([emptyApplicant()]);

  const selectedType = types.find(t => t.id === typeId) ?? null;

  const acctMatches = React.useMemo(() => {
    const q = customerName.trim().toLowerCase();
    return accounts.filter(a => !q || a.name.toLowerCase().includes(q)).slice(0, 6);
  }, [accounts, customerName]);

  const reset = () => {
    setStep(1); setTypeId(""); setEmirate("Dubai"); setPriority("medium");
    setCustomerName(""); setCustomerId(null); setAcctOpen(false); setAssignedTo("");
    setServiceFee(""); setGovtFee(""); setNotes(""); setMakeInvoice(true);
    setApplicants([emptyApplicant()]);
  };
  React.useEffect(() => { if (!open) reset(); }, [open]);

  // Seed from the CRM lead (or other caller) when the wizard opens with prefill.
  React.useEffect(() => {
    if (open && prefill) {
      if (prefill.customerName) setCustomerName(prefill.customerName);
      if (prefill.customerId !== undefined) setCustomerId(prefill.customerId ?? null);
      if (prefill.assignedTo) setAssignedTo(prefill.assignedTo);
      if (prefill.applicant) setApplicants([{ ...emptyApplicant(), ...prefill.applicant }]);
    }
  }, [open, prefill]);

  // Pre-fill fee fields from the selected visa type (still editable).
  React.useEffect(() => {
    if (selectedType) {
      setServiceFee(String(selectedType.defaultServiceFee));
      setGovtFee(String(selectedType.defaultGovtFee));
    }
  }, [typeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const step1Valid = !!typeId;
  const applicantsValid = applicants.length > 0 &&
    applicants.every(a => a.firstName.trim() && a.passportNumber.trim() && a.nationality.trim());

  const setApplicant = (i: number, patch: Partial<ApplicantInput>) =>
    setApplicants(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));

  const handleCreate = () => {
    if (!step1Valid || !applicantsValid) return;
    create.mutate({
      visaTypeId: typeId, emirate, priority,
      customerName: customerName.trim() || null,
      customerId,
      assignedTo: assignedTo.trim() || createdByName,
      serviceFee: parseFloat(serviceFee) || null,
      govtFee: parseFloat(govtFee) || null,
      notes: notes.trim() || null,
      applicants: applicants.map(a => ({
        ...a,
        firstName: a.firstName.trim(), lastName: a.lastName.trim(),
        nationality: a.nationality.trim(), passportNumber: a.passportNumber.trim(),
      })),
      createdByName,
    }, {
      onSuccess: (created) => {
        // Best-effort: raise the draft invoice; case creation is never blocked by it.
        if (makeInvoice && canInvoice) genInvoice.mutate(created);
        onClose();
      },
    });
  };

  const totalFees = (parseFloat(serviceFee) || 0) + (parseFloat(govtFee) || 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Visa Case</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Step {step} of 2 — {step === 1 ? "Visa type & details" : "Applicants"}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {step === 1 && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visa Type *</label>
                    <select value={typeId} onChange={e => setTypeId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select visa type…</option>
                      {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {selectedType && (
                    <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Processing time</span>
                        <span className="font-medium">~{selectedType.processingDays} days</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{selectedType.requiredDocuments.length} required documents per applicant — the checklist is generated automatically.</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emirate</label>
                      <select value={emirate} onChange={e => setEmirate(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                        {EMIRATES.map(e2 => <option key={e2} value={e2}>{e2}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</label>
                      <select value={priority} onChange={e => setPriority(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground capitalize focus:outline-none focus:ring-2 focus:ring-primary/30">
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5 relative col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account / Client</label>
                      <div className="relative">
                        <Input
                          value={customerName}
                          onChange={e => { setCustomerName(e.target.value); setCustomerId(null); setAcctOpen(true); }}
                          onFocus={() => setAcctOpen(true)}
                          onBlur={() => setTimeout(() => setAcctOpen(false), 120)}
                          placeholder="Search CRM accounts or type a client name…"
                          className={cn("h-9 text-sm", customerId && "pr-16")}
                        />
                        {customerId && (
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                              <Link2 className="h-2.5 w-2.5" />Linked
                            </span>
                            <button type="button" onMouseDown={e => { e.preventDefault(); setCustomerId(null); setCustomerName(""); }}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground" aria-label="Unlink account">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </div>
                      {acctOpen && acctMatches.length > 0 && (
                        <div className="absolute z-10 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                          {acctMatches.map(a => (
                            <button key={a.id} type="button"
                              onMouseDown={e => { e.preventDefault(); setCustomerId(a.id); setCustomerName(a.name); setAcctOpen(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate">{a.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assigned PRO</label>
                      <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder={createdByName || "PRO name…"} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service Fee ({currency})</label>
                      <Input type="number" min={0} value={serviceFee} onChange={e => setServiceFee(e.target.value)} className="h-9 text-sm text-right" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Govt Fee ({currency})</label>
                      <Input type="number" min={0} value={govtFee} onChange={e => setGovtFee(e.target.value)} className="h-9 text-sm text-right" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                      placeholder="Case background, sponsor details…"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                  </div>

                  {canInvoice && (
                    <button type="button" onClick={() => setMakeInvoice(v => !v)}
                      className="flex items-center gap-2.5 w-full text-left rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors">
                      <span className={cn("h-5 w-5 rounded flex items-center justify-center border shrink-0",
                        makeInvoice ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                        {makeInvoice && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="flex-1">
                        <span className="text-sm font-medium block">Create a draft invoice in Finance</span>
                        <span className="text-xs text-muted-foreground">Service + government fees as line items, linked to this case.</span>
                      </span>
                    </button>
                  )}
                </>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {applicants.map((a, i) => (
                    <div key={i} className="rounded-xl border border-border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <select value={a.relationship} onChange={e => setApplicant(i, { relationship: e.target.value })}
                          className="h-8 px-2 rounded-lg border border-border bg-card text-xs text-foreground capitalize focus:outline-none focus:ring-2 focus:ring-primary/30">
                          {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {applicants.length > 1 && (
                          <button onClick={() => setApplicants(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" aria-label="Remove applicant">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input value={a.firstName} onChange={e => setApplicant(i, { firstName: e.target.value })} placeholder="First name *" className="h-9 text-sm" />
                        <Input value={a.lastName} onChange={e => setApplicant(i, { lastName: e.target.value })} placeholder="Last name" className="h-9 text-sm" />
                        <Input value={a.nationality} onChange={e => setApplicant(i, { nationality: e.target.value })} placeholder="Nationality *" className="h-9 text-sm" />
                        <Input value={a.passportNumber} onChange={e => setApplicant(i, { passportNumber: e.target.value })} placeholder="Passport number *" className="h-9 text-sm font-mono" />
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase">Passport expiry</label>
                          <Input type="date" value={a.passportExpiry ?? ""} onChange={e => setApplicant(i, { passportExpiry: e.target.value || null })} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase">Date of birth</label>
                          <Input type="date" value={a.dateOfBirth ?? ""} onChange={e => setApplicant(i, { dateOfBirth: e.target.value || null })} className="h-9 text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full"
                    onClick={() => setApplicants(prev => [...prev, emptyApplicant(prev.length === 0 ? "primary" : "spouse")])}>
                    <Plus className="h-3.5 w-3.5" />Add dependent
                  </Button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
              {step === 1 ? (
                <Button variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Button>
              ) : (
                <Button variant="outline" onClick={() => setStep(1)} disabled={create.isPending} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />Back
                </Button>
              )}
              {step === 1 ? (
                <Button onClick={() => setStep(2)} disabled={!step1Valid} className="gap-1">
                  Applicants<ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleCreate} disabled={!applicantsValid || create.isPending} className="gap-1.5">
                  {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create Case — {formatCurrency(totalFees, currency)}
                </Button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
