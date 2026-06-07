"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const VENDOR_TYPES    = ["Supplier", "Contractor", "Service Provider", "Consultant", "Manufacturer", "Distributor"];
const CATEGORIES      = ["IT & Technology", "Construction Materials", "Office Supplies", "Professional Services", "Facilities", "Logistics", "Marketing", "Utilities", "Other"];
const PAYMENT_TERMS   = ["Net 15", "Net 30", "Net 45", "Net 60", "Advance", "Cash on Delivery"];
const CURRENCIES      = ["AED", "USD", "EUR", "GBP", "SAR", "INR"];
const COUNTRIES       = ["UAE", "India", "Pakistan", "UK", "USA", "Saudi Arabia", "Egypt", "China", "Germany", "Other"];

interface AddVendorFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddVendorForm({ open, onClose }: AddVendorFormProps) {
  const [vendorType, setVendorType]     = React.useState("Supplier");
  const [companyName, setCompanyName]   = React.useState("");
  const [contactPerson, setContactPerson] = React.useState("");
  const [email, setEmail]               = React.useState("");
  const [phone, setPhone]               = React.useState("");
  const [category, setCategory]         = React.useState("");
  const [website, setWebsite]           = React.useState("");
  const [trn, setTrn]                   = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("Net 30");
  const [currency, setCurrency]         = React.useState("AED");
  const [creditLimit, setCreditLimit]   = React.useState("");
  const [address, setAddress]           = React.useState("");
  const [city, setCity]                 = React.useState("");
  const [country, setCountry]           = React.useState("UAE");
  const [bankName, setBankName]         = React.useState("");
  const [iban, setIban]                 = React.useState("");
  const [notes, setNotes]               = React.useState("");

  const isValid = companyName.trim() && email.trim();

  const reset = () => {
    setVendorType("Supplier"); setCompanyName(""); setContactPerson(""); setEmail(""); setPhone("");
    setCategory(""); setWebsite(""); setTrn(""); setPaymentTerms("Net 30"); setCurrency("AED");
    setCreditLimit(""); setAddress(""); setCity(""); setCountry("UAE");
    setBankName(""); setIban(""); setNotes("");
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
                <h2 className="text-base font-bold text-foreground">New Vendor</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Register a new supplier or service provider</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor Type</label>
                <div className="flex gap-2 flex-wrap">
                  {VENDOR_TYPES.map(t => (
                    <button key={t} onClick={() => setVendorType(t)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        vendorType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Company Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Company Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company Name *</label>
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Vendor company name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Person</label>
                    <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Primary contact…" className="h-9 text-sm" />
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
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@company.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
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
                    <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Dubai" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Country</label>
                    <select value={country} onChange={e => setCountry(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bank Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Name</label>
                    <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Emirates NBD, ADCB…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">IBAN</label>
                    <Input value={iban} onChange={e => setIban(e.target.value)} placeholder="AE XX XXXX XXXX XXXX XXXX XXX" className="h-9 text-sm font-mono" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Special terms, compliance notes, approved products…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Save Vendor</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
