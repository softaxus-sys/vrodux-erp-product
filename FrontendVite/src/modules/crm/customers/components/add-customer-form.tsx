import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateCustomer, useUpdateCustomer } from "@/hooks/crm/use-crm";
import { useCurrency } from "@/hooks/use-currency";
import type { CustomerDto } from "@/lib/crm/crm.api";

const CUSTOMER_TYPES   = ["Individual", "Company", "Government", "SME", "Enterprise"];
const INDUSTRIES       = ["Real Estate", "Construction", "Technology", "Finance", "Healthcare", "Retail", "Hospitality", "Manufacturing", "Education", "Government", "Other"];
const PAYMENT_TERMS    = ["Net 15", "Net 30", "Net 45", "Net 60", "Cash on Delivery", "Advance"];

interface AddCustomerFormProps {
  open: boolean;
  onClose: () => void;
  editing?: CustomerDto | null;
}

export function AddCustomerForm({ open, onClose, editing }: AddCustomerFormProps) {
  const isEdit = !!editing;
  const [customerType, setCustomerType] = React.useState("Company");
  const [name, setName]                 = React.useState("");
  const [contactPerson, setContactPerson] = React.useState("");
  const [email, setEmail]               = React.useState("");
  const [phone, setPhone]               = React.useState("");
  const [industry, setIndustry]         = React.useState("");
  const [website, setWebsite]           = React.useState("");
  const [trn, setTrn]                   = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("Net 30");
  const [creditLimit, setCreditLimit]   = React.useState("");
  const currency = useCurrency();
  const [address, setAddress]           = React.useState("");
  const [city, setCity]                 = React.useState("Dubai");
  const [country, setCountry]           = React.useState("UAE");
  const [assignedTo, setAssignedTo]     = React.useState("");
  const [notes, setNotes]               = React.useState("");

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const saving = createCustomer.isPending || updateCustomer.isPending;
  const isValid = name.trim() && email.trim();

  React.useEffect(() => {
    if (open && editing) {
      setName(editing.name); setEmail(editing.email); setPhone(editing.phone);
      setIndustry(editing.industry); setWebsite(editing.website ?? "");
      setAddress(editing.address); setCity(editing.city); setCountry(editing.country);
      setAssignedTo(editing.accountManager); setNotes(editing.description);
    }
  }, [open, editing]);

  const handleSave = () => {
    if (!isValid) return;
    const description = [notes, contactPerson && `Contact: ${contactPerson}`, trn && `TRN: ${trn}`].filter(Boolean).join(" · ");
    if (isEdit && editing) {
      updateCustomer.mutate({ id: editing.id, data: {
        name: name.trim(), industry, country, city, address: address.trim(),
        phone: phone.trim(), email: email.trim(), status: editing.status, tier: editing.tier,
        accountManager: assignedTo.trim(), description, website: website.trim() || null,
        tradeName: editing.tradeName ?? null, employees: editing.employees ?? null,
        npsScore: editing.npsScore ?? null, contractRenewal: editing.contractRenewal ?? null, tags: editing.tags,
      } }, { onSuccess: onClose });
    } else {
      createCustomer.mutate({
        name: name.trim(), industry, country, city, address: address.trim(),
        phone: phone.trim(), email: email.trim(), tier: "standard",
        accountManager: assignedTo.trim(), description,
      }, { onSuccess: onClose });
    }
  };

  const reset = () => {
    setCustomerType("Company"); setName(""); setContactPerson(""); setEmail(""); setPhone("");
    setIndustry(""); setWebsite(""); setTrn(""); setPaymentTerms("Net 30"); setCreditLimit("");
    setAddress(""); setCity("Dubai"); setCountry("UAE"); setAssignedTo(""); setNotes("");
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
                <h2 className="text-base font-bold text-foreground">{isEdit ? "Edit Customer" : "New Customer"}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{isEdit ? "Update account details" : "Add a new customer account"}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Type selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer Type</label>
                <div className="flex gap-2 flex-wrap">
                  {CUSTOMER_TYPES.map(t => (
                    <button key={t} onClick={() => setCustomerType(t)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        customerType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Basic Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {customerType === "Individual" ? "Full Name *" : "Company Name *"}
                    </label>
                    <Input value={name} onChange={e => setName(e.target.value)}
                      placeholder={customerType === "Individual" ? "John Smith" : "Company Ltd."} className="h-9 text-sm" />
                  </div>
                  {customerType !== "Individual" && (
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Person</label>
                      <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Primary contact name…" className="h-9 text-sm" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@company.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Industry</label>
                    <select value={industry} onChange={e => setIndustry(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select…</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Website</label>
                    <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TRN (VAT No.)</label>
                    <Input value={trn} onChange={e => setTrn(e.target.value)} placeholder="100XXXXXXXXX003" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Financial */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financial Settings</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Terms</label>
                    <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</label>
                    <div className="w-full h-9 px-3 inline-flex items-center rounded-lg border border-border bg-muted text-sm font-medium text-muted-foreground">
                      {currency}
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Credit Limit ({currency})</label>
                    <Input type="number" min={0} step={1000} value={creditLimit} onChange={e => setCreditLimit(e.target.value)}
                      placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Address</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Street Address</label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Building, street…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">City</label>
                    <Input value={city} onChange={e => setCity(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Country</label>
                    <Input value={country} onChange={e => setCountry(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Assign & Notes */}
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account Manager</label>
                  <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Assigned sales rep…" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Background, special terms, referral source…" rows={2}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={!isValid || saving}>
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Save Customer"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

