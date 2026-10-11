import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { Calculator, Download, FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import {
  useAddCost, useAddDocument, useAddPayment, useDeleteDocument, useDutyEstimate, useRemoveCost, useRemovePayment, useUpdateCost,
  useUpdateDocument, useUpdatePayment,
} from "@/hooks/trade/use-trade";
import {
  ALLOCATION_BASES, COST_TYPES, DOCUMENT_TYPES, PAYMENT_KINDS, daysFromToday, fileToBase64, statusMeta, tradeApi,
  type CostDto, type DocumentDto, type PaymentDto, type ShipmentDto,
} from "@/lib/trade/trade.api";
import { ConfirmDialog, Field, Modal, Pill, SELECT, TH, num } from "../../shared/ui";

const MAX_FILE = 8 * 1024 * 1024;
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>;
}

/** Colours a date by how close it is: red once past, amber inside two weeks. */
function ExpiryText({ date }: { date: string | null }) {
  const { t } = useTranslation("trade");
  if (!date) return <span className="text-muted-foreground">—</span>;
  const d = daysFromToday(date);
  const tone = d === null ? "" : d < 0 ? "text-destructive font-semibold" : d <= 14 ? "text-amber-600 font-semibold" : "";
  return (
    <span className={tone}>
      {formatDate(date)}{d !== null && d < 0 && ` · ${t("tabs.expired")}`}
    </span>
  );
}

// ═══════════════════════════ Documents ═══════════════════════════════════════

function DocumentForm({ shipmentId, doc, onClose }: { shipmentId: string; doc: DocumentDto | null; onClose: () => void }) {
  const { t } = useTranslation("trade");
  const add = useAddDocument();
  const update = useUpdateDocument();
  const [f, setF] = React.useState({
    type: doc?.type ?? "commercial_invoice", number: doc?.number ?? "", issueDate: doc?.issueDate ?? "",
    expiryDate: doc?.expiryDate ?? "", notes: doc?.notes ?? "",
  });
  const [file, setFile] = React.useState<File | null>(null);
  const pending = add.isPending || update.isPending;

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    if (picked && picked.size > MAX_FILE) { toast.error(t("documents.tooLarge")); e.target.value = ""; return; }
    setFile(picked);
  };

  const submit = async () => {
    const r = {
      type: f.type, number: f.number || null, issueDate: f.issueDate || null, expiryDate: f.expiryDate || null,
      notes: f.notes || null,
      ...(file ? { fileName: file.name, contentType: file.type || "application/octet-stream", contentBase64: await fileToBase64(file) } : {}),
    };
    if (doc) update.mutate({ docId: doc.id, r }, { onSuccess: onClose });
    else add.mutate({ id: shipmentId, r }, { onSuccess: onClose });
  };

  return (
    <Modal title={doc ? t("documents.edit") : t("documents.add")} onClose={onClose} size="sm" layer={60}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={pending || (f.issueDate && f.expiryDate ? f.expiryDate < f.issueDate : false)} onClick={submit}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("action.save")}
          </Button>
        </>
      }>
      <Field label={t("documents.type")}>
        <select value={f.type} onChange={e => setF(p => ({ ...p, type: e.target.value }))} className={SELECT}>
          {DOCUMENT_TYPES.map(k => <option key={k} value={k}>{t(`documentType.${k}`)}</option>)}
        </select>
      </Field>
      <Field label={t("documents.number")}><Input value={f.number} onChange={e => setF(p => ({ ...p, number: e.target.value }))} className="h-9 text-sm" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("documents.issueDate")}><Input type="date" value={f.issueDate} onChange={e => setF(p => ({ ...p, issueDate: e.target.value }))} className="h-9 text-sm" /></Field>
        <Field label={t("documents.expiryDate")} hint={t("documents.expiryHint")}>
          <Input type="date" value={f.expiryDate} min={f.issueDate || undefined} onChange={e => setF(p => ({ ...p, expiryDate: e.target.value }))} className="h-9 text-sm" />
        </Field>
      </div>
      <Field label={t("documents.file")} hint={doc?.hasFile ? t("documents.keepFile", { name: doc.fileName }) : t("documents.fileHint")}>
        <input type="file" onChange={pick} className="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary" />
      </Field>
      <Field label={t("documents.notes")}><Input value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} className="h-9 text-sm" /></Field>
    </Modal>
  );
}

