import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { getTenantCurrency } from "@/hooks/use-currency";
import { FileSpreadsheet, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { useCurrency, useCurrencyOptions } from "@/hooks/use-currency";
import { useCreateShipment, useParties, useUpdateShipment } from "@/hooks/trade/use-trade";
import {
  CONTAINER_TYPES, INCOTERMS, MODES, type ContainerRequest, type Direction, type ItemRequest, type PartyDto,
  type ShipmentDto, type ShipmentRequest,
} from "@/lib/trade/trade.api";
import { useFieldErrors } from "@/hooks/use-field-errors";
import { Field, Modal, SELECT, num, numOrNull } from "../../shared/ui";
import { PartyForm } from "../../parties/components/parties-view";
import { GoodsImportModal } from "./goods-import-modal";
import { OrderLinkPicker, type OrderLink } from "./order-link";

interface ItemRow {
  description: string; hsCode: string; originCountry: string; quantity: string; unit: string; unitPrice: string;
  weightKg: string; volumeCbm: string; packages: string; sku: string;
  /** Optional Inventory link, carried through edits and set when lines come from an order. */
  productId: string | null;
}
interface ContainerRow { number: string; type: string; sealNumber: string; grossWeightKg: string; }

const blankItem = (): ItemRow => ({ description: "", hsCode: "", originCountry: "", quantity: "1", unit: "pcs", unitPrice: "0", weightKg: "", volumeCbm: "", packages: "", sku: "", productId: null });
const blankContainer = (): ContainerRow => ({ number: "", type: "40HC", sealNumber: "", grossWeightKg: "" });
const text = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

const rowFromRequest = (i: ItemRequest): ItemRow => ({
  description: i.description, hsCode: i.hsCode ?? "", originCountry: i.originCountry ?? "", quantity: String(i.quantity),
  unit: i.unit ?? "pcs", unitPrice: String(i.unitPrice), weightKg: text(i.weightKg), volumeCbm: text(i.volumeCbm),
  packages: text(i.packages), sku: i.sku ?? "", productId: i.productId ?? null,
});

const isBlank = (r: ItemRow) => !r.description.trim() && !r.hsCode && r.unitPrice === "0";

export function ShipmentForm({ shipment, defaultDirection = "import", onClose, onSaved }: {
  shipment: ShipmentDto | null; defaultDirection?: Direction; onClose: () => void; onSaved?: (s: ShipmentDto) => void;
}) {
  const { t } = useTranslation("trade");
  const tenantCurrency = useCurrency();
  const currencies = useCurrencyOptions();
  const create = useCreateShipment();
  const update = useUpdateShipment();
  const fe = useFieldErrors();
  const { data: parties = [] } = useParties({ activeOnly: true });
  const [addingParty, setAddingParty] = React.useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const [direction, setDirection] = React.useState<Direction>(shipment?.direction ?? defaultDirection);
  const [f, setF] = React.useState({
    mode: shipment?.mode ?? "sea", partnerId: shipment?.partnerId ?? "", forwarderId: shipment?.forwarderId ?? "",
    agentId: shipment?.agentId ?? "", orderReference: shipment?.orderReference ?? "", incoterm: shipment?.incoterm ?? "",
    blNumber: shipment?.blNumber ?? "", carrierName: shipment?.carrierName ?? "", vesselOrFlight: shipment?.vesselOrFlight ?? "",
    originCountry: shipment?.originCountry ?? "", originPort: shipment?.originPort ?? "",
    destinationCountry: shipment?.destinationCountry ?? "", destinationPort: shipment?.destinationPort ?? "",
    etd: shipment?.etd ?? "", eta: shipment?.eta ?? "", freeDays: text(shipment?.freeDays),
    currency: shipment?.currency ?? getTenantCurrency(), exchangeRate: String(shipment?.exchangeRate ?? 1), notes: shipment?.notes ?? "",
  });
  const [items, setItems] = React.useState<ItemRow[]>(shipment?.items.map(i => ({
    description: i.description, hsCode: i.hsCode ?? "", originCountry: i.originCountry ?? "", quantity: String(i.quantity),
    unit: i.unit, unitPrice: String(i.unitPrice), weightKg: text(i.weightKg), volumeCbm: text(i.volumeCbm),
    packages: text(i.packages), sku: i.sku ?? "", productId: i.productId,
  })) ?? [blankItem()]);
  const [containers, setContainers] = React.useState<ContainerRow[]>(shipment?.containers.map(c => ({
    number: c.number, type: c.type ?? "", sealNumber: c.sealNumber ?? "", grossWeightKg: text(c.grossWeightKg),
  })) ?? []);

  const [link, setLink] = React.useState<OrderLink | null>(
    shipment?.linkedOrderType && shipment.linkedOrderId
      ? { type: shipment.linkedOrderType, id: shipment.linkedOrderId, number: shipment.orderReference ?? "" } : null);
  const [importing, setImporting] = React.useState(false);

  /** Adds lines to the form. A form that still holds only its empty starter line is replaced, not appended to. */
  const addLines = (lines: ItemRequest[]) =>
    setItems(rows => [...(rows.length === 1 && isBlank(rows[0]) ? [] : rows), ...lines.map(rowFromRequest)]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF(p => ({ ...p, [k]: v })); fe.clearField(String(k)); };
  const setItem = (i: number, patch: Partial<ItemRow>) => setItems(rows => rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const setContainer = (i: number, patch: Partial<ContainerRow>) => setContainers(rows => rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  // Importing, the other side is a supplier; exporting, a buyer. Anyone else can still be picked by name.
  const partnerKind = direction === "import" ? "supplier" : "buyer";
  const partners = parties.filter(p => p.kind === partnerKind);
  const forwarders = parties.filter(p => p.kind === "forwarder" || p.kind === "carrier");
  const agents = parties.filter(p => p.kind === "clearing_agent");

  const sameCurrency = f.currency.toUpperCase() === tenantCurrency.toUpperCase();
  const goodsTotal = items.reduce((sum, r) => sum + Math.round(num(r.quantity) * num(r.unitPrice) * 100) / 100, 0);
  const rate = sameCurrency ? 1 : num(f.exchangeRate);
  const validItems = items.filter(r => r.description.trim());
  const valid = validItems.length === items.length && rate > 0 && f.currency.trim().length === 3
    && containers.every(c => c.number.trim()) && !(f.eta && f.etd && f.eta < f.etd);

  const submit = () => {
    const body: ShipmentRequest = {
      direction, mode: f.mode, partnerId: f.partnerId || null, forwarderId: f.forwarderId || null, agentId: f.agentId || null,
      orderReference: f.orderReference || null, incoterm: f.incoterm || null, blNumber: f.blNumber || null,
      carrierName: f.carrierName || null, vesselOrFlight: f.vesselOrFlight || null,
      originCountry: f.originCountry || null, originPort: f.originPort || null,
      destinationCountry: f.destinationCountry || null, destinationPort: f.destinationPort || null,
      etd: f.etd || null, eta: f.eta || null, freeDays: numOrNull(f.freeDays) === null ? null : Math.round(num(f.freeDays)),
      currency: f.currency.toUpperCase(), exchangeRate: rate, notes: f.notes || null,
      items: validItems.map<ItemRequest>(r => ({
        description: r.description, hsCode: r.hsCode || null, originCountry: r.originCountry || null, quantity: num(r.quantity),
        unit: r.unit || "pcs", unitPrice: num(r.unitPrice), weightKg: numOrNull(r.weightKg), volumeCbm: numOrNull(r.volumeCbm),
        packages: numOrNull(r.packages) === null ? null : Math.round(num(r.packages)), sku: r.sku || null,
        productId: r.productId,
      })),
      linkedOrderType: link?.type ?? null, linkedOrderId: link?.id ?? null,
      containers: containers.map<ContainerRequest>(c => ({
        number: c.number, type: c.type || null, sealNumber: c.sealNumber || null, grossWeightKg: numOrNull(c.grossWeightKg),
      })),
    };
    const opts = { onSuccess: (s: ShipmentDto) => { onSaved?.(s); onClose(); }, onError: (e: unknown) => fe.capture(e) };
    if (shipment) update.mutate({ id: shipment.id, r: body }, opts); else create.mutate(body, opts);
  };

  const cell = "h-8 text-xs";
  const partySelect = (value: string, onChange: (v: string) => void, list: PartyDto[], kind: string) => (
    <div className="flex gap-1">
      <select value={value} onChange={e => onChange(e.target.value)} className={SELECT}>
        <option value="">{t("form.none")}</option>
        {list.map(p => <option key={p.id} value={p.id}>{p.name}{p.country ? ` · ${p.country}` : ""}</option>)}
      </select>
      <Can permission="trade.parties.create">
        <Button type="button" variant="outline" size="sm" className="h-9 px-2 shrink-0" title={t("form.addParty")} onClick={() => setAddingParty(kind)}>
          <Plus className="h-4 w-4" />
        </Button>
      </Can>
    </div>
  );

  return (
    <>
      <Modal title={shipment ? t("form.editTitle", { number: shipment.shipmentNumber }) : t("form.newTitle")}
        subtitle={fe.formError} onClose={onClose} size="xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>{t("action.cancel")}</Button>
            <Button size="sm" className="gap-1.5" disabled={pending || !valid} onClick={submit}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{shipment ? t("action.save") : t("form.create")}
            </Button>
          </>
        }>
        {/* ── What and who ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {!shipment && (
            <Field label={t("form.direction")}>
              <select value={direction} onChange={e => { setDirection(e.target.value as Direction); set("partnerId", ""); }} className={SELECT}>
                <option value="import">{t("direction.import")}</option>
                <option value="export">{t("direction.export")}</option>
              </select>
            </Field>
          )}
          <Field label={t("form.mode")}>
            <select value={f.mode} onChange={e => set("mode", e.target.value)} className={SELECT}>
              {MODES.map(m => <option key={m} value={m}>{t(`mode.${m}`)}</option>)}
            </select>
          </Field>
          <Field label={t("form.incoterm")}>
            <select value={f.incoterm} onChange={e => set("incoterm", e.target.value)} className={SELECT}>
              <option value="">{t("form.none")}</option>
              {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <Field label={t("form.orderReference")}>
            <Input value={f.orderReference} onChange={e => set("orderReference", e.target.value)} className="h-9 text-sm" />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label={direction === "import" ? t("form.supplier") : t("form.buyer")}>
            {partySelect(f.partnerId, v => set("partnerId", v), partners, partnerKind)}
          </Field>
          <Field label={t("form.forwarder")}>{partySelect(f.forwarderId, v => set("forwarderId", v), forwarders, "forwarder")}</Field>
          <Field label={t("form.agent")}>{partySelect(f.agentId, v => set("agentId", v), agents, "clearing_agent")}</Field>
        </div>

        <OrderLinkPicker direction={direction} link={link} onUseLines={addLines}
          onLink={l => { setLink(l); if (l && !f.orderReference.trim()) set("orderReference", l.number); }} />

        {/* ── Route and dates ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label={t("form.originCountry")}><Input value={f.originCountry} onChange={e => set("originCountry", e.target.value)} className="h-9 text-sm" /></Field>
          <Field label={t("form.originPort")}><Input value={f.originPort} onChange={e => set("originPort", e.target.value)} className="h-9 text-sm" /></Field>
          <Field label={t("form.destinationCountry")}><Input value={f.destinationCountry} onChange={e => set("destinationCountry", e.target.value)} className="h-9 text-sm" /></Field>
          <Field label={t("form.destinationPort")}><Input value={f.destinationPort} onChange={e => set("destinationPort", e.target.value)} className="h-9 text-sm" /></Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label={t("form.carrier")}><Input value={f.carrierName} onChange={e => set("carrierName", e.target.value)} className="h-9 text-sm" /></Field>
          <Field label={f.mode === "air" ? t("form.flight") : t("form.vessel")}><Input value={f.vesselOrFlight} onChange={e => set("vesselOrFlight", e.target.value)} className="h-9 text-sm" /></Field>
          <Field label={f.mode === "air" ? t("form.awb") : t("form.bl")}><Input value={f.blNumber} onChange={e => set("blNumber", e.target.value)} className="h-9 text-sm" /></Field>
          <Field label={t("form.freeDays")} hint={t("form.freeDaysHint")}>
            <Input type="number" min={0} value={f.freeDays} onChange={e => set("freeDays", e.target.value)} className="h-9 text-sm" />
          </Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label={t("form.etd")}><Input type="date" value={f.etd} onChange={e => set("etd", e.target.value)} className="h-9 text-sm" /></Field>
          <Field label={t("form.eta")}><Input type="date" value={f.eta} min={f.etd || undefined} onChange={e => set("eta", e.target.value)} className="h-9 text-sm" /></Field>
          <Field label={t("form.currency")}>
            <select value={f.currency} onChange={e => set("currency", e.target.value)} className={SELECT}>
              {Array.from(new Set([f.currency, "USD", ...currencies])).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t("form.rate", { currency: tenantCurrency })}
            hint={sameCurrency ? t("form.rateSame") : t("form.rateHint", { from: f.currency, to: tenantCurrency })}>
            <Input type="number" min={0} step="any" value={sameCurrency ? "1" : f.exchangeRate} disabled={sameCurrency}
              onChange={e => set("exchangeRate", e.target.value)} className="h-9 text-sm" />
          </Field>
        </div>

        {/* ── Goods ──────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">{t("form.goods")}</h3>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setImporting(true)}>
              <FileSpreadsheet className="h-3.5 w-3.5" />{t("form.importGoods")}
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("form.goodsTotal")}: <b>{goodsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {f.currency}</b>
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  {["description", "hsCode", "origin", "qty", "unit", "unitPrice", "weight", "volume"].map(h => (
                    <th key={h} className="text-start font-semibold px-2 py-2 whitespace-nowrap">{t(`form.col.${h}`)}</th>
                  ))}
                  <th className="px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="p-1 min-w-[200px]"><Input value={r.description} onChange={e => setItem(i, { description: e.target.value })} className={cell} aria-label={t("form.col.description")} /></td>
                    <td className="p-1 w-28"><Input value={r.hsCode} onChange={e => setItem(i, { hsCode: e.target.value })} className={cell} /></td>
                    <td className="p-1 w-24"><Input value={r.originCountry} onChange={e => setItem(i, { originCountry: e.target.value })} className={cell} /></td>
                    <td className="p-1 w-20"><Input type="number" min={0} step="any" value={r.quantity} onChange={e => setItem(i, { quantity: e.target.value })} className={cell} /></td>
                    <td className="p-1 w-20"><Input value={r.unit} onChange={e => setItem(i, { unit: e.target.value })} className={cell} /></td>
                    <td className="p-1 w-28"><Input type="number" min={0} step="any" value={r.unitPrice} onChange={e => setItem(i, { unitPrice: e.target.value })} className={cell} /></td>
                    <td className="p-1 w-24"><Input type="number" min={0} step="any" value={r.weightKg} onChange={e => setItem(i, { weightKg: e.target.value })} className={cell} /></td>
                    <td className="p-1 w-24"><Input type="number" min={0} step="any" value={r.volumeCbm} onChange={e => setItem(i, { volumeCbm: e.target.value })} className={cell} /></td>
                    <td className="p-1 w-8">
                      <button className="p-1.5 rounded hover:bg-destructive/10 text-destructive" onClick={() => setItems(rows => rows.filter((_, n) => n !== i))} aria-label={t("action.delete")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setItems(rows => [...rows, blankItem()])}>
            <Plus className="h-3.5 w-3.5" />{t("form.addLine")}
          </Button>
        </div>

        {/* ── Containers ─────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold">{t("form.containers")}</h3>
          {containers.map((c, i) => (
            <div key={i} className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 items-center">
              <Input value={c.number} onChange={e => setContainer(i, { number: e.target.value })} placeholder={t("form.containerNumber")} className="h-9 text-sm uppercase" />
              <select value={c.type} onChange={e => setContainer(i, { type: e.target.value })} className={SELECT}>
                {CONTAINER_TYPES.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <Input value={c.sealNumber} onChange={e => setContainer(i, { sealNumber: e.target.value })} placeholder={t("form.seal")} className="h-9 text-sm" />
              <Input type="number" min={0} step="any" value={c.grossWeightKg} onChange={e => setContainer(i, { grossWeightKg: e.target.value })} placeholder={t("form.grossWeight")} className="h-9 text-sm" />
              <button className="p-1.5 rounded hover:bg-destructive/10 text-destructive justify-self-start" onClick={() => setContainers(rows => rows.filter((_, n) => n !== i))} aria-label={t("action.delete")}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setContainers(rows => [...rows, blankContainer()])}>
            <Plus className="h-3.5 w-3.5" />{t("form.addContainer")}
          </Button>
        </div>

        <Field label={t("form.notes")}>
          <textarea value={f.notes} onChange={e => set("notes", e.target.value)} rows={2}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
        </Field>
      </Modal>

      <AnimatePresence>
        {importing && <GoodsImportModal onImport={addLines} onClose={() => setImporting(false)} />}
        {addingParty && <PartyForm party={null} defaultKind={addingParty} onClose={() => setAddingParty(null)} />}
      </AnimatePresence>
    </>
  );
}
