"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TENANT_TYPES   = ["Individual", "Company"];
const NATIONALITIES  = ["UAE", "Indian", "Pakistani", "Filipino", "Egyptian", "British", "American", "European", "Other"];

interface AddTenantFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddTenantForm({ open, onClose }: AddTenantFormProps) {
  const [tenantType, setTenantType]   = React.useState("Individual");
  const [name, setName]               = React.useState("");
  const [email, setEmail]             = React.useState("");
  const [phone, setPhone]             = React.useState("");
  const [nationality, setNationality] = React.useState("");
  const [emiratesId, setEmiratesId]   = React.useState("");
  const [passportNo, setPassportNo]   = React.useState("");
  const [company, setCompany]         = React.useState("");
  const [trn, setTrn]                 = React.useState("");
  const [occupation, setOccupation]   = React.useState("");
  const [monthlyIncome, setMonthlyIncome] = React.useState("");
  const [emergencyContact, setEmergencyContact] = React.useState("");
  const [notes, setNotes]             = React.useState("");

  const isValid = name.trim() && email.trim() && phone.trim();

  const reset = () => {
    setTenantType("Individual"); setName(""); setEmail(""); setPhone(""); setNationality("");
    setEmiratesId(""); setPassportNo(""); setCompany(""); setTrn(""); setOccupation("");
    setMonthlyIncome(""); setEmergencyContact(""); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Tenant</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Register a new tenant profile</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tenant Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {TENANT_TYPES.map(t => (
                    <button key={t} onClick={() => setTenantType(t)}
                      className={`py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                        tenantType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Personal Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contact Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Name *</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Tenant full name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone *</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nationality</label>
                    <select value={nationality} onChange={e => setNationality(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select…</option>
                      {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Occupation</label>
                    <Input value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="Job title / profession…" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Documents</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emirates ID</label>
                    <Input value={emiratesId} onChange={e => setEmiratesId(e.target.value)} placeholder="784-XXXX-XXXXXXX-X" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Passport No.</label>
                    <Input value={passportNo} onChange={e => setPassportNo(e.target.value)} placeholder="A12345678" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monthly Income (AED)</label>
                    <Input type="number" min={0} step={1000} value={monthlyIncome} onChange={e => setMonthlyIncome(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact</label>
                    <Input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {tenantType === "Company" && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Company Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company Name</label>
                      <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company Ltd." className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TRN</label>
                      <Input value={trn} onChange={e => setTrn(e.target.value)} placeholder="100XXXXXXXXX003" className="h-9 text-sm" />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="References, special requirements…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Save Tenant</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
