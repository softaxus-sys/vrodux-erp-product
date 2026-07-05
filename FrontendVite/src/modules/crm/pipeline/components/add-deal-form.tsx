import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateDeal, useUpdateDeal, useCustomers } from "@/hooks/crm/use-crm";
import { useCurrency } from "@/hooks/use-currency";
import { Building2, Link2, X as XIcon } from "lucide-react";
import type { DealDto } from "@/lib/crm/crm.api";

const PIPELINE_STAGES = ["Qualified", "Proposal Sent", "Negotiation", "Contract Review", "Closed Won", "Closed Lost"];
const STAGE_KEY: Record<string, string> = {
  "Qualified": "qualified", "Proposal Sent": "proposal", "Negotiation": "negotiation",
  "Contract Review": "negotiation", "Closed Won": "won", "Closed Lost": "lost",
};
const KEY_LABEL: Record<string, string> = {
  lead: "Qualified", qualified: "Qualified", proposal: "Proposal Sent",
  negotiation: "Negotiation", won: "Closed Won", lost: "Closed Lost",
};
const DEAL_TYPES      = ["New Business", "Upsell", "Renewal", "Cross-sell", "Partnership"];
const PROBABILITIES   = ["10%", "25%", "50%", "75%", "90%", "100%"];
const FORECASTS       = [
  { value: "auto",      label: "Auto (from stage)" },
  { value: "pipeline",  label: "Pipeline" },
  { value: "best_case", label: "Best case" },
  { value: "commit",    label: "Commit" },
];
const MANUAL_FORECASTS = ["pipeline", "best_case", "commit"];

interface AddDealFormProps {
  open: boolean;
  onClose: () => void;
  editing?: DealDto | null;
}

export function AddDealForm({ open, onClose, editing }: AddDealFormProps) {
  const isEdit = !!editing;
  const [dealName, setDealName]       = React.useState("");
  const [company, setCompany]         = React.useState("");
  const [customerId, setCustomerId]   = React.useState<string | null>(null);
  const [acctOpen, setAcctOpen]       = React.useState(false);
  const [contactName, setContactName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [stage, setStage]             = React.useState("Qualified");
  const [dealType, setDealType]       = React.useState("New Business");
  const [value, setValue]             = React.useState("");
  const [probability, setProbability] = React.useState("50%");
  const currency = useCurrency();
  const [forecast, setForecast]       = React.useState("auto");
  const [closeDate, setCloseDate]     = React.useState("");
  const [assignedTo, setAssignedTo]   = React.useState("");
  const [description, setDescription] = React.useState("");

  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const { data: accounts = [] } = useCustomers();
  const saving = createDeal.isPending || updateDeal.isPending;
  const isValid = dealName.trim() && company.trim() && value && closeDate;

  const acctMatches = React.useMemo(() => {
    const q = company.trim().toLowerCase();
    return accounts
      .filter(a => !q || a.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [accounts, company]);

  const pickAccount = (a: { id: string; name: string }) => {
    setCustomerId(a.id); setCompany(a.name); setAcctOpen(false);
  };
  const clearAccount = () => { setCustomerId(null); setCompany(""); };

  React.useEffect(() => {
    if (open && editing) {
      setDealName(editing.title); setCompany(editing.company); setCustomerId(editing.customerId ?? null); setValue(String(editing.value || ""));
      setStage(KEY_LABEL[editing.stage] ?? "Qualified"); setDealType(editing.source || "New Business");
      setProbability(`${editing.probability}%`); setCloseDate(editing.expectedCloseDate);
      setForecast(MANUAL_FORECASTS.includes(editing.forecastCategory) ? editing.forecastCategory : "auto");
      setAssignedTo(editing.assignedTo); setDescription(editing.description);
    }
  }, [open, editing]);

  const handleSave = () => {
    if (!isValid) return;
    const base = {
      title: dealName.trim(), company: company.trim(), value: parseFloat(value) || 0,
      stage: STAGE_KEY[stage] ?? "qualified", priority: editing?.priority ?? "medium",
      probability: parseInt(probability, 10) || 50, expectedCloseDate: closeDate,
      assignedTo: assignedTo.trim(), source: dealType, industry: editing?.industry ?? "",
      description: description.trim(),
      forecastCategory: forecast === "auto" ? undefined : forecast,
      customerId: customerId ?? null,
    };
    if (isEdit && editing) {
      updateDeal.mutate({ id: editing.id, data: { ...base, nextAction: editing.nextAction ?? null, nextActionDate: editing.nextActionDate ?? null, tags: editing.tags } }, { onSuccess: onClose });
    } else {
      createDeal.mutate(base, { onSuccess: onClose });
    }
  };

  const reset = () => {
    setDealName(""); setCompany(""); setCustomerId(null); setAcctOpen(false); setContactName(""); setContactEmail("");
    setStage("Qualified"); setDealType("New Business"); setValue("");
    setProbability("50%"); setForecast("auto"); setCloseDate(""); setAssignedTo(""); setDescription("");
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
                <h2 className="text-base font-bold text-foreground">{isEdit ? "Edit Deal" : "New Deal"}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{isEdit ? "Update deal details" : "Add a deal to your sales pipeline"}</p>
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
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account / Company *</label>
                  <div className="relative">
                    <Input
                      value={company}
                      onChange={e => { setCompany(e.target.value); setCustomerId(null); setAcctOpen(true); }}
                      onFocus={() => setAcctOpen(true)}
                      onBlur={() => setTimeout(() => setAcctOpen(false), 120)}
                      placeholder="Search accounts or type a new one…"
                      className={`h-9 text-sm ${customerId ? "pr-16" : ""}`}
                    />
                    {customerId && (
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                          <Link2 className="h-2.5 w-2.5" />Linked
                        </span>
                        <button type="button" onMouseDown={e => { e.preventDefault(); clearAccount(); }}
                          className="p-0.5 rounded hover:bg-muted text-muted-foreground" aria-label="Unlink account">
                          <XIcon className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                  {acctOpen && acctMatches.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                      {acctMatches.map(a => (
                        <button key={a.id} type="button" onMouseDown={e => { e.preventDefault(); pickAccount(a); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{a.name}</span>
                          {a.industry && <span className="ml-auto text-[11px] text-muted-foreground truncate">{a.industry}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!customerId && company.trim() && (
                    <p className="text-[11px] text-muted-foreground">New account — won't be linked to an existing customer.</p>
                  )}
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
                    <span className="h-9 px-3 inline-flex items-center rounded-lg border border-border bg-muted text-sm font-medium text-muted-foreground shrink-0">
                      {currency}
                    </span>
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
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Forecast Category</label>
                  <select value={forecast} onChange={e => setForecast(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {FORECASTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
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
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={!isValid || saving}>
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Deal"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