export function DocumentsTab({ shipment }: { shipment: ShipmentDto }) {
  const { t } = useTranslation("trade");
  const del = useDeleteDocument();
  const [editing, setEditing] = React.useState<DocumentDto | "new" | null>(null);
  const [removing, setRemoving] = React.useState<DocumentDto | null>(null);
  const locked = shipment.status === "cancelled";

  return (
    <div className="space-y-3">
      {!locked && (
        <Can permission="trade.documents.create">
          <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" />{t("documents.add")}</Button>
        </Can>
      )}
      {shipment.documents.length === 0 ? <Empty text={t("documents.empty")} /> : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {shipment.documents.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t(`documentType.${d.type}`)}{d.number ? ` · ${d.number}` : ""}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {d.issueDate ? `${t("documents.issued")} ${formatDate(d.issueDate)} · ` : ""}
                  {d.expiryDate && <>{t("documents.expires")} <ExpiryText date={d.expiryDate} /> · </>}
                  {d.hasFile ? `${d.fileName} (${kb(d.sizeBytes)})` : t("documents.noFile")}
                </p>
              </div>
              {d.hasFile && (
                <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label={t("documents.download")}
                  onClick={() => tradeApi.downloadDocument(d).catch(e => toast.error(e.message))}><Download className="h-4 w-4" /></button>
              )}
              <Can permission="trade.documents.edit">
                <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" onClick={() => setEditing(d)} aria-label={t("action.edit")}><Pencil className="h-4 w-4" /></button>
              </Can>
              <Can permission="trade.documents.delete">
                <button className="p-1.5 rounded hover:bg-destructive/10 text-destructive" onClick={() => setRemoving(d)} aria-label={t("action.delete")}><Trash2 className="h-4 w-4" /></button>
              </Can>
            </div>
          ))}
        </div>
      )}
      <AnimatePresence>
        {editing && <DocumentForm key={editing === "new" ? "new" : editing.id} shipmentId={shipment.id} doc={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        {removing && (
          <ConfirmDialog title={t("documents.deleteTitle")} body={t("documents.deleteBody")} confirmLabel={t("action.delete")} pending={del.isPending}
            onConfirm={() => del.mutate(removing.id, { onSuccess: () => setRemoving(null) })} onClose={() => setRemoving(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════ Costs & landed cost ═════════════════════════════

function CostForm({ shipment, cost, onClose }: { shipment: ShipmentDto; cost: CostDto | null; onClose: () => void }) {
  const { t } = useTranslation("trade");
  const currency = useCurrency();
  const add = useAddCost();
  const update = useUpdateCost();
  const [f, setF] = React.useState({
    type: cost?.type ?? "freight", amount: String(cost?.amount ?? ""), basis: cost?.basis ?? "value",
    description: cost?.description ?? "", vendorName: cost?.vendorName ?? "", invoiceReference: cost?.invoiceReference ?? "",
    paidOn: cost?.paidOn ?? "",
  });
  const pending = add.isPending || update.isPending;
  const submit = () => {
    const r = {
      type: f.type, amount: num(f.amount), basis: f.basis, description: f.description || null, vendorName: f.vendorName || null,
      invoiceReference: f.invoiceReference || null, paidOn: f.paidOn || null,
    };
    if (cost) update.mutate({ id: shipment.id, costId: cost.id, r }, { onSuccess: onClose });
    else add.mutate({ id: shipment.id, r }, { onSuccess: onClose });
  };

  return (
    <Modal title={cost ? t("costs.edit") : t("costs.add")} onClose={onClose} size="sm" layer={60}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={pending || num(f.amount) <= 0} onClick={submit}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("action.save")}
          </Button>
        </>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("costs.type")}>
          <select value={f.type} onChange={e => setF(p => ({ ...p, type: e.target.value }))} className={SELECT}>
            {COST_TYPES.map(k => <option key={k} value={k}>{t(`costType.${k}`)}</option>)}
          </select>
        </Field>
        <Field label={t("costs.amount", { currency })}>
          <Input type="number" min={0} step="any" value={f.amount} onChange={e => setF(p => ({ ...p, amount: e.target.value }))} className="h-9 text-sm" autoFocus />
        </Field>
      </div>
      <Field label={t("costs.basis")} hint={t("costs.basisHint")}>
        <select value={f.basis} onChange={e => setF(p => ({ ...p, basis: e.target.value }))} className={SELECT}>
          {ALLOCATION_BASES.map(k => <option key={k} value={k}>{t(`basis.${k}`)}</option>)}
        </select>
      </Field>
      <Field label={t("costs.description")}><Input value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} className="h-9 text-sm" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("costs.vendor")}><Input value={f.vendorName} onChange={e => setF(p => ({ ...p, vendorName: e.target.value }))} className="h-9 text-sm" /></Field>
        <Field label={t("costs.invoice")}><Input value={f.invoiceReference} onChange={e => setF(p => ({ ...p, invoiceReference: e.target.value }))} className="h-9 text-sm" /></Field>
      </div>
      <Field label={t("costs.paidOn")}><Input type="date" value={f.paidOn} onChange={e => setF(p => ({ ...p, paidOn: e.target.value }))} className="h-9 text-sm" /></Field>
    </Modal>
  );
}

/**
 * Works out customs duty from the shipment's HS codes and the duty rates, shows the working line by
 * line, and — only when the user says so — records the total as a customs-duty cost. It never adds
 * a cost by itself: an estimate is a suggestion, and lines with no matching rate are called out
 * rather than quietly counted as duty-free.
 */
function DutyEstimateDialog({ shipment, onClose }: { shipment: ShipmentDto; onClose: () => void }) {
  const { t } = useTranslation("trade");
  const currency = useCurrency();
  const add = useAddCost();
  const [cif, setCif] = React.useState(false);
  const { data, isLoading, error } = useDutyEstimate(shipment.id, cif);

  return (
    <Modal title={t("duty.estimateTitle")} subtitle={shipment.shipmentNumber} onClose={onClose} size="lg" layer={60}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>{t("action.close")}</Button>
          <Can permission="trade.costs.create">
            <Button size="sm" className="gap-1.5" disabled={add.isPending || !data || data.totalDuty <= 0}
              onClick={() => add.mutate({ id: shipment.id, r: {
                type: "customs_duty", amount: data!.totalDuty, basis: "value", description: t("duty.costDescription"),
              } }, { onSuccess: onClose })}>
              {add.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("duty.addAsCost")}
            </Button>
          </Can>
        </>
      }>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input type="checkbox" className="mt-0.5" checked={cif} onChange={e => setCif(e.target.checked)} />
        <span>{t("duty.includeCarriage")}<span className="block text-xs text-muted-foreground">{t("duty.includeCarriageHint")}</span></span>
      </label>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-6">{t("loading")}</p>}
      {error && <p className="text-sm text-destructive text-center py-6">{(error as Error).message}</p>}
      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>{t("form.col.description")}</th><th className={TH}>{t("form.col.hsCode")}</th>
                  <th className={cn(TH, "text-end")}>{t("duty.customsValue")}</th><th className={cn(TH, "text-end")}>{t("duty.rate")}</th>
                  <th className={cn(TH, "text-end")}>{t("duty.dutyShort")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.lines.map(l => (
                  <tr key={l.itemId}>
                    <td className="px-4 py-2.5">{l.description}</td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{l.hsCode ?? "—"}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{formatCurrency(l.customsValue, currency)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">
                      {l.rate === null ? <span className="text-amber-600 text-xs font-semibold">{t("duty.noRate")}</span> : `${l.rate}%`}
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums font-semibold">{l.rate === null ? "—" : formatCurrency(l.duty, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/20">
                <tr><td colSpan={2} className="px-4 py-2.5 font-semibold">{t("print.total")}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{formatCurrency(data.customsValue, currency)}</td><td />
                  <td className="px-4 py-2.5 text-end tabular-nums font-bold">{formatCurrency(data.totalDuty, currency)}</td></tr>
              </tfoot>
            </table>
          </div>
          {data.unmatched > 0 && (
            <p className="text-sm rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-3 py-2">
              {t("duty.unmatched", { count: data.unmatched })}{" "}
              <Link to="/trade/duty-rates" className="font-semibold underline">{t("duty.manageRates")}</Link>
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t("duty.estimateNote")}</p>
        </>
      )}
    </Modal>
  );
}

export function CostsTab({ shipment }: { shipment: ShipmentDto }) {
  const { t } = useTranslation("trade");
  const currency = useCurrency();
  const remove = useRemoveCost();
  const [editing, setEditing] = React.useState<CostDto | "new" | null>(null);
  const [removing, setRemoving] = React.useState<CostDto | null>(null);
  const [estimating, setEstimating] = React.useState(false);
  const locked = shipment.status === "closed" || shipment.status === "cancelled";

  if (shipment.costs === null) return <Empty text={t("costs.noAccess")} />;
  const lines = shipment.items.filter(i => i.landedTotal !== null);

  return (
    <div className="space-y-4">
      {/* Where the money goes: goods + costs = landed cost. */}
      <div className="grid grid-cols-3 gap-2">
        {[
          [t("costs.goods"), shipment.goodsValueBase],
          [t("costs.extra"), shipment.totalCosts ?? 0],
          [t("costs.landed"), shipment.landedTotal ?? shipment.goodsValueBase],
        ].map(([label, value], i) => (
          <div key={String(label)} className={cn("rounded-lg border border-border p-3", i === 2 && "bg-primary/5 border-primary/30")}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{formatCurrency(value as number, currency)}</p>
          </div>
        ))}
      </div>
      {shipment.currency.toUpperCase() !== currency.toUpperCase() && (
        <p className="text-xs text-muted-foreground">{t("costs.rateNote", { rate: shipment.exchangeRate, from: shipment.currency, to: currency })}</p>
      )}

      {!locked && (
        <div className="flex flex-wrap gap-2">
          <Can permission="trade.costs.create">
            <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" />{t("costs.add")}</Button>
          </Can>
          {shipment.items.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEstimating(true)}><Calculator className="h-3.5 w-3.5" />{t("duty.estimate")}</Button>
          )}
        </div>
      )}

      {shipment.costs.length === 0 ? <Empty text={t("costs.empty")} /> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr><th className={TH}>{t("costs.type")}</th><th className={TH}>{t("costs.vendor")}</th><th className={TH}>{t("costs.basis")}</th>
                <th className={cn(TH, "text-end")}>{t("costs.amountShort")}</th><th className={TH} /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shipment.costs.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{t(`costType.${c.type}`)}</p>
                    {(c.description || c.invoiceReference) && <p className="text-xs text-muted-foreground">{[c.description, c.invoiceReference].filter(Boolean).join(" · ")}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.vendorName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t(`basis.${c.basis}`)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{formatCurrency(c.amount, currency)}</td>
                  <td className="px-2 py-2.5">
                    {!locked && (
                      <div className="flex justify-end gap-1">
                        <Can permission="trade.costs.edit"><button className="p-1.5 rounded hover:bg-muted text-muted-foreground" onClick={() => setEditing(c)} aria-label={t("action.edit")}><Pencil className="h-4 w-4" /></button></Can>
                        <Can permission="trade.costs.delete"><button className="p-1.5 rounded hover:bg-destructive/10 text-destructive" onClick={() => setRemoving(c)} aria-label={t("action.delete")}><Trash2 className="h-4 w-4" /></button></Can>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* The result: what each line really cost once it was here. */}
      {lines.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-bold">{t("costs.perLine")}</h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr><th className={TH}>{t("form.col.description")}</th><th className={cn(TH, "text-end")}>{t("costs.goodsShort")}</th>
                  <th className={cn(TH, "text-end")}>{t("costs.share")}</th><th className={cn(TH, "text-end")}>{t("costs.landed")}</th>
                  <th className={cn(TH, "text-end")}>{t("costs.perUnit")}</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map(i => (
                  <tr key={i.id}>
                    <td className="px-4 py-2">{i.description}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{formatCurrency(i.goodsValueBase ?? 0, currency)}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{formatCurrency(i.allocatedCost ?? 0, currency)}</td>
                    <td className="px-4 py-2 text-end tabular-nums font-semibold">{formatCurrency(i.landedTotal ?? 0, currency)}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{formatCurrency(i.landedUnitCost ?? 0, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {estimating && <DutyEstimateDialog shipment={shipment} onClose={() => setEstimating(false)} />}
        {editing && <CostForm key={editing === "new" ? "new" : editing.id} shipment={shipment} cost={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        {removing && (
          <ConfirmDialog title={t("costs.deleteTitle")} body={t("costs.deleteBody")} confirmLabel={t("action.delete")} pending={remove.isPending}
            onConfirm={() => remove.mutate({ id: shipment.id, costId: removing.id }, { onSuccess: () => setRemoving(null) })} onClose={() => setRemoving(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════ Payments ════════════════════════════════════════

function PaymentForm({ shipment, payment, onClose }: { shipment: ShipmentDto; payment: PaymentDto | null; onClose: () => void }) {
  const { t } = useTranslation("trade");
  const add = useAddPayment();
  const update = useUpdatePayment();
  const [f, setF] = React.useState({
    kind: payment?.kind ?? "advance", amount: String(payment?.amount ?? ""), dueDate: payment?.dueDate ?? "",
    paidOn: payment?.paidOn ?? "", reference: payment?.reference ?? "", lcNumber: payment?.lcNumber ?? "",
    bankName: payment?.bankName ?? "", lcExpiry: payment?.lcExpiry ?? "", notes: payment?.notes ?? "",
  });
  const pending = add.isPending || update.isPending;
  const submit = () => {
    const r = {
      kind: f.kind, amount: num(f.amount), dueDate: f.dueDate || null, paidOn: f.paidOn || null, reference: f.reference || null,
      lcNumber: f.kind === "lc" ? f.lcNumber || null : null, bankName: f.kind === "lc" ? f.bankName || null : null,
      lcExpiry: f.kind === "lc" ? f.lcExpiry || null : null, notes: f.notes || null,
    };
    if (payment) update.mutate({ id: shipment.id, paymentId: payment.id, r }, { onSuccess: onClose });
    else add.mutate({ id: shipment.id, r }, { onSuccess: onClose });
  };
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));

  return (
    <Modal title={payment ? t("payments.edit") : t("payments.add")} onClose={onClose} size="sm" layer={60}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={pending || num(f.amount) <= 0} onClick={submit}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("action.save")}
          </Button>
        </>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("payments.kind")}>
          <select value={f.kind} onChange={e => set("kind", e.target.value)} className={SELECT}>
            {PAYMENT_KINDS.map(k => <option key={k} value={k}>{t(`paymentKind.${k}`)}</option>)}
          </select>
        </Field>
        <Field label={t("payments.amount", { currency: shipment.currency })}>
          <Input type="number" min={0} step="any" value={f.amount} onChange={e => set("amount", e.target.value)} className="h-9 text-sm" autoFocus />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("payments.dueDate")}><Input type="date" value={f.dueDate} onChange={e => set("dueDate", e.target.value)} className="h-9 text-sm" /></Field>
        <Field label={t("payments.paidOn")} hint={t("payments.paidHint")}><Input type="date" value={f.paidOn} onChange={e => set("paidOn", e.target.value)} className="h-9 text-sm" /></Field>
      </div>
      {f.kind === "lc" && (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("payments.lcNumber")}><Input value={f.lcNumber} onChange={e => set("lcNumber", e.target.value)} className="h-9 text-sm" /></Field>
            <Field label={t("payments.lcExpiry")}><Input type="date" value={f.lcExpiry} onChange={e => set("lcExpiry", e.target.value)} className="h-9 text-sm" /></Field>
          </div>
          <Field label={t("payments.bank")}><Input value={f.bankName} onChange={e => set("bankName", e.target.value)} className="h-9 text-sm" /></Field>
        </div>
      )}
      <Field label={t("payments.reference")}><Input value={f.reference} onChange={e => set("reference", e.target.value)} className="h-9 text-sm" /></Field>
      <Field label={t("payments.notes")}><Input value={f.notes} onChange={e => set("notes", e.target.value)} className="h-9 text-sm" /></Field>
    </Modal>
  );
}

export function PaymentsTab({ shipment }: { shipment: ShipmentDto }) {
  const { t } = useTranslation("trade");
  const remove = useRemovePayment();
  const [editing, setEditing] = React.useState<PaymentDto | "new" | null>(null);
  const [removing, setRemoving] = React.useState<PaymentDto | null>(null);
  const locked = shipment.status === "closed" || shipment.status === "cancelled";

  if (shipment.payments === null) return <Empty text={t("payments.noAccess")} />;
  const importing = shipment.direction === "import";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          [t("payments.invoiceValue"), shipment.goodsValue],
          [importing ? t("payments.paid") : t("payments.received"), shipment.paymentsPaid ?? 0],
          [importing ? t("payments.toPay") : t("payments.toReceive"), shipment.paymentsPending ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-border p-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{formatCurrency(value as number, shipment.currency)}</p>
          </div>
        ))}
      </div>

      {!locked && (
        <Can permission="trade.payments.create">
          <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" />{t("payments.add")}</Button>
        </Can>
      )}

      {shipment.payments.length === 0 ? <Empty text={t("payments.empty")} /> : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {shipment.payments.map(p => {
            const overdue = p.status === "pending" && p.dueDate !== null && (daysFromToday(p.dueDate) ?? 0) < 0;
            return (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {t(`paymentKind.${p.kind}`)} · <span className="tabular-nums">{formatCurrency(p.amount, shipment.currency)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.paidOn ? `${t("payments.paidOnShort")} ${formatDate(p.paidOn)}` : p.dueDate ? <>{t("payments.dueShort")} <span className={overdue ? "text-destructive font-semibold" : ""}>{formatDate(p.dueDate)}</span></> : t("payments.noDate")}
                    {p.lcNumber && ` · LC ${p.lcNumber}`}{p.bankName && ` · ${p.bankName}`}
                    {p.lcExpiry && <> · {t("payments.lcExpires")} <ExpiryText date={p.lcExpiry} /></>}
                    {p.reference && ` · ${p.reference}`}
                  </p>
                </div>
                <Pill meta={overdue ? statusMeta("cancelled") : statusMeta(p.status)}>{overdue ? t("payments.overdue") : t(`paymentStatus.${p.status}`)}</Pill>
                {!locked && (
                  <>
                    <Can permission="trade.payments.edit"><button className="p-1.5 rounded hover:bg-muted text-muted-foreground" onClick={() => setEditing(p)} aria-label={t("action.edit")}><Pencil className="h-4 w-4" /></button></Can>
                    {p.status === "pending" && (
                      <Can permission="trade.payments.edit"><button className="p-1.5 rounded hover:bg-destructive/10 text-destructive" onClick={() => setRemoving(p)} aria-label={t("action.delete")}><Trash2 className="h-4 w-4" /></button></Can>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {editing && <PaymentForm key={editing === "new" ? "new" : editing.id} shipment={shipment} payment={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        {removing && (
          <ConfirmDialog title={t("payments.deleteTitle")} body={t("payments.deleteBody")} confirmLabel={t("action.delete")} pending={remove.isPending}
            onConfirm={() => remove.mutate({ id: shipment.id, paymentId: removing.id }, { onSuccess: () => setRemoving(null) })} onClose={() => setRemoving(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
