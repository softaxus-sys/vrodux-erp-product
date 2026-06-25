import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateProject } from "@/hooks/construction/use-construction";

const PROJECT_TYPES = ["Residential", "Commercial", "Infrastructure", "Industrial"];
const STATUSES      = ["Planning", "In Progress", "On Hold"];
const EMIRATES      = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];
const CURRENCIES    = ["AED", "USD", "EUR"];

interface Phase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface AddProjectFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddProjectForm({ open, onClose }: AddProjectFormProps) {
  const createProject = useCreateProject();
  const [projectType, setProjectType]   = React.useState("Residential");
  const [status, setStatus]             = React.useState("Planning");
  const [name, setName]                 = React.useState("");
  const [client, setClient]             = React.useState("");
  const [location, setLocation]         = React.useState("");
  const [emirate, setEmirate]           = React.useState("Dubai");
  const [projectManager, setProjectManager] = React.useState("");
  const [siteEngineer, setSiteEngineer] = React.useState("");
  const [startDate, setStartDate]       = React.useState("");
  const [endDate, setEndDate]           = React.useState("");
  const [currency, setCurrency]         = React.useState("AED");
  const [contractValue, setContractValue] = React.useState("");
  const [workers, setWorkers]           = React.useState("");
  const [phases, setPhases]             = React.useState<Phase[]>([
    { id: "1", name: "", startDate: "", endDate: "" },
  ]);
  const [notes, setNotes]               = React.useState("");

  const addPhase = () => setPhases(prev => [...prev, { id: Date.now().toString(), name: "", startDate: "", endDate: "" }]);
  const removePhase = (id: string) => setPhases(prev => prev.filter(p => p.id !== id));
  const updatePhase = (id: string, field: keyof Phase, value: string) =>
    setPhases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));

  const isValid = name.trim() && client.trim() && startDate && endDate && contractValue;

  const reset = () => {
    setProjectType("Residential"); setStatus("Planning"); setName(""); setClient("");
    setLocation(""); setEmirate("Dubai"); setProjectManager(""); setSiteEngineer("");
    setStartDate(""); setEndDate(""); setCurrency("AED"); setContractValue("");
    setWorkers(""); setPhases([{ id: "1", name: "", startDate: "", endDate: "" }]); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleCreate = async (status_: string) => {
    try {
      await createProject.mutateAsync({
        name, type: projectType.toLowerCase(), status: status_.toLowerCase().replace(' ', '_'),
        clientName: client, location, emirate, startDate, endDate,
        budget: parseFloat(contractValue) || 0, currency, workers: parseInt(workers) || 0,
        projectManager, siteEngineer, notes: notes.trim() || undefined,
        phases: phases.filter(p => p.name.trim()),
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
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Project</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Create a new construction project</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {PROJECT_TYPES.map(t => (
                    <button key={t} onClick={() => setProjectType(t)}
                      className={`py-2 rounded-lg border-2 text-xs font-medium text-left px-3 transition-all ${
                        projectType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Initial Status</label>
                <div className="flex gap-2">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => setStatus(s)}
                      className={`flex-1 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        status === s ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Basic Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Project Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Name *</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Al Barsha Residential Tower" className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client / Owner *</label>
                    <Input value={client} onChange={e => setClient(e.target.value)} placeholder="Client or company name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location / Address</label>
                    <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Street / area…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emirate</label>
                    <select value={emirate} onChange={e => setEmirate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {EMIRATES.map(em => <option key={em}>{em}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Manager</label>
                    <Input value={projectManager} onChange={e => setProjectManager(e.target.value)} placeholder="Full name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Site Engineer</label>
                    <Input value={siteEngineer} onChange={e => setSiteEngineer(e.target.value)} placeholder="Full name…" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Timeline</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date *</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End Date *</label>
                    <Input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financials</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</label>
                    <select value={currency} onChange={e => setCurrency(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contract Value *</label>
                    <Input type="number" min={0} step={10000} value={contractValue} onChange={e => setContractValue(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Initial Workers</label>
                    <Input type="number" min={0} value={workers} onChange={e => setWorkers(e.target.value)} placeholder="0" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Phases */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Phases</label>
                  <button onClick={addPhase} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
                    <Plus className="h-3.5 w-3.5" /> Add Phase
                  </button>
                </div>
                <div className="space-y-2">
                  {phases.map((phase, i) => (
                    <div key={phase.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">#{i + 1}</span>
                        <Input value={phase.name} onChange={e => updatePhase(phase.id, "name", e.target.value)}
                          placeholder="Phase name (e.g. Foundation, Structure…)" className="h-8 text-xs flex-1" />
                        {phases.length > 1 && (
                          <button onClick={() => removePhase(phase.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pl-7">
                        <Input type="date" value={phase.startDate} onChange={e => updatePhase(phase.id, "startDate", e.target.value)} className="h-8 text-xs" />
                        <Input type="date" value={phase.endDate} min={phase.startDate} onChange={e => updatePhase(phase.id, "endDate", e.target.value)} className="h-8 text-xs" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Scope, special requirements, client notes…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleCreate("planning")} disabled={!isValid || createProject.isPending}>Save as Draft</Button>
                <Button onClick={() => handleCreate(status)} disabled={!isValid || createProject.isPending}>Create Project</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

