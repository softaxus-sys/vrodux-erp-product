import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2, Plus, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { formatDate } from "@/lib/utils";
import { useDeleteDiscount, useDiscounts, useSaveDiscount, useStoreSettings } from "@/hooks/ecommerce/use-store";
import type { DiscountDto } from "@/lib/ecommerce/store.api";
import { ConfirmDialog, Modal, PageHeader, Pill, TH, TableState } from "../../shared/ui";
import { NumberField, SelectField, TextField, ToggleField } from "./builder-fields";
import { SetupStore } from "./store-settings-view";

const KINDS = [{ value: "percent", label: "Percentage off" }, { value: "fixed", label: "Fixed amount off" }, { value: "free_shipping", label: "Free delivery" }];
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const toIso = (d: string, end = false) => (d ? new Date(`${d}T${end ? "23:59:59" : "00:00:00"}`).toISOString() : null);

function describe(d: DiscountDto, currency: string) {
  return d.kind === "percent" ? `${d.value}% off` : d.kind === "fixed" ? `${d.value} ${currency} off` : "Free delivery";
}

function DiscountDialog({ discount, onClose }: { discount: DiscountDto | null; onClose: () => void }) {
  const save = useSaveDiscount();
  const [code, setCode] = React.useState(discount?.code ?? "");
  const [kind, setKind] = React.useState<DiscountDto["kind"]>(discount?.kind ?? "percent");
  const [value, setValue] = React.useState<number | null>(discount?.value ?? 10);
  const [min, setMin] = React.useState<number | null>(discount?.minSubtotal ?? null);
  const [max, setMax] = React.useState<number | null>(discount?.maxUses ?? null);
  const [from, setFrom] = React.useState(toLocalInput(discount?.startsAt ?? null));
  const [to, setTo] = React.useState(toLocalInput(discount?.endsAt ?? null));
  const [active, setActive] = React.useState(discount?.isActive ?? true);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <Modal title={discount ? "Edit discount code" : "New discount code"} subtitle="Customers type the code at the cart." onClose={onClose} size="md"
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="gap-1.5" disabled={!code.trim() || save.isPending}
          onClick={async () => {
            setError(null);
            try { await save.mutateAsync({ id: discount?.id ?? null, body: { code: code.trim().toUpperCase(), kind, value: kind === "free_shipping" ? 0 : (value ?? 0), minSubtotal: min, maxUses: max, startsAt: toIso(from), endsAt: toIso(to, true), isActive: active } }); onClose(); }
            catch (e) { const fe = (e as { fieldErrors?: Record<string, string[]>; message: string }); setError(Object.values(fe.fieldErrors ?? {})[0]?.[0] ?? fe.message); }
          }}>{save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save</Button>
      </>}>
      <TextField label="Code" value={code} onChange={v => setCode(v.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="WELCOME10" dir="ltr" maxLength={40} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Type" value={kind} onChange={v => setKind(v as DiscountDto["kind"])} options={KINDS} />
        {kind !== "free_shipping" && <NumberField label={kind === "percent" ? "Percent" : "Amount"} value={value} onChange={setValue} min={0} max={kind === "percent" ? 100 : undefined} step={0.01} />}
        <NumberField label="Smallest order" value={min} onChange={setMin} min={0} step={0.01} hint="Empty = no minimum" />
        <NumberField label="Total uses" value={max} onChange={setMax} min={1} hint="Empty = unlimited" />
        <TextField label="Starts" type="date" value={from} onChange={setFrom} />
        <TextField label="Ends" type="date" value={to} onChange={setTo} />
      </div>
      <ToggleField label="Active" checked={active} onChange={setActive} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Modal>
  );
}

export function DiscountsView() {
  const store = useStoreSettings();
  const q = useDiscounts();
  const del = useDeleteDiscount();
  const [editing, setEditing] = React.useState<DiscountDto | "new" | null>(null);
  const [removing, setRemoving] = React.useState<DiscountDto | null>(null);

  if (store.isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!store.data) return <SetupStore />;
  const rows = q.data ?? [];
  const now = Date.now();
  const state = (d: DiscountDto) => !d.isActive ? "Off" : d.endsAt && new Date(d.endsAt).getTime() < now ? "Expired" : d.startsAt && new Date(d.startsAt).getTime() > now ? "Scheduled" : d.maxUses != null && d.usedCount >= d.maxUses ? "Used up" : "Active";

  return (
    <div className="space-y-6">
      <PageHeader title="Discount codes" description="Promotions customers can use at the cart.">
        <Can permission="ecommerce.discounts.create"><Button className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />New code</Button></Can>
      </PageHeader>
      <Card className="overflow-hidden">
        <TableState loading={q.isLoading} error={q.error as Error | null} empty={rows.length === 0} emptyText="No discount codes yet." icon={Tag} />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className={TH}>Code</th><th className={TH}>Offer</th><th className={TH}>Used</th><th className={TH}>Dates</th><th className={TH}>Status</th><th className={TH} /></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map(d => {
                  const s = state(d);
                  return (
                    <tr key={d.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono font-semibold">{d.code}</td>
                      <td className="px-4 py-3">{describe(d, store.data!.currencyCode)}{d.minSubtotal != null && <span className="text-xs text-muted-foreground"> · min {d.minSubtotal}</span>}</td>
                      <td className="px-4 py-3 tabular-nums">{d.usedCount}{d.maxUses != null ? ` / ${d.maxUses}` : ""}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{d.startsAt || d.endsAt ? `${d.startsAt ? formatDate(d.startsAt) : "…"} → ${d.endsAt ? formatDate(d.endsAt) : "…"}` : "Always"}</td>
                      <td className="px-4 py-3"><Pill meta={s === "Active" ? { color: "text-emerald-800", bg: "bg-emerald-100" } : { color: "text-slate-700", bg: "bg-slate-200" }}>{s}</Pill></td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <Can permission="ecommerce.discounts.edit"><Button size="sm" variant="outline" onClick={() => setEditing(d)}>Edit</Button></Can>
                        <Can permission="ecommerce.discounts.delete"><Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoving(d)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button></Can>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AnimatePresence>
        {editing && <DiscountDialog discount={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        {removing && <ConfirmDialog title={`Delete ${removing.code}?`} body={<p>The code stops working. Orders that already used it are not changed.</p>} confirmLabel="Delete" pending={del.isPending}
          onClose={() => setRemoving(null)} onConfirm={async () => { try { await del.mutateAsync(removing.id); setRemoving(null); } catch { /* toast shown */ } }} />}
      </AnimatePresence>
    </div>
  );
}
