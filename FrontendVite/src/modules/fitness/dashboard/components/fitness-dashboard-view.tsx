import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useBranches, useFitnessDashboard } from "@/hooks/fitness/use-fitness";
import { PageHeader, SELECT, Stat } from "../../shared/ui";

function Bars({ items, valueLabel }: { items: { name: string; value: number }[]; valueLabel?: (n: number) => string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing to show yet.</p>;
  return (
    <div className="space-y-2">
      {items.map(i => (
        <div key={i.name} className="text-xs">
          <div className="flex justify-between mb-0.5"><span className="truncate">{i.name}</span><span className="tabular-nums text-muted-foreground">{valueLabel ? valueLabel(i.value) : i.value}</span></div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(i.value / max) * 100}%` }} /></div>
        </div>))}
    </div>
  );
}

export function FitnessDashboardView() {
  const [branchId, setBranchId] = React.useState("");
  const { data: branches = [] } = useBranches(true);
  const { data: d, isLoading, error } = useFitnessDashboard(branchId || undefined);
  const cur = useCurrency();
  const money = (n: number) => formatCurrency(n, cur);
  const maxVisits = Math.max(1, ...(d?.last14Days ?? []).map(x => x.visits));

  return (
    <div className="space-y-5">
      <PageHeader title="Fitness dashboard" description="Memberships, attendance and money at a glance.">
        {branches.length > 1 && <select className={cn(SELECT, "w-auto")} value={branchId} onChange={e => setBranchId(e.target.value)}><option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
      </PageHeader>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <Card className="p-6 text-sm"><p className="font-semibold text-destructive">The dashboard could not load.</p><p className="text-muted-foreground mt-1">{(error as Error).message}</p></Card>}
      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Active members" value={d.activeMembers} sub={`${d.totalMembers} on record · ${d.newThisMonth} new this month`} />
            <Stat label="In the gym now" value={d.inGymNow} sub={`${d.visitsToday} visits today`} />
            <Stat label="Expiring soon" value={d.expiringSoon} tone={d.expiringSoon > 0 ? "warn" : undefined} sub={`${d.expiredLast30} lapsed in 30 days`} />
            <Stat label="Frozen" value={d.frozen} />
            <Stat label="Revenue today" value={money(d.revenueToday)} sub={`${money(d.revenueThisMonth)} this month`} />
            <Stat label="Outstanding" value={money(d.outstanding)} tone={d.outstanding > 0 ? "bad" : undefined} />
            <Stat label="Classes today" value={d.classesToday} sub={`${d.bookingsToday} bookings · ${d.ptSessionsToday} PT sessions`} />
            <Stat label="Retention" value={`${d.retentionRate}%`} sub="members who renewed (90 days)" tone={d.retentionRate >= 60 ? "good" : "warn"} />
            <Stat label="Open leads" value={d.openLeads} sub={d.leadsFollowUpDue > 0 ? `${d.leadsFollowUpDue} to follow up` : undefined} tone={d.leadsFollowUpDue > 0 ? "warn" : undefined} />
            <Stat label="Equipment to service" value={d.equipmentNeedingService} tone={d.equipmentNeedingService > 0 ? "warn" : undefined} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4"><p className="font-semibold text-sm mb-3">Visits — last 14 days</p>
              <div className="flex items-end gap-1 h-32">
                {d.last14Days.map(x => (
                  <div key={x.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${formatDate(x.date)}: ${x.visits} visits, ${money(x.revenue)}`}>
                    <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(2, (x.visits / maxVisits) * 100)}%` }} />
                    <span className="text-[9px] text-muted-foreground">{x.date.slice(8)}</span>
                  </div>))}
              </div>
            </Card>
            <Card className="p-4"><p className="font-semibold text-sm mb-3">Busiest hours (30 days)</p><Bars items={d.peakHours.map(h => ({ name: h.name, value: h.count }))} /></Card>
            <Card className="p-4"><p className="font-semibold text-sm mb-3">Members by plan</p><Bars items={d.membersByPlan.map(p => ({ name: p.name, value: p.count }))} /></Card>
            <Card className="p-4"><p className="font-semibold text-sm mb-3">Expiring soon</p>
              {d.expiring.length === 0 ? <p className="text-sm text-muted-foreground">Nobody is about to expire.</p> : (
                <div className="divide-y divide-border">{d.expiring.map(e => (
                  <div key={e.memberId} className="flex justify-between py-1.5 text-sm"><div><p className="font-medium">{e.memberName}</p><p className="text-xs text-muted-foreground">{e.planName}{e.phone ? ` · ${e.phone}` : ""}</p></div>
                    <span className={cn("text-xs font-semibold", e.daysLeft <= 2 ? "text-red-600" : "text-amber-600")}>{e.daysLeft === 0 ? "today" : `${e.daysLeft}d`}</span></div>))}</div>)}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
