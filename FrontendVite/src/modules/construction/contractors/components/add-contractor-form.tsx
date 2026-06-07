import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TRADES = [
  "Civil", "MEP", "Structural", "Finishing", "Landscaping",
  "HVAC", "Electrical", "Plumbing", "IT Infrastructure", "Safety",
];
const TRADE_VALUES = [
  "civil", "mep", "structural", "finishing", "landscaping",
  "hvac", "electrical", "plumbing", "it_infra", "safety",
];
const CATEGORIES    = ["Subcontractor", "Main Contractor", "Specialist", "Consultant", "Supplier"];
const PAYMENT_TERMS = ["Net 30", "Net 45", "Net 60", "Net 90", "COD"];
const CURRENCIES    = ["AED", "USD", "EUR"];
const EMIRATES      = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];

interface AddContractorFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddContractorForm({ open, onClose }: AddContractorFormProps) {
  const [selectedTrades, setSelectedTrades]     = React.useState<string[]>([]);
  const [category, setCategory]                 = React.useState("Subcontractor");
  const [companyName, setCompanyName]           = React.useState("");
  const [tradeName, setTradeName]               = React.useState("");
  const [contactPerson, setContactPerson]       = React.useState("");
  const [email, setEmail]                       = React.useState("");
  const [phone, setPhone]                       = React.useState("");
  const [website, setWebsite]                   = React.useState("");
  const [city, setCity]                         = React.useState("");
  const [emirate, setEmirate]                   = React.useState("Dubai");
  const [licenseNumber, setLicenseNumber]       = React.useState("");
  const [licenseExpiry, setLicenseExpiry]       = React.useState("");
  const [insuranceProvider, setInsuranceProvider] = React.useState("");
  const [insuranceExpiry, setInsuranceExpiry]   = React.useState("");
  const [paymentTerms, setPaymentTerms]         = React.useState("Net 30");
  const [currency, setCurrency]                 = React.useState("AED");
  const [creditLimit, setCreditLimit]           = React.useState("");
  const [bankName, setBankName]                 = React.useState("");
  const [iban, setIban]                         = React.useState("");
  const [notes, setNotes]                       = React.useState("");

  const toggleTrade = (t: string) =>
    setSelectedTrades(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const isValid = companyName.trim() && email.trim() && selectedTrades.length > 0;

  const reset = () => {
    setSelectedTrades([]); setCategory("Subcontractor"); setCompanyName(""); setTradeName("");
    setContactPerson(""); setEmail(""); setPhone(""); setWebsite(""); setCity(""); setEmirate("Dubai");
    setLicenseNumber(""); setLicenseExpiry(""); setInsuranceProvider(""); setInsuranceExpiry("");
    setPaymentTerms("Net 30"); setCurrency("AED"); setCreditLimit(""); setBankName(""); setIban(""); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

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
                <h2 className="text-base font-bold text-foreground">Add Contractor</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Register a new construction contractor</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Trades */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trade Specializations *</label>
                <div className="flex flex-wrap gap-1.5">
                  {TRADES.map((t, i) => (
                    <button key={t} onClick={() => toggleTrade(TRADE_VALUES[i])}
                      className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                        selectedTrades.includes(TRADE_VALUES[i])
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c} onClick={() => setCategory(c)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        category === c ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{c}</button>
                  ))}
                </div>
              </div>

              {/* Company Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Company Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company Name *</label>
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Registered company name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trade Name</label>
                    <Input value={tradeName} onChange={e => setTradeName(e.target.value)} placeholder="DBA / trade name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Person</label>
                    <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Primary contact…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@contractor.ae" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Website</label>
                    <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">City</label>
                    <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emirate</label>
                    <select value={emirate} onChange={e => setEmirate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {EMIRATES.map(em => <option key={em}>{em}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* License & Insurance */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">License & Insurance</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">License No.</label>
                    <Input value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="LIC-XXXXXXXX" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">License Expiry</label>
                    <Input type="date" value={licenseExpiry} onChange={e => setLicenseExpiry(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Insurance Provider</label>
                    <Input value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)} placeholder="Provider name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Insurance Expiry</label>
                    <Input type="date" value={insuranceExpiry} onChange={e => setInsuranceExpiry(e.target.value)} className="h-9 text-sm" />
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
                      {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
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
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Credit Limit</label>
                    <Input type="number" min={0} step={10000} value={creditLimit} onChange={e => setCreditLimit(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Name</label>
                    <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">IBAN</label>
                    <Input value={iban} onChange={e => setIban(e.target.value)} placeholder="AE XX XXXX…" className="h-9 text-sm font-mono" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Past performance, references, special conditions…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Save Contractor</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

