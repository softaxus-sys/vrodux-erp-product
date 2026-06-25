import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateBroker } from "@/hooks/real-estate/use-re";

const BROKER_TYPES   = ["Individual Agent", "Agency / Company", "Developer Rep", "Corporate Broker"];
const SPECIALIZATIONS = ["Residential Sales", "Commercial Sales", "Residential Leasing", "Commercial Leasing", "Off-Plan", "Property Management", "Industrial"];
const LANGUAGES      = ["English", "Arabic", "Hindi", "Urdu", "Filipino", "Russian", "French", "Chinese"];

interface AddBrokerFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddBrokerForm({ open, onClose }: AddBrokerFormProps) {
  const createBroker = useCreateBroker();
  const [brokerType, setBrokerType]     = React.useState("Individual Agent");
  const [name, setName]                 = React.useState("");
  const [company, setCompany]           = React.useState("");
  const [email, setEmail]               = React.useState("");
  const [phone, setPhone]               = React.useState("");
  const [reraNo, setReraNo]             = React.useState("");
  const [reraExpiry, setReraExpiry]     = React.useState("");
  const [specialization, setSpecialization] = React.useState<string[]>([]);
  const [languages, setLanguages]       = React.useState<string[]>(["English"]);
  const [commissionRate, setCommissionRate] = React.useState("2");
  const [notes, setNotes]               = React.useState("");

  const toggleSpec = (s: string) => setSpecialization(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleLang = (l: string) => setLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);

  const isValid = name.trim() && email.trim() && reraNo.trim();

  const reset = () => {
    setBrokerType("Individual Agent"); setName(""); setCompany(""); setEmail(""); setPhone("");
    setReraNo(""); setReraExpiry(""); setSpecialization([]); setLanguages(["English"]);
    setCommissionRate("2"); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSave = async () => {
    try {
      await createBroker.mutateAsync({
        name, brokerType: brokerType.toLowerCase().replace(' / ', '_').replace(' ', '_'),
        company: company.trim() || undefined, email, phone, reraNo, reraExpiry: reraExpiry || undefined,
        specialization, languages, commissionRate: parseFloat(commissionRate) || 2,
        notes: notes.trim() || undefined, status: 'active',
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
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Broker</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Register a real estate broker or agent</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Broker Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {BROKER_TYPES.map(t => (
                    <button key={t} onClick={() => setBrokerType(t)}
                      className={`py-2 rounded-lg border-2 text-xs font-medium text-left px-3 transition-all ${
                        brokerType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contact Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Name *</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Broker full name…" className="h-9 text-sm" />
                  </div>
                  {brokerType !== "Individual Agent" && (
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agency / Company</label>
                      <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Agency name…" className="h-9 text-sm" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="broker@agency.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* RERA */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">RERA License</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">RERA No. *</label>
                    <Input value={reraNo} onChange={e => setReraNo(e.target.value)} placeholder="RERA-XXXXXX" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">RERA Expiry</label>
                    <Input type="date" value={reraExpiry} onChange={e => setReraExpiry(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission Rate (%)</label>
                    <Input type="number" min={0} max={10} step={0.25} value={commissionRate} onChange={e => setCommissionRate(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Specializations */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Specializations</label>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALIZATIONS.map(s => (
                    <button key={s} onClick={() => toggleSpec(s)}
                      className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                        specialization.includes(s) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Languages</label>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map(l => (
                    <button key={l} onClick={() => toggleLang(l)}
                      className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                        languages.includes(l) ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground hover:border-success/30"
                      }`}>{l}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Areas of expertise, track record, references…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={!isValid || createBroker.isPending}>Save Broker</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

