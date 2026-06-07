import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];

interface AddSiteFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddSiteForm({ open, onClose }: AddSiteFormProps) {
  const [name, setName]                         = React.useState("");
  const [projectName, setProjectName]           = React.useState("");
  const [address, setAddress]                   = React.useState("");
  const [city, setCity]                         = React.useState("");
  const [emirate, setEmirate]                   = React.useState("Dubai");
  const [area, setArea]                         = React.useState("");
  const [siteManager, setSiteManager]           = React.useState("");
  const [siteManagerPhone, setSiteManagerPhone] = React.useState("");
  const [safetyOfficer, setSafetyOfficer]       = React.useState("");
  const [safetyOfficerPhone, setSafetyOfficerPhone] = React.useState("");
  const [startDate, setStartDate]               = React.useState("");
  const [maxWorkers, setMaxWorkers]             = React.useState("");
  const [currentWorkers, setCurrentWorkers]     = React.useState("0");
  const [permitNumber, setPermitNumber]         = React.useState("");
  const [permitExpiry, setPermitExpiry]         = React.useState("");
  const [notes, setNotes]                       = React.useState("");

  const permitExpiryWarning = React.useMemo(() => {
    if (!permitExpiry) return false;
    const diff = new Date(permitExpiry).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  }, [permitExpiry]);

  const isValid = name.trim() && projectName.trim() && startDate;

  const reset = () => {
    setName(""); setProjectName(""); setAddress(""); setCity(""); setEmirate("Dubai");
    setArea(""); setSiteManager(""); setSiteManagerPhone(""); setSafetyOfficer(""); setSafetyOfficerPhone("");
    setStartDate(""); setMaxWorkers(""); setCurrentWorkers("0");
    setPermitNumber(""); setPermitExpiry(""); setNotes("");
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
                <h2 className="text-base font-bold text-foreground">Add Construction Site</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Register a new active construction site</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Site Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Site Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Site Name *</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Marina Tower Site A" className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Associated Project *</label>
                    <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project name…" className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address…" className="h-9 text-sm" />
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Site Area (sqm)</label>
                    <Input type="number" min={0} value={area} onChange={e => setArea(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date *</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Personnel */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Site Personnel</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Site Manager</label>
                    <Input value={siteManager} onChange={e => setSiteManager(e.target.value)} placeholder="Full name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manager Phone</label>
                    <Input value={siteManagerPhone} onChange={e => setSiteManagerPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Safety Officer</label>
                    <Input value={safetyOfficer} onChange={e => setSafetyOfficer(e.target.value)} placeholder="Full name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Officer Phone</label>
                    <Input value={safetyOfficerPhone} onChange={e => setSafetyOfficerPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Workforce */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Workforce Capacity</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Max Workers</label>
                    <Input type="number" min={0} value={maxWorkers} onChange={e => setMaxWorkers(e.target.value)} placeholder="0" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Workers</label>
                    <Input type="number" min={0} value={currentWorkers} onChange={e => setCurrentWorkers(e.target.value)} placeholder="0" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Permit */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Permit Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Permit Number</label>
                    <Input value={permitNumber} onChange={e => setPermitNumber(e.target.value)} placeholder="PMT-XXXXXXXX" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Permit Expiry</label>
                    <Input type="date" value={permitExpiry} onChange={e => setPermitExpiry(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
                {permitExpiryWarning && (
                  <div className="flex items-center gap-2 mt-2 bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Permit expires within 30 days — renewal recommended.
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Site conditions, access restrictions, hazards…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Register Site</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

