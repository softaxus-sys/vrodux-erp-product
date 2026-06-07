"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PIPELINE_STAGES = ["Qualified", "Proposal Sent", "Negotiation", "Contract Review", "Closed Won", "Closed Lost"];
const DEAL_TYPES      = ["New Business", "Upsell", "Renewal", "Cross-sell", "Partnership"];
const CURRENCIES      = ["AED", "USD", "EUR", "GBP", "SAR"];
const PROBABILITIES   = ["10%", "25%", "50%", "75%", "90%", "100%"];

interface AddDealFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddDealForm({ open, onClose }: AddDealFormProps) {
  const [dealName, setDealName]       = React.useState("");
  const [company, setCompany]         = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [stage, setStage]             = React.useState("Qualified");
  const [dealType, setDealType]       = React.useState("New Business");
  const [value, setValue]             = React.useState("");
  const [currency, setCurrency]       = React.useState("AED");
  const [probability, setProbability] = React.useState("50%");
  const [closeDate, setCloseDate]     = React.useState("");
  const [assignedTo, setAssignedTo]   = React.useState("");
  const [description, setDescription] = React.useState("");

  const isValid = dealName.trim() && company.trim() && value && closeDate;

  const reset = () => {
    setDealName(""); setCompany(""); setContactName(""); setContactEmail("");
    setStage("Qualified"); setDealType("New Business"); setValue(""); setCurrency("AED");
    setProbability("50%"); setCloseDate(""); setAssignedTo(""); setDescription("");
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
                <h2 className="text-base font-bold text-foreground">New Deal</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Add a deal to your sales pipeline</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Deal Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deal Name *</label>
                  <Input value={dealName} onChange={e => setDealName(e.target.value)} placeholder="e.g. Enterprise License — TechCorp" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company *</label>
                  <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Client company…" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deal Type</label>
                  <select value={dealType} onChange={e => setDealType(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Name</label>
                  <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Primary contact…" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Email</label>
                  <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@client.com" className="h-9 text-sm" />
                </div>
              </div>

              {/* Pipeline */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pipeline Stage</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {PIPELINE_STAGES.map(s => (
                    <button key={s} onClick={() => setStage(s)}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                        stage === s ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Value & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deal Value *</label>
                  <div className="flex gap-2">
                    <select value={currency} onChange={e => setCurrency(e.target.value)}
                      className="h-9 px-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <Input type="number" min={0} step={1000} value={value} onChange={e => setValue(e.target.value)}
                      placeholder="0.00" className="h-9 text-sm flex-1 text-right font-semibold" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Close Date *</label>
                  <Input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Win Probability</label>
                  <select value={probability} onChange={e => setProbability(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {PROBABILITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assigned To</label>
                  <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Sales representative…" className="h-9 text-sm" />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Deal background, requirements, key stakeholders…" rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Create Deal</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
