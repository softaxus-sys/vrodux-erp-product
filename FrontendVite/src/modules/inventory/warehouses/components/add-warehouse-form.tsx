import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateWarehouse } from "@/hooks/inventory/use-warehouses";

const WAREHOUSE_TYPES = ["General", "Cold Storage", "Hazardous", "Bonded", "Free Zone", "Distribution Center"];
const EMIRATES        = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];

interface AddWarehouseFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddWarehouseForm({ open, onClose }: AddWarehouseFormProps) {
  const [name, setName]               = React.useState("");
  const [code, setCode]               = React.useState("");
  const [type, setType]               = React.useState("General");
  const [manager, setManager]         = React.useState("");
  const [phone, setPhone]             = React.useState("");
  const [email, setEmail]             = React.useState("");
  const [address, setAddress]         = React.useState("");
  const [emirate, setEmirate]         = React.useState("Dubai");
  const [totalArea, setTotalArea]     = React.useState("");
  const [capacity, setCapacity]       = React.useState("");
  const [zones, setZones]             = React.useState("");
  const [notes, setNotes]             = React.useState("");

  const createWarehouse = useCreateWarehouse();

  const isValid = name.trim() && code.trim();

  const reset = () => {
    setName(""); setCode(""); setType("General"); setManager(""); setPhone(""); setEmail("");
    setAddress(""); setEmirate("Dubai"); setTotalArea(""); setCapacity(""); setZones(""); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSave = () => {
    if (!isValid) return;
    const fullAddress = [address.trim(), emirate].filter(Boolean).join(", ");
    createWarehouse.mutate(
      {
        name:          name.trim(),
        code:          code.trim() || null,
        address:       fullAddress || null,
        contactPerson: manager.trim() || null,
        phone:         phone.trim() || null,
        isActive:      true,
      },
      { onSuccess: () => { reset(); onClose(); } },
    );
  };

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
                <h2 className="text-base font-bold text-foreground">New Warehouse</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Register a new storage location</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Warehouse Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {WAREHOUSE_TYPES.map(t => (
                    <button key={t} onClick={() => setType(t)}
                      className={`py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                        type === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Basic Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Warehouse Name *</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Dubai Main Warehouse" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Warehouse Code *</label>
                    <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="WH-DXB-01" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manager</label>
                    <Input value={manager} onChange={e => setManager(e.target.value)} placeholder="Warehouse manager…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="warehouse@company.com" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Location</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Zone, street, plot…" className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emirate</label>
                    <select value={emirate} onChange={e => setEmirate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {EMIRATES.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Capacity */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Capacity & Layout</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Area (m²)</label>
                    <Input type="number" min={0} value={totalArea} onChange={e => setTotalArea(e.target.value)} placeholder="5000" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Max Capacity (pallets)</label>
                    <Input type="number" min={0} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="1000" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">No. of Zones</label>
                    <Input type="number" min={1} value={zones} onChange={e => setZones(e.target.value)} placeholder="4" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Special storage requirements, certifications, access restrictions…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={createWarehouse.isPending}>Cancel</Button>
              <Button onClick={handleSave} disabled={!isValid || createWarehouse.isPending}>
                {createWarehouse.isPending ? "Saving…" : "Save Warehouse"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

