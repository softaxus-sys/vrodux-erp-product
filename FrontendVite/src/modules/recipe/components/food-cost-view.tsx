import * as React from "react";
import { DollarSign, TrendingUp, TrendingDown, Percent, Loader2, ReceiptText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFoodCostReport } from "@/hooks/recipe/use-recipe";
import { useCurrency } from "@/hooks/use-currency";
import { cn, formatCurrency, fitTextClass } from "@/lib/utils";

function todayIso() { return new Date().toISOString().split("T")[0]; }
function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string }) {
  const isPlain = typeof value === "string" || typeof value === "number";
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2 min-w-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" /><span className="text-xs font-medium truncate">{label}</span>
      </div>
      <p className={cn("font-bold text-foreground truncate", isPlain ? fitTextClass(value, "2xl") : "text-2xl")}
         title={isPlain ? String(value) : undefined}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

export function FoodCostView() {
  const [from, setFrom] = React.useState(daysAgoIso(30));
  const [to, setTo] = React.useState(todayIso());
  const currency = useCurrency();
  const { data, isLoading } = useFoodCostReport(from, to);

  const rows = data?.items ?? [];
  const totals = React.useMemo(() => {
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const foodCost = rows.reduce((s, r) => s + r.foodCost, 0);
    const portions = rows.reduce((s, r) => s + r.portionsSold, 0);
    const margin = revenue > 0 ? ((revenue - foodCost) / revenue) * 100 : null;
    return { revenue, foodCost, portions, margin };
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ReceiptText className="h-6 w-6 text-primary" /> Food Cost Report
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recipe cost vs. actual sales — portions sold, revenue, food cost, and margin per recipe.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} max={to} className="h-9 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} min={from} max={todayIso()} className="h-9 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign}  label="Revenue"     value={formatCurrency(totals.revenue, currency)} />
        <StatCard icon={TrendingDown} label="Food Cost"  value={formatCurrency(totals.foodCost, currency)} />
        <StatCard icon={Percent}     label="Margin"      value={totals.margin != null ? `${totals.margin.toFixed(1)}%` : "—"} />
        <StatCard icon={TrendingUp}  label="Portions Sold" value={totals.portions} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="animate-spin mr-2 h-5 w-5" /> Loading report…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <ReceiptText className="h-10 w-10 mb-3 opacity-20" />
            <p>No recipe sales in this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Recipe</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cost/Serving</th>
                  <th className="px-4 py-2.5 font-medium text-right">Portions Sold</th>
                  <th className="px-4 py-2.5 font-medium text-right">Revenue</th>
                  <th className="px-4 py-2.5 font-medium text-right">Food Cost</th>
                  <th className="px-4 py-2.5 font-medium text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.recipeId} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.menuItemName}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency(r.costPerServing, currency)}</td>
                    <td className="px-4 py-2.5 text-right">{r.portionsSold}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(r.revenue, currency)}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(r.foodCost, currency)}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${
                      r.marginPercent == null ? "text-muted-foreground" : r.marginPercent < 30 ? "text-destructive" : "text-success"
                    }`}>
                      {r.marginPercent != null ? `${r.marginPercent.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
