import { AlertTriangle, CalendarClock, Syringe, Tractor } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useFarmDashboard } from "@/hooks/farming/use-farming";
import { farmTypeLabel, productLabel } from "@/lib/farming/farming.api";
import { PageHeader, Stat, TableState } from "../../shared/ui";

function Bars({ points, unit }: { points: { date: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...points.map(p => p.value));
  return (
    <div className="flex items-end gap-[3px] h-28" role="img" aria-label="Last 30 days">
      {points.map(p => (
        <div key={p.date} className="flex-1 bg-primary/70 rounded-t-sm min-h-[2px]" style={{ height: `${(p.value / max) * 100}%` }}
          title={`${formatDate(p.date)}: ${p.value.toLocaleString()} ${unit}`} />
      ))}
    </div>
  );
}

const ALERT_ICON: Record<string, React.ElementType> = { health_overdue: AlertTriangle, health_due: Syringe, birth_due: CalendarClock, batch_ending: CalendarClock };

export function FarmDashboardView() {
  const cur = useCurrency();
  const { data, isLoading, error } = useFarmDashboard();
  if (!data) return <TableState loading={isLoading} error={error as Error | null} empty={false} emptyText="" icon={Tractor} />;
  const milk = data.milkTrend.some(p => p.value > 0), eggs = data.eggTrend.some(p => p.value > 0);
  const empty = data.activeAnimals === 0 && data.activeBatches === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Farm dashboard" description={`Running: ${data.enabledTypes.map(farmTypeLabel).join(", ")}`} />
      {empty && (
        <Card className="p-5 text-sm">
          <p className="font-semibold">Get started</p>
          <p className="text-muted-foreground mt-1">Add your sheds, ponds and fields under <Link className="text-primary underline" to="/farming/setup">Farms &amp; setup</Link>, then add animals or batches under <Link className="text-primary underline" to="/farming/livestock">Animals &amp; batches</Link>.</p>
        </Card>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Animals" value={data.activeAnimals} sub={data.animalsByType.map(a => `${farmTypeLabel(a.name)} ${a.value}`).join(" · ") || "Tagged animals"} />
        <Stat label="Birds / fish / plants in batches" value={data.headInBatches.toLocaleString()} sub={`${data.activeBatches} active batches`} />
        <Stat label="Sales, last 30 days" value={formatCurrency(data.sales30d, cur)} sub={data.unpaid > 0 ? `${formatCurrency(data.unpaid, cur)} still owed` : "Nothing owed"} tone={data.unpaid > 0 ? "warn" : undefined} />
        <Stat label="Profit, last 30 days" value={formatCurrency(data.profit30d, cur)} tone={data.profit30d < 0 ? "bad" : "good"}
          sub={`Feed ${formatCurrency(data.feedCost30d, cur)} · Vet ${formatCurrency(data.healthCost30d, cur)} · Other ${formatCurrency(data.otherCost30d, cur)}`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2 space-y-4">
          <p className="font-semibold text-sm">Production</p>
          {data.production.length === 0 ? <p className="text-sm text-muted-foreground">No production recorded in the last 30 days.</p> : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="text-start py-1">Product</th><th className="text-end">Today</th><th className="text-end">Last 30 days</th></tr></thead>
              <tbody>{data.production.map(p => (
                <tr key={p.product + p.uom} className="border-t border-border"><td className="py-1.5">{productLabel(p.product)}</td>
                  <td className="text-end tabular-nums">{p.today.toLocaleString()} {p.uom}</td><td className="text-end tabular-nums">{p.last30Days.toLocaleString()} {p.uom}</td></tr>))}</tbody>
            </table>)}
          {milk && <div><p className="text-xs text-muted-foreground mb-1">Milk per day</p><Bars points={data.milkTrend} unit="L" /></div>}
          {eggs && <div><p className="text-xs text-muted-foreground mb-1">Eggs per day</p><Bars points={data.eggTrend} unit="eggs" /></div>}
        </Card>
        <Card className="p-4 space-y-3">
          <p className="font-semibold text-sm">Needs attention</p>
          <p className="text-xs text-muted-foreground">Deaths in the last 30 days: <span className="font-semibold text-foreground">{data.deaths30d}</span></p>
          {data.alerts.length === 0 ? <p className="text-sm text-muted-foreground">Nothing due.</p> : (
            <ul className="space-y-2">{data.alerts.map((a, i) => {
              const Icon = ALERT_ICON[a.kind] ?? CalendarClock;
              return <li key={i} className="flex gap-2 text-sm"><Icon className={a.kind === "health_overdue" ? "h-4 w-4 text-red-600 shrink-0 mt-0.5" : "h-4 w-4 text-amber-600 shrink-0 mt-0.5"} /><span>{a.text}</span></li>;
            })}</ul>)}
        </Card>
      </div>
    </div>
  );
}
