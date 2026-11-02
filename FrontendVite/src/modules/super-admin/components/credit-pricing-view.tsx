import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreditPricingAdmin, useUpdateCreditPricing } from "@/hooks/billing/use-credits";
import type { CreditTierDto } from "@/lib/billing/credits.api";

const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

/** Platform owner: what one credit costs per add-on, bulk discounts, order limits and swap rules. A module with no price is not for sale. */
export function CreditPricingView() {
  const navigate = useNavigate();
  const { data, isLoading } = useCreditPricingAdmin();
  const save = useUpdateCreditPricing();

  const [prices, setPrices] = React.useState<Record<string, string>>({});
  const [tiers, setTiers] = React.useState<CreditTierDto[]>([]);
  const [f, setF] = React.useState({ minCredits: "20", minOrder: "5", maxOrder: "1000", vat: "0", swapEnabled: true, swapFee: "0", minSwap: "10" });

  React.useEffect(() => {
    if (!data) return;
    setPrices(Object.fromEntries(data.modules.map((m) => [m.moduleKey, data.pricePerCredit[m.moduleKey] ? String(data.pricePerCredit[m.moduleKey]) : ""])));
    setTiers(data.tiers);
    setF({ minCredits: String(data.minCredits), minOrder: String(data.minOrderUsd), maxOrder: String(data.maxOrderUsd), vat: String(data.vatPercent),
      swapEnabled: data.swapEnabled, swapFee: String(data.swapFeePercent), minSwap: String(data.minSwapCredits) });
  }, [data]);

  const submit = () => save.mutate({
    pricePerCredit: Object.fromEntries(Object.entries(prices).filter(([, v]) => num(v) > 0).map(([k, v]) => [k, num(v)])),
    tiers, minCredits: Math.round(num(f.minCredits)), minOrderUsd: num(f.minOrder), maxOrderUsd: num(f.maxOrder), vatPercent: num(f.vat),
    swapEnabled: f.swapEnabled, swapFeePercent: num(f.swapFee), minSwapCredits: Math.round(num(f.minSwap)),
  });

  if (isLoading || !data) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/super-admin")}><ArrowLeft className="h-4 w-4" />Back</Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Coins className="h-5 w-5 text-primary" />Credit pricing</h1>
          <p className="text-sm text-muted-foreground">What customers pay for add-on credits. Prices are in USD per credit. Leave a price empty to take that add-on off sale.</p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Price per credit</h2>
        {data.modules.map((m) => (
          <div key={m.moduleKey} className="flex items-center gap-3">
            <span className="w-48 text-sm">{m.name}</span>
            <Input className="max-w-[140px]" inputMode="decimal" placeholder="not for sale" value={prices[m.moduleKey] ?? ""}
              onChange={(e) => setPrices({ ...prices, [m.moduleKey]: e.target.value.replace(/[^\d.]/g, "") })} />
            <span className="text-xs text-muted-foreground">USD</span>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Bulk discount</h2>
        <p className="text-xs text-muted-foreground">The highest row an order reaches applies to the whole order.</p>
        {tiers.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input className="max-w-[130px]" inputMode="numeric" value={t.fromCredits} disabled={i === 0}
              onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, fromCredits: Math.round(num(e.target.value)) } : x))} />
            <span className="text-xs text-muted-foreground">credits or more →</span>
            <Input className="max-w-[90px]" inputMode="decimal" value={t.discountPercent} disabled={i === 0}
              onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, discountPercent: num(e.target.value) } : x))} />
            <span className="text-xs text-muted-foreground">% off</span>
            {i > 0 && <button onClick={() => setTiers(tiers.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTiers([...tiers, { fromCredits: 0, discountPercent: 0 }])}><Plus className="h-3.5 w-3.5" />Add row</Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Order limits and VAT</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Smallest order (credits)" v={f.minCredits} on={(v) => setF({ ...f, minCredits: v })} />
          <Field label="Smallest order (USD)" v={f.minOrder} on={(v) => setF({ ...f, minOrder: v })} />
          <Field label="Largest online order (USD) — above this, contact us" v={f.maxOrder} on={(v) => setF({ ...f, maxOrder: v })} />
          <Field label="VAT % added on top (0 while not VAT-registered)" v={f.vat} on={(v) => setF({ ...f, vat: v })} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Swapping credits between add-ons</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.swapEnabled} onChange={(e) => setF({ ...f, swapEnabled: e.target.checked })} />Allow customers to swap credits</label>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Swap fee % (taken from the value moved)" v={f.swapFee} on={(v) => setF({ ...f, swapFee: v })} />
          <Field label="Smallest swap (credits)" v={f.minSwap} on={(v) => setF({ ...f, minSwap: v })} />
        </div>
        <p className="text-xs text-muted-foreground">Rule shown to customers: credits move at equal value (credits × list price), minus the fee, divided by the other add-on's price, rounded down. Only bought or swapped-in credits can move, never free ones. Consider a fee if one add-on costs you more to run than another.</p>
      </section>

      <Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save pricing"}</Button>
    </div>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label className="text-xs font-medium block">{label}
      <Input className="mt-1" inputMode="decimal" value={v} onChange={(e) => on(e.target.value.replace(/[^\d.]/g, ""))} />
    </label>
  );
}
