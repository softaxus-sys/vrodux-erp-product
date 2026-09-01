import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck, BedDouble, Users, DollarSign, LogIn, LogOut,
  Search, Plus, X, Phone, Mail, Globe, CreditCard, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate, fitTextClass } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { BookingDto as Booking, BookingStatus, BookingSource } from "@/lib/hospitality/hospitality.api";
import { useBookings, useBookingsSummary } from "@/hooks/hospitality/use-hospitality";
import { AddBookingForm } from "./add-booking-form";
import { Pager } from "@/components/ui/pager";

/** A front desk works a screenful at a time; the rest is a page away. */
const PAGE_SIZE = 30;

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string; dot: string }> = {
  confirmed:    { label: "Confirmed",    color: "text-primary",     bg: "bg-primary/10",                    dot: "bg-primary" },
  checked_in:   { label: "Checked In",   color: "text-success",     bg: "bg-success/10",                    dot: "bg-success" },
  checked_out:  { label: "Checked Out",  color: "text-muted-foreground", bg: "bg-muted",                   dot: "bg-muted-foreground" },
  cancelled:    { label: "Cancelled",    color: "text-destructive", bg: "bg-destructive/10",                dot: "bg-destructive" },
  no_show:      { label: "No Show",      color: "text-warning",     bg: "bg-warning/10",                    dot: "bg-warning" },
};

const SOURCE_LABELS: Record<BookingSource, string> = {
  direct: "Direct", ota: "OTA", agent: "Travel Agent", walk_in: "Walk-in", corporate: "Corporate",
};

const ROOM_TYPE_LABELS = {
  standard: "Standard", deluxe: "Deluxe", suite: "Suite", penthouse: "Penthouse", studio: "Studio",
};

