import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateUnit } from "@/hooks/real-estate/use-re";

const UNIT_TYPES    = ["Studio", "1 BR", "2 BR", "3 BR", "4 BR", "5+ BR", "Penthouse", "Duplex", "Office", "Retail", "Warehouse", "Parking"];
const FURNISHING    = ["Unfurnished", "Semi-Furnished", "Fully Furnished"];
const VIEW_OPTIONS  = ["Sea View", "City View", "Garden View", "Pool View", "Street View", "Internal"];
const PROPERTIES    = ["Marina Heights Tower A", "Business Bay Plaza", "DIFC Gate Village", "JLT Cluster Q", "Downtown Residences"];

interface AddUnitFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddUnitForm({ open, onClose }: AddUnitFormProps) {
  const createUnit = useCreateUnit();
  const [property, setProperty]       = React.useState("");
  const [unitNo, setUnitNo]           = React.useState("");
  const [floor, setFloor]             = React.useState("");
  const [unitType, setUnitType]       = React.useState("2 BR");
  const [area, setArea]               = React.useState("");
  const [furnishing, setFurnishing]   = React.useState("Unfurnished");
  const [view, setView]               = React.useState("City View");
  const [bedrooms, setBedrooms]       = React.useState("");
  const [bathrooms, setBathrooms]     = React.useState("");
  const [parking, setParking]         = React.useState("0");
  const [annualRent, setAnnualRent]   = React.useState("");
  const [sellingPrice, setSellingPrice] = React.useState("");
  const [serviceCharge, setServiceCharge] = React.useState("");
  const [notes, setNotes]             = React.useState("");

  const isValid = property && unitNo.trim();

  const reset = () => {
    setProperty(""); setUnitNo(""); setFloor(""); setUnitType("2 BR"); setArea("");
    setFurnishing("Unfurnished"); setView("City View"); setBedrooms(""); setBathrooms("");
    setParking("0"); setAnnualRent(""); setSellingPrice(""); setServiceCharge(""); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSave = async () => {
    try {
      await createUnit.mutateAsync({
        propertyName: property, unitNumber: unitNo, floor: parseInt(floor) || undefined,
        unitType, area: parseFloat(area) || undefined, furnishing: furnishing.toLowerCase().replace(' ', '_'),
        view, bedrooms: parseInt(bedrooms) || undefined, bathrooms: parseInt(bathrooms) || undefined,
        parking: parseInt(parking) || 0, annualRent: parseFloat(annualRent) || undefined,
        sellingPrice: parseFloat(sellingPrice) || undefined, serviceCharge: parseFloat(serviceCharge) || undefined,
        notes: notes.trim() || undefined, status: 'available',
      });
      onClose();
    } catch { /* hook toasts */ }
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
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Unit</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Add a unit to an existing property</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Property */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property *</label>
                <select value={property} onChange={e => setProperty(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select property…</option>
                  {PROPERTIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Unit Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit Type</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {UNIT_TYPES.map(t => (
                    <button key={t} onClick={() => setUnitType(t)}
                      className={`py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                        unitType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Unit Details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Unit Details</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit No. *</label>
                    <Input value={unitNo} onChange={e => setUnitNo(e.target.value)} placeholder="101" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Floor</label>
                    <Input type="number" min={-5} value={floor} onChange={e => setFloor(e.target.value)} placeholder="1" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Area (sqft)</label>
                    <Input type="number" min={0} value={area} onChange={e => setArea(e.target.value)} placeholder="1200" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bedrooms</label>
                    <Input type="number" min={0} value={bedrooms} onChange={e => setBedrooms(e.target.value)} placeholder="2" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bathrooms</label>
                    <Input type="number" min={0} value={bathrooms} onChange={e => setBathrooms(e.target.value)} placeholder="2" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parking Slots</label>
                    <Input type="number" min={0} value={parking} onChange={e => setParking(e.target.value)} placeholder="1" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Furnishing</label>
                    <select value={furnishing} onChange={e => setFurnishing(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {FURNISHING.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">View</label>
                    <select value={view} onChange={e => setView(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {VIEW_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financials (AED)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Annual Rent</label>
                    <Input type="number" min={0} step={5000} value={annualRent} onChange={e => setAnnualRent(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Selling Price</label>
                    <Input type="number" min={0} step={50000} value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service Charge</label>
                    <Input type="number" min={0} step={1000} value={serviceCharge} onChange={e => setServiceCharge(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Amenities, renovation status…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={!isValid || createUnit.isPending}>Save Unit</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

