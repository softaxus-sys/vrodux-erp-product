import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreatePurchaseVendor, useUpdatePurchaseVendor } from "@/hooks/purchase/use-vendors";
import type { VendorDto } from "@/lib/pos/types";

const CATEGORIES    = ["IT & Technology", "Construction Materials", "Office Supplies", "Professional Services", "Facilities", "Logistics", "Marketing", "Utilities", "Other"];
const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "Advance", "Cash on Delivery"];
const CURRENCIES    = ["PKR", "USD", "EUR", "GBP", "SAR", "AED"];

interface AddVendorFormProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the form runs in edit mode */
  vendor?: VendorDto | null;
}

export function AddVendorForm({ open, onClose, vendor }: AddVendorFormProps) {
  const isEdit = !!vendor;

  const [name, setName]               = React.useState("");
  const [code, setCode]               = React.useState("");
  const [category, setCategory]       = React.useState("");
  const [contactPerson, setContactPerson] = React.useState("");
  const [email, setEmail]             = React.useState("");
  const [phone, setPhone]             = React.useState("");
  const [address, setAddress]         = React.useState("");
  const [taxNumber, setTaxNumber]     = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("Net 30");
  const [currency, setCurrency]       = React.useState("PKR");
  const [notes, setNotes]             = React.useState("");

  const { mutate: createVendor, isPending: isCreating } = useCreatePurchaseVendor();
  const { mutate: updateVendor, isPending: isUpdating } = useUpdatePurchaseVendor();
  const isPending = isCreating || isUpdating;

  const isValid = name.trim().length > 0;

  // Populate form when editing
  React.useEffect(() => {
    if (vendor) {
      setName(vendor.name ?? "");
      setCode(vendor.code ?? "");
      setCategory(vendor.category ?? "");
      setContactPerson(vendor.contactPerson ?? "");
      setEmail(vendor.email ?? "");
      setPhone(vendor.phone ?? "");
      setAddress(vendor.address ?? "");
      setTaxNumber(vendor.taxNumber ?? "");
      setPaymentTerms(vendor.paymentTerms ?? "Net 30");
      setCurrency(vendor.currency ?? "PKR");
      setNotes(vendor.notes ?? "");
    }
  }, [vendor]);

  const reset = () => {
    setName(""); setCode(""); setCategory(""); setContactPerson("");
    setEmail(""); setPhone(""); setAddress(""); setTaxNumber("");
    setPaymentTerms("Net 30"); setCurrency("PKR"); setNotes("");
  };

  const handleClose = () => { if (!isEdit) reset(); onClose(); };

  React.useEffect(() => { if (!open && !isEdit) reset(); }, [open]);

  function handleSubmit() {
    const payload = {
      name:          name.trim(),
      code:          code.trim() || undefined,
      category:      category || undefined,
      contactPerson: contactPerson.trim() || undefined,
      email:         email.trim() || undefined,
      phone:         phone.trim() || undefined,
      address:       address.trim() || undefined,
      taxNumber:     taxNumber.trim() || undefined,
      paymentTerms,
      currency,
      notes:         notes.trim() || undefined,
    };

    if (isEdit && vendor) {
      updateVendor(
        { id: vendor.id, ...payload, status: vendor.status },
        { onSuccess: handleClose },
      );
    } else {
      createVendor(
        { ...payload, status: "active" },
        { onSuccess: handleClose },
      );
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">{isEdit ? "Edit Vendor" : "New Vendor"}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isEdit ? `Updating ${vendor?.name}` : "Register a new supplier or service provider"}
                </p>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Company Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Company Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company Name *</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Vendor company name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor Code</label>
                    <Input value={code} onChange={e => setCode(e.target.value)} placeholder="VND-001" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select…</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Person</label>
                    <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Primary contact…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@company.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92 3XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Building, street, city…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tax / NTN Number</label>
                    <Input value={taxNumber} onChange={e => setTaxNumber(e.target.value)} placeholder="0000000-0" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Financial Terms */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financial Terms</p>
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
                    <select value={currency} onChange={e => setCurrency(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Special terms, compliance notes, approved products…" rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!isValid || isPending}>
                {isPending
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Saving…</>
                  : isEdit ? "Save Changes" : "Save Vendor"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
