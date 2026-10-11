import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useCreateBooking, useRooms } from "@/hooks/hospitality/use-hospitality";

/** Label shown to staff → value stored on the booking. */
const SOURCES: { label: string; value: string }[] = [
  { label: "Direct", value: "direct" }, { label: "OTA", value: "online" }, { label: "Travel Agent", value: "agent" },
  { label: "Walk-in", value: "walk_in" }, { label: "Corporate", value: "corporate" },
];
const PAYMENT_METHODS = ["Credit Card", "Cash", "Bank Transfer", "Cheque"];
/** What the server stores: cash | card | bank_transfer | cheque. */
const METHOD_CODE: Record<string, string> = { "Credit Card": "card", "Cash": "cash", "Bank Transfer": "bank_transfer", "Cheque": "cheque" };
const NATIONALITIES = ["UAE", "Saudi Arabia", "India", "UK", "USA", "France", "Germany", "Russia", "China", "Other"];

interface AddBookingFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddBookingForm({ open, onClose }: AddBookingFormProps) {
  const currency = useCurrency();
  const createBooking = useCreateBooking();
  const { data: rooms = [] } = useRooms();
  const [source, setSource]               = React.useState("direct");
  const [roomId, setRoomId]               = React.useState("");
  const [guestName, setGuestName]         = React.useState("");
  const [guestEmail, setGuestEmail]       = React.useState("");
  const [guestPhone, setGuestPhone]       = React.useState("");
  const [nationality, setNationality]     = React.useState("UAE");
  const [adults, setAdults]               = React.useState("1");
  const [children, setChildren]           = React.useState("0");
  const [checkIn, setCheckIn]             = React.useState("");
  const [checkOut, setCheckOut]           = React.useState("");
  const [depositPaid, setDepositPaid]     = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("Credit Card");
  const [specialRequests, setSpecialRequests] = React.useState("");

  const nights = React.useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [checkIn, checkOut]);

  // The server prices the stay from the room's own rate, so the form shows that rate instead of asking for one.
  const room = rooms.find(r => r.id === roomId);
  const ratePerNight = room?.ratePerNight ?? 0;
  const totalAmount = ratePerNight * nights;
  const deposit = parseFloat(depositPaid) || 0;
  const depositTooHigh = totalAmount > 0 && deposit > totalAmount + 0.005;

  const isValid = Boolean(roomId && guestName.trim() && guestEmail.trim() && guestPhone.trim() && checkIn && checkOut && nights > 0 && !depositTooHigh);

  const reset = () => {
    setSource("direct"); setRoomId(""); setGuestName(""); setGuestEmail("");
    setGuestPhone(""); setNationality("UAE"); setAdults("1"); setChildren("0");
    setCheckIn(""); setCheckOut("");
    setDepositPaid(""); setPaymentMethod("Credit Card"); setSpecialRequests("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSave = async () => {
    try {
      await createBooking.mutateAsync({
        roomId, guestName: guestName.trim(), guestEmail: guestEmail.trim(), guestPhone: guestPhone.trim(),
        guestNationality: nationality, checkIn, checkOut, nights,
        adults: parseInt(adults) || 1, children: parseInt(children) || 0,
        source, specialRequests: specialRequests.trim() || null,
        // A deposit needs a method: the accounts tell cash from bank by it.
        paidAmount: deposit > 0 ? deposit : null,
        paymentMethod: deposit > 0 ? (METHOD_CODE[paymentMethod] ?? "cash") : null,
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
                <h2 className="text-base font-bold text-foreground">New Booking</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Create a hotel reservation</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Room */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Room *</label>
                <select value={roomId} onChange={e => setRoomId(e.target.value)} aria-label="Room"
                  className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Choose a room…</option>
                  {rooms.filter(r => r.status !== "maintenance").map(r => (
                    <option key={r.id} value={r.id}>{r.roomNumber} · {r.type} · {formatCurrency(r.ratePerNight, currency)}/night{r.status === "occupied" ? " (occupied now)" : ""}</option>
                  ))}
                </select>
              </div>

              {/* Booking Source */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Source</label>
                <div className="flex flex-wrap gap-2">
                  {SOURCES.map(o => (
                    <button key={o.value} onClick={() => setSource(o.value)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        source === o.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{o.label}</button>
                  ))}
                </div>
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
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
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
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate / Night</label>
                    <div className="h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm text-right flex items-center justify-end" aria-label="Rate per night">{room ? formatCurrency(ratePerNight, currency) : "—"}</div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deposit Paid</label>
                    <Input type="number" min={0} step={100} value={depositPaid} onChange={e => setDepositPaid(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                    {depositTooHigh && <p className="text-xs text-destructive">More than the booking total.</p>}
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

            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={!isValid || createBooking.isPending}>Confirm Booking</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

