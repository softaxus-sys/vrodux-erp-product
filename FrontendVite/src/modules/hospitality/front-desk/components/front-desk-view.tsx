import * as React from "react";
import { LogIn, LogOut, BedDouble, Percent, TrendingUp, SprayCan, Wrench, Plus, UserX, Loader2, Hotel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { BookingDto } from "@/lib/hospitality/hospitality.api";
import { useFrontDesk, useCheckInBooking } from "@/hooks/hospitality/use-hospitality";
import { Stat, StatusChip, Empty, dayLabel } from "../../shared/hotel-ui";
import { BookingDrawer } from "../../bookings/components/booking-drawer";
import { NewBookingDrawer } from "../../bookings/components/new-booking-drawer";

type Tab = "arrivals" | "departures" | "inhouse" | "noshows";

/** The desk's day on one screen: who is coming, who is leaving, who is here, and how full the hotel is tonight. */
export function FrontDeskView() {
  const currency = useCurrency();
  const fmt = (n: number) => formatCurrency(n, currency);
  const { data, isLoading } = useFrontDesk();
  const [tab, setTab] = React.useState<Tab>("arrivals");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const checkIn = useCheckInBooking();
  const canEdit = useCan("hospitality.bookings.edit");

  if (isLoading || !data) return <div className="space-y-4"><div className="h-24 rounded-xl bg-muted/40 animate-pulse" /><div className="h-64 rounded-xl bg-muted/40 animate-pulse" /></div>;

  const lists: Record<Tab, BookingDto[]> = {
    arrivals: data.arrivals, departures: data.departures, inhouse: data.inHouse, noshows: data.noShows,
  };
  const tabs: { id: Tab; label: string; count: number; icon: React.ElementType }[] = [
    { id: "arrivals", label: "Arrivals", count: data.arrivals.length, icon: LogIn },
    { id: "departures", label: "Departures", count: data.departures.length, icon: LogOut },
    { id: "inhouse", label: "In house", count: data.inHouse.length, icon: BedDouble },
    { id: "noshows", label: "Not arrived", count: data.noShows.length, icon: UserX },
  ];
  const rows = lists[tab];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Front desk</h1>
          <p className="text-sm text-muted-foreground">{dayLabel(data.today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <Can permission="hospitality.bookings.create">
          <Button className="gap-2 h-9" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New reservation</Button>
        </Can>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Occupancy tonight" value={`${data.occupancyPercent}%`} hint={`${data.occupiedTonight} of ${data.totalRooms - data.outOfOrder} rooms`} icon={Percent} />
        <Stat label="Average daily rate" value={fmt(data.averageDailyRate)} hint="Room revenue ÷ rooms sold" icon={TrendingUp} tone="text-success bg-success/10" />
        <Stat label="RevPAR" value={fmt(data.revPar)} hint="Room revenue ÷ rooms available" icon={Hotel} tone="text-violet-600 bg-violet-100 dark:bg-violet-900/20" />
        <Stat label="Room revenue tonight" value={fmt(data.roomRevenueTonight)} icon={BedDouble} tone="text-warning bg-warning/10" />
        <Stat label="Arriving today" value={data.arrivalsPending} icon={LogIn} />
        <Stat label="Leaving today" value={data.departuresPending} icon={LogOut} tone="text-muted-foreground bg-muted" />
        <Stat label="Rooms to clean" value={data.dirtyRooms} icon={SprayCan} tone="text-warning bg-warning/10" />
        <Stat label="Out of order" value={data.outOfOrder} icon={Wrench} tone="text-destructive bg-destructive/10" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap",
                tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              <t.icon className="h-4 w-4" />{t.label}
              <span className={cn("ms-1 rounded-full px-1.5 text-[11px]", tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted")}>{t.count}</span>
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="p-4"><Empty icon={tabs.find(t => t.id === tab)!.icon} title={EMPTY[tab]} /></div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(b => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer" onClick={() => setOpenId(b.id)}>
                <div className="h-10 w-12 rounded-lg bg-muted flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] text-muted-foreground leading-none">Room</span>
                  <span className="text-sm font-bold leading-tight">{b.roomNumber}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{b.guestName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {dayLabel(b.checkIn)} → {dayLabel(b.checkOut)} · {b.nights} night{b.nights === 1 ? "" : "s"} · {b.adults + b.children} guest{b.adults + b.children === 1 ? "" : "s"}
                    {b.specialRequests ? ` · ${b.specialRequests}` : ""}
                  </p>
                </div>
                <StatusChip status={b.status} />
                <span className={cn("text-sm tabular-nums w-28 text-end", b.balance > 0.005 ? "text-destructive font-medium" : "text-muted-foreground")}>
                  {b.balance > 0.005 ? `${fmt(b.balance)} due` : "Settled"}
                </span>
                {tab === "arrivals" && canEdit && (
                  <Button size="sm" className="gap-1.5" disabled={checkIn.isPending}
                    onClick={e => { e.stopPropagation(); checkIn.mutate({ id: b.id }); }}>
                    {checkIn.isPending && checkIn.variables?.id === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}Check in
                  </Button>
                )}
                {tab === "departures" && b.status === "checked_in" && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={e => { e.stopPropagation(); setOpenId(b.id); }}>
                    <LogOut className="h-3.5 w-3.5" />Settle & check out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {openId && <BookingDrawer bookingId={openId} onClose={() => setOpenId(null)} />}
      {creating && <NewBookingDrawer onClose={() => setCreating(false)} onCreated={setOpenId} />}
    </div>
  );
}

const EMPTY: Record<Tab, string> = {
  arrivals: "Nobody else is due today.",
  departures: "No departures today.",
  inhouse: "No guests in house.",
  noshows: "Every past arrival has been checked in or closed.",
};
