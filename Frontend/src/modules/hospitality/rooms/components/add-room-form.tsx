"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ROOM_TYPES    = ["Standard", "Studio", "Deluxe", "Suite", "Penthouse"];
const VIEWS         = ["Sea", "City", "Pool", "Garden", "Courtyard"];
const FLOORS        = Array.from({ length: 30 }, (_, i) => `${i + 1}`);
const AMENITY_OPTIONS = [
  "WiFi", "Air Conditioning", "Mini Bar", "Safe", "Flat Screen TV",
  "Bathtub", "Shower", "Balcony", "Kitchenette", "Coffee Machine",
  "Smoking Allowed", "Accessibility Features",
];
const AMENITY_VALUES = [
  "wifi", "ac", "mini_bar", "safe", "tv",
  "bathtub", "shower", "balcony", "kitchenette", "coffee",
  "smoking", "accessible",
];

interface AddRoomFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddRoomForm({ open, onClose }: AddRoomFormProps) {
  const [roomType, setRoomType]       = React.useState("Standard");
  const [roomNumber, setRoomNumber]   = React.useState("");
  const [floor, setFloor]             = React.useState("1");
  const [view, setView]               = React.useState("City");
  const [area, setArea]               = React.useState("");
  const [maxGuests, setMaxGuests]     = React.useState("2");
  const [beds, setBeds]               = React.useState("1");
  const [ratePerNight, setRatePerNight] = React.useState("");
  const [amenities, setAmenities]     = React.useState<string[]>(["wifi", "ac", "tv"]);
  const [description, setDescription] = React.useState("");

  const toggleAmenity = (a: string) =>
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  const isValid = roomNumber.trim() && ratePerNight;

  const reset = () => {
    setRoomType("Standard"); setRoomNumber(""); setFloor("1"); setView("City");
    setArea(""); setMaxGuests("2"); setBeds("1"); setRatePerNight("");
    setAmenities(["wifi", "ac", "tv"]); setDescription("");
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
                <h2 className="text-base font-bold text-foreground">Add Room</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Register a new hotel room</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Room Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Room Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROOM_TYPES.map(t => (
                    <button key={t} onClick={() => setRoomType(t)}
                      className={`py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                        roomType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Room Details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Room Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Room Number *</label>
                    <Input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="e.g. 201" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Floor</label>
                    <select value={floor} onChange={e => setFloor(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {FLOORS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">View</label>
                    <select value={view} onChange={e => setView(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {VIEWS.map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Area (sqm)</label>
                    <Input type="number" min={0} value={area} onChange={e => setArea(e.target.value)} placeholder="0" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Max Guests</label>
                    <Input type="number" min={1} max={10} value={maxGuests} onChange={e => setMaxGuests(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">No. of Beds</label>
                    <Input type="number" min={1} max={5} value={beds} onChange={e => setBeds(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate / Night (AED) *</label>
                    <Input type="number" min={0} step={50} value={ratePerNight} onChange={e => setRatePerNight(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amenities</label>
                <div className="flex flex-wrap gap-1.5">
                  {AMENITY_OPTIONS.map((a, i) => (
                    <button key={a} onClick={() => toggleAmenity(AMENITY_VALUES[i])}
                      className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                        amenities.includes(AMENITY_VALUES[i])
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{a}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Room description, highlights, notes…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Add Room</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
