import * as React from "react";
import { Link } from "react-router-dom";
import { Plane, Inbox, CalendarCheck, Wallet, AlertTriangle, Plus, TrendingUp, Handshake, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { TourAttentionDto } from "@/lib/hospitality/tours.api";
import { useTourDashboard } from "@/hooks/hospitality/use-tours";
import { Stat, Section, dayLabel } from "../../shared/hotel-ui";
import { SeatsBar } from "./tour-ui";
import { TourBookingDrawer } from "./tour-booking-drawer";
import { NewTourBookingDrawer } from "./new-tour-booking-drawer";
import { PostToFinanceButton } from "@/components/finance/post-to-finance";

const KIND_LABEL: Record<TourAttentionDto["kind"], string> = {
  payment: "Payment", enquiry: "Follow up", travellers: "Travellers", passport: "Passport", supplier: "Supplier",
};

export function AgencyDashboardView() {
  const currency = useCurrency();
  const { data, isLoading } = useTourDashboard();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const cur = (n: number) => formatCurrency(n, currency);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Travel agency</h1>
          <p className="text-sm text-muted-foreground">Trips coming up, money owed, and what needs doing before departure.</p>
        </div>
        <div className="flex gap-2">
          <PostToFinanceButton module="hospitality" />
          <Button variant="outline" asChild className="h-9"><Link to="/hospitality/tours/packages">Packages</Link></Button>
          <Can permission="hospitality.tour-bookings.create"><Button className="gap-2 h-9" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New booking</Button></Can>
        </div>
      </div>

      {isLoading || !data ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Open enquiries" value={data.enquiries} icon={Inbox} tone="text-amber-600 bg-amber-500/10" />
            <Stat label="Travelling now" value={data.travellingNow} hint={`${data.departingNext30Days} leaving in 30 days`} icon={Plane} />
            <Stat label="Owed by customers" value={cur(data.balanceDue)} hint={data.overdueAmount > 0 ? `${cur(data.overdueAmount)} overdue` : "Nothing overdue"} icon={Wallet}
              tone={data.overdueAmount > 0 ? "text-destructive bg-destructive/10" : "text-emerald-600 bg-emerald-500/10"} />
            <Stat label="Sales this month" value={cur(data.salesThisMonth)} icon={TrendingUp}
              hint={data.marginThisMonth !== null ? `margin ${cur(data.marginThisMonth)}` : undefined} />
          </div>
          {data.supplierBalanceDue !== null && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Owed to suppliers" value={cur(data.supplierBalanceDue)} icon={Handshake} tone="text-violet-600 bg-violet-500/10" />
              <Stat label="Supplier bookings to confirm" value={data.servicesNotConfirmed} icon={CalendarCheck} tone="text-amber-600 bg-amber-500/10" />
              <Stat label="Confirmed trips" value={data.confirmed} icon={CheckCircle2} tone="text-emerald-600 bg-emerald-500/10" />
            </div>
          )}

          <div className="grid lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3">
              <Section title={`Needs attention (${data.attention.length})`}>
                {data.attention.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-xl border border-border bg-card px-4 py-6 text-center">All clear — nothing overdue or missing.</p>
                ) : (
                  <div className="rounded-xl border border-border bg-card divide-y divide-border">
                    {data.attention.map((a, i) => (
                      <button key={i} onClick={() => setOpenId(a.bookingId)} className="w-full text-start flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40">
                        <AlertTriangle className={a.kind === "payment" ? "h-4 w-4 mt-0.5 text-destructive shrink-0" : "h-4 w-4 mt-0.5 text-amber-600 shrink-0"} />
                        <div className="flex-1 min-w-0 text-sm">
                          <p className="font-medium truncate">{a.customerName} <span className="text-muted-foreground font-normal">· {a.title}</span></p>
                          <p className="text-xs text-muted-foreground">{KIND_LABEL[a.kind]}: {a.message}{a.amount ? ` — ${cur(a.amount)}` : ""}</p>
                        </div>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">travels {dayLabel(a.startDate)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Section>
            </div>
            <div className="lg:col-span-2">
              <Section title="Departures in the next 60 days">
                {data.upcomingDepartures.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-xl border border-border bg-card px-4 py-6 text-center">No scheduled departures.</p>
                ) : (
                  <div className="rounded-xl border border-border bg-card divide-y divide-border">
                    {data.upcomingDepartures.map(d => (
                      <div key={d.id} className="px-3 py-2.5 space-y-1">
                        <div className="flex justify-between gap-2 text-sm">
                          <p className="font-medium truncate">{d.packageName}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{dayLabel(d.startDate)}</span>
                        </div>
                        <SeatsBar booked={d.seatsBooked} capacity={d.capacity} />
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </div>
        </>
      )}

      {openId && <TourBookingDrawer bookingId={openId} onClose={() => setOpenId(null)} />}
      {creating && <NewTourBookingDrawer onClose={() => setCreating(false)} onCreated={setOpenId} />}
    </div>
  );
}