function BookingDrawer({ booking, open, onClose }: { booking: Booking | null; open: boolean; onClose: () => void }) {
  const currency = useCurrency();
  if (!booking) return null;
  const sc = STATUS_CONFIG[booking.status];
  const balanceDue = booking.balance > 0;

  return (
    <AnimatePresence>
      {open && (<>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed top-0 right-0 h-full w-full max-w-[580px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{booking.bookingNumber}</p>
              <p className="font-bold text-lg">{booking.guestName}</p>
              <p className="text-sm text-muted-foreground">{booking.guestNationality} · Room {booking.roomNumber} ({ROOM_TYPE_LABELS[booking.roomType]})</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                </span>
                <span className="text-[11px] bg-muted px-2 py-0.5 rounded font-medium">{SOURCE_LABELS[booking.source]}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Financials */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Rate / Night</p>
                <p className="font-bold text-sm text-primary">{formatCurrency(booking.ratePerNight, currency)}</p>
                <p className="text-[10px] text-muted-foreground">{booking.nights} nights</p>
              </div>
              <div className="bg-success/5 border border-success/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Paid</p>
                <p className="font-bold text-sm text-success">{formatCurrency(booking.paidAmount, currency)}</p>
              </div>
              <div className={cn("border rounded-xl p-3 text-center", balanceDue ? "bg-warning/5 border-warning/20" : "bg-muted/30")}>
                <p className="text-[10px] text-muted-foreground">Balance</p>
                <p className={cn("font-bold text-sm", balanceDue ? "text-warning" : "text-success")}>{formatCurrency(booking.balance, currency)}</p>
                <p className="text-[10px] text-muted-foreground">{balanceDue ? "Due" : "Settled"}</p>
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Total Booking Value</p>
              <p className={cn("font-bold text-primary truncate", fitTextClass(formatCurrency(booking.totalAmount, currency), "2xl"))}
                 title={formatCurrency(booking.totalAmount, currency)}>
                {formatCurrency(booking.totalAmount, currency)}
              </p>
            </div>
            {/* Stay Details */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Check-In</span><span className="font-semibold">{formatDate(booking.checkIn, "medium")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Check-Out</span><span className="font-semibold">{formatDate(booking.checkOut, "medium")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Nights</span><span>{booking.nights}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Guests</span>
                <span>{booking.adults} adult{booking.adults !== 1 ? "s" : ""}{booking.children > 0 ? `, ${booking.children} child${booking.children !== 1 ? "ren" : ""}` : ""}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Room</span><span>Room {booking.roomNumber} · Floor {booking.floor}</span></div>
            </div>
            {/* Guest Contact */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-primary text-xs">{booking.guestEmail}</span></div>
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-mono text-xs">{booking.guestPhone}</span></div>
              <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-muted-foreground" /><span>{booking.guestNationality}</span></div>
            </div>
            {booking.specialRequests && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Special Requests</h4>
                <p className="text-sm text-muted-foreground bg-warning/5 border border-warning/20 rounded-xl p-3">{booking.specialRequests}</p>
              </div>
            )}
            {booking.notes && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Internal Notes</h4>
                <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">{booking.notes}</p>
              </div>
            )}
          </div>
          <div className="border-t border-border px-6 py-4 flex items-center gap-2">
            {booking.status === "confirmed" && <Button size="sm" className="gap-1.5 h-9"><LogIn className="h-3.5 w-3.5" />Check In</Button>}
            {booking.status === "checked_in" && <Button size="sm" className="gap-1.5 h-9 bg-success hover:bg-success/90"><LogOut className="h-3.5 w-3.5" />Check Out</Button>}
            {balanceDue && booking.status === "checked_in" && (
              <Button size="sm" variant="outline" className="gap-1.5 h-9"><CreditCard className="h-3.5 w-3.5" />Collect Payment</Button>
            )}
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

const STATUS_FILTERS = ["all", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"] as const;
const STATUS_FILTER_LABELS: Record<typeof STATUS_FILTERS[number], string> = {
  all: "All", confirmed: "Confirmed", checked_in: "Checked In",
  checked_out: "Checked Out", cancelled: "Cancelled", no_show: "No Show",
};

export function BookingsView() {
  const currency = useCurrency();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<BookingStatus | "all">("all");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Booking | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  // Debounced so typing a guest name doesn't fire a query per keystroke.
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any change to what is being asked for starts again at page one.
  React.useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const { data: bookingsPage, isFetching } = useBookings({
    page,
    pageSize: PAGE_SIZE,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: debouncedSearch || undefined,
  });
  const { data: bookingsSummary } = useBookingsSummary();

  // The server has already filtered and paged; this is just the current page.
  const filtered = bookingsPage?.items ?? [];

  const STATS = [
    { label: "Total Bookings", value: bookingsSummary?.total ?? 0, icon: CalendarCheck, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Checked In", value: bookingsSummary?.checkedIn ?? 0, icon: BedDouble, color: "text-success", bg: "bg-success/10" },
    { label: "Arriving Today", value: bookingsSummary?.confirmed ?? 0, icon: LogIn, color: "text-primary", bg: "bg-primary/10" },
    { label: "Occupancy", value: `${bookingsSummary?.occupancyRate ?? 0}%`, icon: Users, color: "text-warning", bg: "bg-warning/10" },
    { label: "Revenue", value: formatCurrency(bookingsSummary?.totalRevenue ?? 0, currency), icon: DollarSign, color: "text-success", bg: "bg-success/10", isText: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Bookings</h1><p className="text-sm text-muted-foreground mt-0.5">Manage hotel reservations, check-ins, and check-outs</p></div>
        <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />New Booking</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}><Icon className={cn("h-5 w-5", s.color)} /></div>
              <div className="min-w-0"><p className="text-xs text-muted-foreground truncate">{s.label}</p><p className="font-bold text-sm leading-tight">{s.value}</p></div>
            </motion.div>
          );
        })}
      </div>
      {(bookingsSummary?.outstandingBalance ?? 0) > 0 && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3 text-sm text-warning">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Outstanding balance of <strong>{formatCurrency(bookingsSummary!.outstandingBalance, currency)}</strong> across active bookings.</span>
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search guest or booking…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setStatusFilter(f as BookingStatus | "all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === f ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {STATUS_FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Guest</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Room</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Check-In</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Check-Out</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Guests</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No bookings found.</td></tr>
            ) : filtered.map((b, i) => {
              const sc = STATUS_CONFIG[b.status];
              return (
                <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  onClick={() => { setSelected(b); setDrawerOpen(true); }}
                  className={cn("border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer",
                    b.status === "checked_in" ? "border-l-2 border-l-success" :
                    b.status === "no_show" ? "border-l-2 border-l-warning" : "")}>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold">{b.guestName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{b.bookingNumber}</p>
                    <p className="text-xs text-muted-foreground">{b.guestNationality}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <p className="text-sm font-medium">Room {b.roomNumber}</p>
                    <p className="text-xs text-muted-foreground">{ROOM_TYPE_LABELS[b.roomType]} · Floor {b.floor}</p>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground hidden lg:table-cell">{formatDate(b.checkIn, "short")}</td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground hidden lg:table-cell">{formatDate(b.checkOut, "short")}</td>
                  <td className="px-4 py-3.5 text-center hidden md:table-cell">
                    <span className="text-sm">{b.adults + b.children}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <p className="font-semibold text-sm">{formatCurrency(b.totalAmount, currency)}</p>
                    {b.balance > 0 && <p className="text-[10px] text-warning">AED {b.balance.toLocaleString()} due</p>}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
      <BookingDrawer booking={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddBookingForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

