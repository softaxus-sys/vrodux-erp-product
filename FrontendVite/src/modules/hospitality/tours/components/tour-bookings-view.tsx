import * as React from "react";
import { Luggage, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { Pager } from "@/components/ui/pager";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useTourBookings } from "@/hooks/hospitality/use-tours";
import { Empty, inputCls, dayLabel } from "../../shared/hotel-ui";
import { Chip, TOUR_STATUS } from "./tour-ui";
import { TourBookingDrawer } from "./tour-booking-drawer";
import { NewTourBookingDrawer } from "./new-tour-booking-drawer";

const PAGE_SIZE = 30;
const FILTERS = [
  { value: "open", label: "Open" }, { value: "enquiry", label: "Enquiries" }, { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }, { value: "", label: "All" },
];

export function TourBookingsView() {
  const currency = useCurrency();
  const [status, setStatus] = React.useState("open");
  const [balanceOnly, setBalanceOnly] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  React.useEffect(() => { const h = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(h); }, [search]);
  const { data, isLoading, isFetching } = useTourBookings({ status, search: debounced, balanceOnly, page, pageSize: PAGE_SIZE });
  const rows = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tour bookings</h1>
          <p className="text-sm text-muted-foreground">Enquiries, confirmed trips and what each customer still owes.</p>
        </div>
        <Can permission="hospitality.tour-bookings.create"><Button className="gap-2 h-9" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New booking</Button></Can>
      </div>

      <div className="flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Customer, booking no., trip, phone…" className={`${inputCls} ps-9`} />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => { setStatus(f.value); setPage(1); }}
              className={cn("h-9 px-3 rounded-lg text-sm border", status === f.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted")}>{f.label}</button>
          ))}
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground px-2"><input type="checkbox" checked={balanceOnly} onChange={e => { setBalanceOnly(e.target.checked); setPage(1); }} />Owing money</label>
        </div>
      </div>

      {isLoading ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : rows.length === 0 ? (
        <Empty icon={Luggage} title={debounced ? "No booking matches" : "No bookings here"} hint={debounced ? undefined : "Bookings appear here once taken from a package or as a tailor-made trip."} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr><th className="text-start font-medium px-4 py-2.5">Booking</th><th className="text-start font-medium px-4 py-2.5">Trip</th>
                <th className="text-start font-medium px-4 py-2.5">Travel</th><th className="text-end font-medium px-4 py-2.5">Pax</th>
                <th className="text-end font-medium px-4 py-2.5">Total</th><th className="text-end font-medium px-4 py-2.5">Balance</th>
                <th className="text-start font-medium px-4 py-2.5">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(b => (
                <tr key={b.id} onClick={() => setOpenId(b.id)} className="cursor-pointer hover:bg-muted/40">
                  <td className="px-4 py-2.5"><p className="font-medium">{b.customerName}</p><p className="text-[11px] text-muted-foreground">{b.bookingNumber}</p></td>
                  <td className="px-4 py-2.5 max-w-[240px] truncate">{b.title}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{dayLabel(b.startDate)} → {dayLabel(b.endDate)}</td>
                  <td className="px-4 py-2.5 text-end">{b.adults + b.children}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{formatCurrency(b.totalAmount, currency)}</td>
                  <td className={cn("px-4 py-2.5 text-end tabular-nums", b.overdueAmount > 0 ? "text-destructive font-semibold" : b.balance > 0 ? "text-amber-600" : "text-muted-foreground")}>
                    {b.balance > 0 ? formatCurrency(b.balance, currency) : "Paid"}
                    {b.overdueAmount > 0 && <p className="text-[10px] font-normal">overdue</p>}
                  </td>
                  <td className="px-4 py-2.5"><Chip map={TOUR_STATUS} value={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.totalPages > 1 && <Pager page={page} totalPages={data.totalPages} totalCount={data.totalCount} pageSize={PAGE_SIZE} busy={isFetching} onPage={setPage} />}
        </div>
      )}

      {openId && <TourBookingDrawer bookingId={openId} onClose={() => setOpenId(null)} />}
      {creating && <NewTourBookingDrawer onClose={() => setCreating(false)} onCreated={setOpenId} />}
    </div>
  );
}
