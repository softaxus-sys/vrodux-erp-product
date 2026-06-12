import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

const ROOM_TYPES   = ["Standard", "Studio", "Deluxe", "Suite", "Penthouse"];
const SOURCES      = ["Direct", "OTA", "Travel Agent", "Walk-in", "Corporate"];
const MEAL_PLANS   = ["Room Only", "Bed & Breakfast", "Half Board", "Full Board", "All Inclusive"];
const PAYMENT_METHODS = ["Credit Card", "Cash", "Bank Transfer", "Corporate Account", "OTA Prepaid"];
const NATIONALITIES = ["UAE", "Saudi Arabia", "India", "UK", "USA", "France", "Germany", "Russia", "China", "Other"];

interface AddBookingFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddBookingForm({ open, onClose }: AddBookingFormProps) {
  const currency = useCurrency();
  const [roomType, setRoomType]           = React.useState("Deluxe");
  const [source, setSource]               = React.useState("Direct");
  const [roomNumber, setRoomNumber]       = React.useState("");
  const [guestName, setGuestName]         = React.useState("");
  const [guestEmail, setGuestEmail]       = React.useState("");
  const [guestPhone, setGuestPhone]       = React.useState("");
  const [nationality, setNationality]     = React.useState("UAE");
  const [idNumber, setIdNumber]           = React.useState("");
  const [adults, setAdults]               = React.useState("1");
  const [children, setChildren]           = React.useState("0");
  const [checkIn, setCheckIn]             = React.useState("");
  const [checkOut, setCheckOut]           = React.useState("");
  const [mealPlan, setMealPlan]           = React.useState("Bed & Breakfast");
  const [ratePerNight, setRatePerNight]   = React.useState("");
  const [depositPaid, setDepositPaid]     = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("Credit Card");
  const [specialRequests, setSpecialRequests] = React.useState("");
  const [notes, setNotes]                 = React.useState("");

  const nights = React.useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [checkIn, checkOut]);

  const totalAmount = (parseFloat(ratePerNight) || 0) * nights;

  const isValid = guestName.trim() && guestPhone.trim() && checkIn && checkOut && nights > 0 && ratePerNight;

  const reset = () => {
    setRoomType("Deluxe"); setSource("Direct"); setRoomNumber(""); setGuestName(""); setGuestEmail("");
    setGuestPhone(""); setNationality("UAE"); setIdNumber(""); setAdults("1"); setChildren("0");
    setCheckIn(""); setCheckOut(""); setMealPlan("Bed & Breakfast"); setRatePerNight("");
    setDepositPaid(""); setPaymentMethod("Credit Card"); setSpecialRequests(""); setNotes("");
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
                <h2 className="text-base font-bold text-foreground">New Booking</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Create a hotel reservation</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Room Type & Source */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Room Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROOM_TYPES.map(t => (
                    <button key={t} onClick={() => setRoomType(t)}
                      className={`py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        roomType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Booking Source */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Source</label>
                <div className="flex flex-wrap gap-2">
                  {SOURCES.map(s => (
                    <button key={s} onClick={() => setSource(s)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        source === s ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Room Assignment */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Room Number</label>
                <Input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="e.g. 201" className="h-9 text-sm font-mono" />
              </div>

              {/* Guest Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Guest Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Guest Name *</label>
                    <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Full name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
                    <Input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="guest@email.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone *</label>
                    <Input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nationality</label>
                    <select value={nationality} onChange={e => setNationality(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {NATIONALITIES.map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ID / Passport No.</label>
                    <Input value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="ID number…" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adults</label>
                    <Input type="number" min={1} max={10} value={adults} onChange={e => setAdults(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Children</label>
                    <Input type="number" min={0} max={10} value={children} onChange={e => setChildren(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Stay Details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Stay Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check-In *</label>
                    <Input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check-Out *</label>
                    <Input type="date" value={checkOut} min={checkIn} onChange={e => setCheckOut(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meal Plan</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {MEAL_PLANS.map(m => (
                        <button key={m} onClick={() => setMealPlan(m)}
                          className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-all ${
                            mealPlan === m ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                          }`}>{m}</button>
                      ))}
                    </div>
                  </div>
                </div>
                {nights > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground text-center">
                    Duration: <strong className="text-foreground">{nights} night{nights !== 1 ? "s" : ""}</strong>
                  </div>
                )}
              </div>

              {/* Financial */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financial</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate / Night (AED) *</label>
                    <Input type="number" min={0} step={50} value={ratePerNight} onChange={e => setRatePerNight(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deposit Paid (AED)</label>
                    <Input type="number" min={0} step={100} value={depositPaid} onChange={e => setDepositPaid(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Method</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                {totalAmount > 0 && (
                  <div className="flex items-center justify-between mt-3 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                    <span className="text-xs text-muted-foreground">Total ({nights} nights)</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(totalAmount, currency)}</span>
                  </div>
                )}
              </div>

              {/* Requests */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Special Requests</label>
                <textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}
                  placeholder="Late check-in, extra bed, dietary needs, room preferences…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Staff notes…" rows={1}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={!isValid}>Hold</Button>
                <Button onClick={onClose} disabled={!isValid}>Confirm Booking</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

