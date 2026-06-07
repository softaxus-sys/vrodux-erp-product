"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PROPERTY_TYPES = ["Residential Tower", "Commercial Building", "Mixed-Use", "Villa Complex", "Retail Mall", "Warehouse", "Land / Plot", "Hotel Apartment"];
const EMIRATES       = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah"];
const AREAS          = ["Downtown Dubai", "Dubai Marina", "JLT", "Business Bay", "DIFC", "Jumeirah", "Al Barsha", "Deira", "Al Nahda", "Al Reem Island", "Saadiyat Island", "Other"];

interface AddPropertyFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddPropertyForm({ open, onClose }: AddPropertyFormProps) {
  const [name, setName]               = React.useState("");
  const [propertyType, setPropertyType] = React.useState("Residential Tower");
  const [emirate, setEmirate]         = React.useState("Dubai");
  const [area, setArea]               = React.useState("");
  const [address, setAddress]         = React.useState("");
  const [plotNo, setPlotNo]           = React.useState("");
  const [titleDeedNo, setTitleDeedNo] = React.useState("");
  const [totalUnits, setTotalUnits]   = React.useState("");
  const [totalArea, setTotalArea]     = React.useState("");
  const [builtYear, setBuiltYear]     = React.useState("");
  const [purchasePrice, setPurchasePrice] = React.useState("");
  const [currentValue, setCurrentValue]   = React.useState("");
  const [propertyManager, setPropertyManager] = React.useState("");
  const [notes, setNotes]             = React.useState("");

  const isValid = name.trim() && propertyType && emirate;

  const reset = () => {
    setName(""); setPropertyType("Residential Tower"); setEmirate("Dubai"); setArea("");
    setAddress(""); setPlotNo(""); setTitleDeedNo(""); setTotalUnits(""); setTotalArea("");
    setBuiltYear(""); setPurchasePrice(""); setCurrentValue(""); setPropertyManager(""); setNotes("");
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
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Property</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Register a new property asset</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {PROPERTY_TYPES.map(t => (
                    <button key={t} onClick={() => setPropertyType(t)}
                      className={`py-2 rounded-lg border-2 text-xs font-medium text-left px-3 transition-all ${
                        propertyType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Basic */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Property Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property Name *</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Marina Heights Tower A" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emirate *</label>
                    <select value={emirate} onChange={e => setEmirate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {EMIRATES.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Area / Community</label>
                    <select value={area} onChange={e => setArea(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select…</option>
                      {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Address</label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, building, landmark…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plot Number</label>
                    <Input value={plotNo} onChange={e => setPlotNo(e.target.value)} placeholder="Municipality plot no." className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title Deed No.</label>
                    <Input value={titleDeedNo} onChange={e => setTitleDeedNo(e.target.value)} placeholder="DLD title deed…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Units</label>
                    <Input type="number" min={1} value={totalUnits} onChange={e => setTotalUnits(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Area (m²)</label>
                    <Input type="number" min={0} value={totalArea} onChange={e => setTotalArea(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Year Built</label>
                    <Input type="number" min={1980} max={2030} value={builtYear} onChange={e => setBuiltYear(e.target.value)} placeholder="2020" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property Manager</label>
                    <Input value={propertyManager} onChange={e => setPropertyManager(e.target.value)} placeholder="Manager name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Purchase Price (AED)</label>
                    <Input type="number" min={0} step={10000} value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Value (AED)</label>
                    <Input type="number" min={0} step={10000} value={currentValue} onChange={e => setCurrentValue(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Amenities, special features, restrictions…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Save Property</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
