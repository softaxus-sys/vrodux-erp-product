import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/auth/can";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { HotelSettingsDto } from "@/lib/hospitality/hospitality.api";
import { useHotelSettings, useUpdateSettings } from "@/hooks/hospitality/use-hospitality";
import { Field, Section, inputCls } from "../../shared/hotel-ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HotelSettingsView() {
  const currency = useCurrency();
  const { data } = useHotelSettings();
  const save = useUpdateSettings();
  const canEdit = useCan("hospitality.settings.edit");
  const [f, setF] = React.useState<HotelSettingsDto | null>(null);
  React.useEffect(() => { if (data && !f) setF(data); }, [data, f]);

  if (!f) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const weekend = f.weekendDays.split(",").filter(Boolean);
  const toggleDay = (d: string) => setF({ ...f, weekendDays: (weekend.includes(d) ? weekend.filter(x => x !== d) : [...weekend, d]).sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)).join(",") });

  // A worked example so the effect of the percentages is visible before saving.
  const sample = 100;
  const service = sample * f.serviceChargePercent / 100;
  const tax = (sample + service) * f.taxPercent / 100;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Hotel settings</h1>
        <p className="text-sm text-muted-foreground">How stays are priced and timed. Changes apply to bookings taken from now on; existing bookings keep the tax and charges they were sold with.</p>
      </div>

      <fieldset disabled={!canEdit} className="space-y-5">
        <Section title="Property">
          <div className="grid sm:grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4">
            <Field label="Property name" className="sm:col-span-3"><input value={f.propertyName ?? ""} onChange={e => setF({ ...f, propertyName: e.target.value })} className={inputCls} placeholder="Shown on the guest bill" /></Field>
            <Field label="Check-in from"><input type="time" value={f.checkInTime} onChange={e => setF({ ...f, checkInTime: e.target.value })} className={inputCls} /></Field>
            <Field label="Check-out by"><input type="time" value={f.checkOutTime} onChange={e => setF({ ...f, checkOutTime: e.target.value })} className={inputCls} /></Field>
          </div>
        </Section>

        <Section title="Weekend nights">
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  className={cn("h-9 w-12 rounded-lg border text-sm font-medium", weekend.includes(d) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted")}>{d}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">The night starting on these days is priced at a season's weekend rate. In the Gulf this is usually Fri and Sat; elsewhere Sat and Sun.</p>
          </div>
        </Section>

        <Section title="Taxes and charges">
          <div className="grid sm:grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4">
            <Field label="Service charge %"><input type="number" min={0} max={100} step="0.01" value={f.serviceChargePercent} onChange={e => setF({ ...f, serviceChargePercent: Number(e.target.value) })} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tax name"><input value={f.taxLabel} onChange={e => setF({ ...f, taxLabel: e.target.value })} className={inputCls} /></Field>
              <Field label="Tax %"><input type="number" min={0} max={100} step="0.01" value={f.taxPercent} onChange={e => setF({ ...f, taxPercent: Number(e.target.value) })} className={inputCls} /></Field>
            </div>
            <Field label="Fixed fee per room per night" hint="e.g. municipality or tourism fee; added untaxed"><input type="number" min={0} step="0.01" value={f.nightlyFee} onChange={e => setF({ ...f, nightlyFee: Number(e.target.value) })} className={inputCls} /></Field>
            <Field label="Fee name"><input value={f.nightlyFeeLabel ?? ""} onChange={e => setF({ ...f, nightlyFeeLabel: e.target.value })} className={inputCls} placeholder="Tourism dirham" /></Field>
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              Example: a night at {formatCurrency(sample, currency)} → service {formatCurrency(service, currency)} → {f.taxLabel || "tax"} on both {formatCurrency(tax, currency)}
              {f.nightlyFee > 0 ? ` → plus ${formatCurrency(f.nightlyFee, currency)} fee` : ""} = <span className="font-semibold">{formatCurrency(sample + service + tax + f.nightlyFee, currency)}</span>.
            </p>
          </div>
        </Section>
      </fieldset>

      {canEdit && (
        <div className="flex justify-end">
          <Button className="gap-2" disabled={save.isPending || weekend.length === 0} onClick={() => save.mutate({ ...f, propertyName: f.propertyName || null, nightlyFeeLabel: f.nightlyFeeLabel || null })}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save settings
          </Button>
        </div>
      )}
    </div>
  );
}
