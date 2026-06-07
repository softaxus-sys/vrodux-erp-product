"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LEAD_SOURCES = ["Website", "LinkedIn", "Referral", "Cold Call", "Email Campaign", "Trade Show", "Social Media", "Walk-In", "Partner", "Other"];
const INDUSTRIES   = ["Real Estate", "Construction", "Technology", "Finance", "Healthcare", "Retail", "Hospitality", "Manufacturing", "Education", "Government", "Other"];
const LEAD_STAGES  = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation"];
const PRIORITIES   = ["Low", "Medium", "High", "Urgent"];
const CURRENCIES   = ["AED", "USD", "EUR", "GBP", "SAR"];

interface AddLeadFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddLeadForm({ open, onClose }: AddLeadFormProps) {
  const [firstName, setFirstName]     = React.useState("");
  const [lastName, setLastName]       = React.useState("");
  const [email, setEmail]             = React.useState("");
  const [phone, setPhone]             = React.useState("");
  const [company, setCompany]         = React.useState("");
  const [jobTitle, setJobTitle]       = React.useState("");
  const [industry, setIndustry]       = React.useState("");
  const [source, setSource]           = React.useState("Website");
  const [stage, setStage]             = React.useState("New");
  const [priority, setPriority]       = React.useState("Medium");
  const [dealValue, setDealValue]     = React.useState("");
  const [currency, setCurrency]       = React.useState("AED");
  const [assignedTo, setAssignedTo]   = React.useState("");
  const [expectedClose, setExpectedClose] = React.useState("");
  const [notes, setNotes]             = React.useState("");

  const isValid = firstName.trim() && (email.trim() || phone.trim()) && source;

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    setCompany(""); setJobTitle(""); setIndustry(""); setSource("Website");
    setStage("New"); setPriority("Medium"); setDealValue(""); setCurrency("AED");
    setAssignedTo(""); setExpectedClose(""); setNotes("");
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
                <h2 className="text-base font-bold text-foreground">New Lead</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Capture a new sales lead</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Contact */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contact Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">First Name *</label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Name</label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</label>
                    <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Title</label>
                    <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="CEO, Manager…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Industry</label>
                    <select value={industry} onChange={e => setIndustry(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select industry…</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Lead Details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Lead Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead Source *</label>
                    <select value={source} onChange={e => setSource(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stage</label>
                    <select value={stage} onChange={e => setStage(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</label>
                    <select value={priority} onChange={e => setPriority(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expected Close</label>
                    <Input type="date" value={expectedClose} onChange={e => setExpectedClose(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deal Value</label>
                    <div className="flex gap-2">
                      <select value={currency} onChange={e => setCurrency(e.target.value)}
                        className="h-9 px-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <Input type="number" min={0} step={1000} value={dealValue} onChange={e => setDealValue(e.target.value)}
                        placeholder="0.00" className="h-9 text-sm flex-1 text-right" />
                    </div>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assigned To</label>
                    <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Sales rep name…" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Initial contact notes, requirements, next steps…" rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Save Lead</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
