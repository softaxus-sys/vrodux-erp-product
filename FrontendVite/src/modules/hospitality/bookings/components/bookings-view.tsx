import * as React from "react";
import { CalendarCheck, LogIn, BedDouble, Wallet, Search, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { Pager } from "@/components/ui/pager";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useBookings, useBookingsSummary } from "@/hooks/hospitality/use-hospitality";
import { BOOKING_SOURCES } from "@/lib/hospitality/hospitality.api";
import { Stat, StatusChip, Empty, dayLabel, inputCls, selectCls } from "../../shared/hotel-ui";
import { BookingDrawer } from "./booking-drawer";
import { NewBookingDrawer } from "./new-booking-drawer";

const PAGE_SIZE = 30;

const FILTERS = [
  { value: "", label: "All" }, { value: "confirmed", label: "Confirmed" }, { value: "checked_in", label: "In house" },
  { value: "checked_out", label: "Checked out" }, { value: "cancelled", label: "Cancelled" }, { value: "no_show", label: "No-show" },
];

export function BookingsView() {
  const currency = useCurrency();
  const fmt = (n: number) => formatCurrency(n, currency);
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => { const h = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(h); }, [search]);
  React.useEffect(() => setPage(1), [status, from, to]);

  const { data: summary } = useBookingsSummary();
  const { data, isLoading, isFetching } = useBookings({ status, search: debounced, page, pageSize: PAGE_SIZE, from: from || undefined, to: to || undefined });
  const rows = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reservations</h1>
          <p className="text-sm text-muted-foreground">Every stay — upcoming, in house and past.</p>
        </div>
        <Can permission="hospitality.bookings.create">
          <Button className="gap-2 h-9" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New reservation</Button>
        </Can>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Upcoming" value={summary?.confirmed ?? 0} icon={CalendarCheck} />
        <Stat label="In house" value={summary?.checkedIn ?? 0} icon={LogIn} tone="text-success bg-success/10" />
        <Stat label="Stays completed" value={summary?.checkedOut ?? 0} icon={BedDouble} tone="text-muted-foreground bg-muted" />
        <Stat label="Owed by guests" value={fmt(summary?.outstanding ?? 0)} icon={Wallet} tone="text-destructive bg-destructive/10" />
      </div>

      <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Guest, booking number, room, email or phone" className={`${inputCls} ps-9`} />
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={`${inputCls} w-auto`} aria-label="Staying from" />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={`${inputCls} w-auto`} aria-label="Staying to" />
          {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted" aria-label="Clear dates"><X className="h-4 w-4" /></button>}
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className={`${selectCls} lg:w-40`}>
          {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="h-40 rounded-xl bg-muted/40 animate-pulse" />
      ) : rows.length === 0 ? (
        <Empty icon={CalendarCheck} title={debounced || status || from ? "No reservations match" : "No reservations yet"}
          hint={debounced || status || from ? "Try another search or filter." : "Take the first one — the room, price and guest profile are set up as you go."} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-start font-medium px-4 py-2.5">Guest</th>
                <th className="text-start font-medium px-4 py-2.5">Room</th>
                <th className="text-start font-medium px-4 py-2.5">Stay</th>
                <th className="text-start font-medium px-4 py-2.5">Source</th>
                <th className="text-start font-medium px-4 py-2.5">Status</th>
                <th className="text-end font-medium px-4 py-2.5">Total</th>
                <th className="text-end font-medium px-4 py-2.5">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(b => (
                <tr key={b.id} onClick={() => setOpenId(b.id)} className="cursor-pointer hover:bg-muted/40">
                  <td className="px-4 py-2.5"><p className="font-medium">{b.guestName}</p><p className="text-xs text-muted-foreground">{b.bookingNumber}</p></td>
                  <td className="px-4 py-2.5"><p>{b.roomNumber}</p><p className="text-xs text-muted-foreground">{b.roomType}</p></td>
                  <td className="px-4 py-2.5 whitespace-nowrap"><p>{dayLabel(b.checkIn)} → {dayLabel(b.checkOut)}</p><p className="text-xs text-muted-foreground">{b.nights} night{b.nights === 1 ? "" : "s"} · {b.adults + b.children} guest{b.adults + b.children === 1 ? "" : "s"}</p></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{BOOKING_SOURCES.find(s => s.value === b.source)?.label ?? b.source}</td>
                  <td className="px-4 py-2.5"><StatusChip status={b.status} /></td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{fmt(b.totalAmount)}</td>
                  <td className={`px-4 py-2.5 text-end tabular-nums ${b.balance > 0.005 ? "text-destructive font-medium" : "text-muted-foreground"}`}>{fmt(b.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.totalPages > 1 && <Pager page={page} totalPages={data.totalPages} totalCount={data.totalCount} pageSize={PAGE_SIZE} busy={isFetching} onPage={setPage} />}
        </div>
      )}

      {openId && <BookingDrawer bookingId={openId} onClose={() => setOpenId(null)} />}
      {creating && <NewBookingDrawer onClose={() => setCreating(false)} onCreated={setOpenId} />}
    </div>
  );
}
