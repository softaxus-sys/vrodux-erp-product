import * as React from "react";
import { Tags, Plus, Pencil, Trash2, Star, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { MEAL_PLAN_LABELS, localToday, type MealPlan, type RatePlanDto } from "@/lib/hospitality/hospitality.api";
import {
  useRatePlans, useRoomTypes, useCreateRatePlan, useUpdateRatePlan, useDeleteRatePlan, useSetDefaultPlan,
  useAddSeason, useDeleteSeason, useHotelSettings,
} from "@/hooks/hospitality/use-hospitality";
import { Modal, Field, Empty, inputCls, selectCls, textareaCls, dayLabel, addDays } from "../../shared/hotel-ui";

/**
 * How rooms are priced. Each plan (Best Available Rate, Bed & Breakfast, Non-refundable…) has
 * seasons per room type; a night no season covers is sold at the room type's base rate.
 */
export function RatesView() {
  const currency = useCurrency();
  const { data: plans = [], isLoading } = useRatePlans(true);
  const { data: types = [] } = useRoomTypes();
  const { data: settings } = useHotelSettings();
  const [editing, setEditing] = React.useState<RatePlanDto | "new" | null>(null);
  const [seasonFor, setSeasonFor] = React.useState<RatePlanDto | null>(null);
  const setDefault = useSetDefaultPlan();
  const del = useDeleteRatePlan();
  const delSeason = useDeleteSeason();
  const canEdit = useCan("hospitality.rates.edit");
  const today = localToday();

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rates</h1>
          <p className="text-sm text-muted-foreground">Rate plans and the seasons that price them.{settings ? ` Weekend nights: ${settings.weekendDays.replace(/,/g, ", ")}.` : ""}</p>
        </div>
        <Can permission="hospitality.rates.edit"><Button className="gap-2 h-9" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Add rate plan</Button></Can>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Base rates (no season)</p>
        {types.length === 0 ? <p className="text-sm text-muted-foreground">Add room types under Rooms first.</p> : (
          <div className="flex flex-wrap gap-2">
            {types.map(t => <span key={t.id} className="rounded-lg bg-muted px-3 py-1.5 text-sm">{t.name} <span className="font-semibold tabular-nums">{formatCurrency(t.baseRate, currency)}</span></span>)}
          </div>
        )}
      </div>

      {isLoading ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : plans.length === 0 ? (
        <Empty icon={Tags} title="No rate plans" />
      ) : plans.map(p => {
        const upcoming = p.seasons.filter(s => s.toDate >= today);
        const past = p.seasons.length - upcoming.length;
        return (
          <div key={p.id} className={cn("rounded-xl border border-border bg-card", !p.isActive && "opacity-60")}>
            <div className="flex flex-wrap items-start justify-between gap-3 p-4 border-b border-border">
              <div className="min-w-0">
                <p className="font-semibold flex items-center gap-2">{p.name}
                  {p.isDefault && <span className="inline-flex items-center gap-1 text-[11px] text-warning font-semibold"><Star className="h-3 w-3 fill-warning" />Default</span>}
                  {!p.isActive && <span className="text-[11px] text-muted-foreground">switched off</span>}
                </p>
                <p className="text-xs text-muted-foreground">{p.code} · {MEAL_PLAN_LABELS[p.mealPlan] ?? p.mealPlan} · {p.isRefundable ? "Refundable" : "Non-refundable"}</p>
                {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-1">
                  {!p.isDefault && p.isActive && <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => setDefault.mutate(p.id)}><Star className="h-3.5 w-3.5" />Make default</Button>}
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                  {!p.isDefault && <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-destructive" onClick={() => del.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" />Delete</Button>}
                  <Button size="sm" className="h-8 text-xs gap-1" disabled={types.length === 0} onClick={() => setSeasonFor(p)}><Plus className="h-3.5 w-3.5" />Season</Button>
                </div>
              )}
            </div>
            {upcoming.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">No current or upcoming seasons — every night sells at the room type's base rate.{past > 0 ? ` (${past} past season${past === 1 ? "" : "s"} hidden.)` : ""}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="text-start font-medium px-4 py-2">Season</th><th className="text-start font-medium px-4 py-2">Room type</th><th className="text-start font-medium px-4 py-2">Nights</th>
                    <th className="text-end font-medium px-4 py-2">Weekday</th><th className="text-end font-medium px-4 py-2">Weekend</th><th className="text-end font-medium px-4 py-2">Min stay</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {upcoming.map(s => (
                    <tr key={s.id}>
                      <td className="px-4 py-2 font-medium">{s.label}</td>
                      <td className="px-4 py-2">{s.roomTypeName}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{dayLabel(s.fromDate)} – {dayLabel(s.toDate)}</td>
                      <td className="px-4 py-2 text-end tabular-nums">{formatCurrency(s.weekdayRate, currency)}</td>
                      <td className="px-4 py-2 text-end tabular-nums">{s.weekendRate != null ? formatCurrency(s.weekendRate, currency) : "—"}</td>
                      <td className="px-4 py-2 text-end">{s.minNights > 1 ? `${s.minNights} nights` : "—"}</td>
                      <td className="px-2 py-2 text-end">{canEdit && <button onClick={() => delSeason.mutate({ planId: p.id, seasonId: s.id })} className="h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10" aria-label="Delete season"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {editing && <PlanDialog plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {seasonFor && <SeasonDialog plan={seasonFor} onClose={() => setSeasonFor(null)} />}
    </div>
  );
}

function PlanDialog({ plan, onClose }: { plan: RatePlanDto | null; onClose: () => void }) {
  const create = useCreateRatePlan();
  const update = useUpdateRatePlan();
  const [f, setF] = React.useState({
    code: plan?.code ?? "", name: plan?.name ?? "", mealPlan: (plan?.mealPlan ?? "room_only") as MealPlan,
    isRefundable: plan?.isRefundable ?? true, description: plan?.description ?? "", isActive: plan?.isActive ?? true,
  });
  const submit = () => {
    const data = { ...f, description: f.description || null };
    plan ? update.mutate({ id: plan.id, data }, { onSuccess: onClose }) : create.mutate(data, { onSuccess: onClose });
  };
  return (
    <Modal title={plan ? plan.name : "Add rate plan"} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button disabled={!f.code.trim() || !f.name.trim() || create.isPending || update.isPending} onClick={submit}>Save</Button></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Code"><input value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} className={inputCls} placeholder="BB" maxLength={20} /></Field>
        <Field label="Name" className="col-span-2"><input autoFocus value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} placeholder="Bed & Breakfast" /></Field>
      </div>
      <Field label="Meals included"><select value={f.mealPlan} onChange={e => setF({ ...f, mealPlan: e.target.value as MealPlan })} className={selectCls}>
        {(Object.keys(MEAL_PLAN_LABELS) as MealPlan[]).map(m => <option key={m} value={m}>{MEAL_PLAN_LABELS[m]}</option>)}</select></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isRefundable} onChange={e => setF({ ...f, isRefundable: e.target.checked })} />Refundable</label>
      <Field label="Description"><textarea rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className={textareaCls} /></Field>
      {plan && !plan.isDefault && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={e => setF({ ...f, isActive: e.target.checked })} />On sale</label>}
    </Modal>
  );
}

function SeasonDialog({ plan, onClose }: { plan: RatePlanDto; onClose: () => void }) {
  const { data: types = [] } = useRoomTypes();
  const add = useAddSeason();
  const today = localToday();
  const [f, setF] = React.useState({ roomTypeId: types[0]?.id ?? "", label: "", fromDate: today, toDate: addDays(today, 30), weekdayRate: "", weekendRate: "", minNights: 1 });
  React.useEffect(() => { if (!f.roomTypeId && types[0]) setF(s => ({ ...s, roomTypeId: types[0].id })); }, [types, f.roomTypeId]);
  const valid = f.roomTypeId && f.label.trim() && f.toDate >= f.fromDate && Number(f.weekdayRate) > 0 && (f.weekendRate === "" || Number(f.weekendRate) > 0);
  const submit = () => add.mutate({ planId: plan.id, data: {
    roomTypeId: f.roomTypeId, label: f.label, fromDate: f.fromDate, toDate: f.toDate,
    weekdayRate: Number(f.weekdayRate), weekendRate: f.weekendRate === "" ? null : Number(f.weekendRate), minNights: f.minNights,
  } }, { onSuccess: onClose });
  return (
    <Modal title={`Season for ${plan.name}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button disabled={!valid || add.isPending} onClick={submit}>Add season</Button></>}>
      <Field label="Name"><input autoFocus value={f.label} onChange={e => setF({ ...f, label: e.target.value })} className={inputCls} placeholder="Winter high season" /></Field>
      <Field label="Room type"><select value={f.roomTypeId} onChange={e => setF({ ...f, roomTypeId: e.target.value })} className={selectCls}>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First night"><input type="date" value={f.fromDate} onChange={e => setF({ ...f, fromDate: e.target.value })} className={inputCls} /></Field>
        <Field label="Last night"><input type="date" value={f.toDate} min={f.fromDate} onChange={e => setF({ ...f, toDate: e.target.value })} className={inputCls} /></Field>
        <Field label="Weekday rate"><input type="number" min={0} step="0.01" value={f.weekdayRate} onChange={e => setF({ ...f, weekdayRate: e.target.value })} className={inputCls} /></Field>
        <Field label="Weekend rate" hint="Blank = same as weekday"><input type="number" min={0} step="0.01" value={f.weekendRate} onChange={e => setF({ ...f, weekendRate: e.target.value })} className={inputCls} /></Field>
        <Field label="Minimum stay (nights)"><input type="number" min={1} max={60} value={f.minNights} onChange={e => setF({ ...f, minNights: Math.max(1, Number(e.target.value)) })} className={inputCls} /></Field>
      </div>
      <p className="text-[11px] text-muted-foreground flex gap-1"><CalendarRange className="h-3.5 w-3.5 shrink-0" />Where seasons overlap, the one starting latest wins — so a short event period can sit on top of a long season. Bookings already taken keep their price.</p>
    </Modal>
  );
}
