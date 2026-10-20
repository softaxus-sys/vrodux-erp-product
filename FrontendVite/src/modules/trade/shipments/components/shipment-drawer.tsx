import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, Check, FileText, Loader2, Pencil, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useChangeShipmentStatus, useDeleteShipment, useShipment } from "@/hooks/trade/use-trade";
import { JOURNEY, daysFromToday, localToday, nextStatuses, statusMeta, type ShipmentDto } from "@/lib/trade/trade.api";
import { ConfirmDialog, Field, Modal, Pill, TH } from "../../shared/ui";
import { CostsTab, DocumentsTab, PaymentsTab } from "./shipment-tabs";
import { ShipmentForm } from "./shipment-form";
import { printCommercialInvoice, printPackingList } from "./shipment-print";

type Tab = "overview" | "goods" | "documents" | "costs" | "payments" | "history";

/** The journey as a row of steps: done, current, still to come. A cancelled shipment shows only its state. */
function Stepper({ status }: { status: string }) {
  const { t } = useTranslation("trade");
  if (status === "cancelled") return <Pill meta={statusMeta("cancelled")}>{t("status.cancelled")}</Pill>;
  const at = JOURNEY.indexOf(status as (typeof JOURNEY)[number]);
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1">
      {JOURNEY.map((s, i) => (
        <li key={s} className="flex items-center gap-1 shrink-0">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            i < at && "bg-success/10 text-success", i === at && "bg-primary text-primary-foreground",
            i > at && "bg-muted text-muted-foreground")}>
            {i < at && <Check className="h-3 w-3" />}{t(`status.${s}`)}
          </span>
          {i < JOURNEY.length - 1 && <span className="h-px w-3 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

function StatusDialog({ shipment, onClose }: { shipment: ShipmentDto; onClose: () => void }) {
  const { t } = useTranslation("trade");
  const change = useChangeShipmentStatus();
  const options = nextStatuses(shipment.status);
  const [status, setStatus] = React.useState(options.find(o => o !== "cancelled") ?? options[0]);
  const [date, setDate] = React.useState(localToday());
  const [note, setNote] = React.useState("");

  return (
    <Modal title={t("status.changeTitle")} subtitle={shipment.shipmentNumber} onClose={onClose} size="sm" layer={60}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={change.isPending}>{t("action.cancel")}</Button>
          <Button size="sm" className={cn("gap-1.5", status === "cancelled" && "bg-destructive hover:bg-destructive/90")} disabled={change.isPending || !status}
            onClick={() => change.mutate({ id: shipment.id, status, note: note || null, date }, { onSuccess: onClose })}>
            {change.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("status.confirm")}
          </Button>
        </>
      }>
      <Field label={t("status.moveTo")}>
        <div className="flex flex-wrap gap-2">
          {options.map(o => (
            <button key={o} type="button" onClick={() => setStatus(o)}
              className={cn("rounded-full border px-3 py-1 text-xs font-semibold",
                status === o ? (o === "cancelled" ? "border-destructive bg-destructive/10 text-destructive" : "border-primary bg-primary/10 text-primary") : "border-border text-muted-foreground hover:bg-muted/40")}>
              {t(`status.${o}`)}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t("status.date")}><Input type="date" value={date} max={localToday()} onChange={e => setDate(e.target.value)} className="h-9 text-sm" /></Field>
      <Field label={t("status.note")}><Input value={note} onChange={e => setNote(e.target.value)} className="h-9 text-sm" /></Field>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-end font-medium break-words min-w-0">{children || "—"}</dd>
    </div>
  );
}

function Overview({ s }: { s: ShipmentDto }) {
  const { t } = useTranslation("trade");
  const demurrage = s.freeTimeEnds && ["arrived", "customs"].includes(s.status) ? daysFromToday(s.freeTimeEnds) : null;
  const late = ["booked", "in_transit"].includes(s.status) && s.eta && (daysFromToday(s.eta) ?? 0) < 0;

  return (
    <div className="space-y-4">
      {late && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{t("drawer.late", { days: Math.abs(daysFromToday(s.eta) ?? 0) })}
        </div>
      )}
      {demurrage !== null && demurrage <= 3 && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {demurrage < 0 ? t("drawer.demurrage", { days: Math.abs(demurrage) }) : t("drawer.freeTimeLeft", { days: demurrage })}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-x-8">
        <dl className="divide-y divide-border">
          <Row label={s.direction === "import" ? t("form.supplier") : t("form.buyer")}>{s.partnerName}</Row>
          <Row label={t("form.forwarder")}>{s.forwarderName}</Row>
          <Row label={t("form.agent")}>{s.agentName}</Row>
          <Row label={t("form.orderReference")}>{s.orderReference}</Row>
          <Row label={t("form.incoterm")}>{s.incoterm}</Row>
          <Row label={t("form.mode")}>{t(`mode.${s.mode}`)}</Row>
          <Row label={t("form.carrier")}>{s.carrierName}</Row>
          <Row label={s.mode === "air" ? t("form.flight") : t("form.vessel")}>{s.vesselOrFlight}</Row>
          <Row label={s.mode === "air" ? t("form.awb") : t("form.bl")}>{s.blNumber}</Row>
        </dl>
        <dl className="divide-y divide-border">
          <Row label={t("form.originPort")}>{[s.originPort, s.originCountry].filter(Boolean).join(", ")}</Row>
          <Row label={t("form.destinationPort")}>{[s.destinationPort, s.destinationCountry].filter(Boolean).join(", ")}</Row>
          <Row label={t("form.etd")}>{s.etd && formatDate(s.etd)}</Row>
          <Row label={t("form.eta")}>{s.eta && formatDate(s.eta)}</Row>
          <Row label={t("drawer.departed")}>{s.departedOn && formatDate(s.departedOn)}</Row>
          <Row label={t("drawer.arrived")}>{s.arrivedOn && formatDate(s.arrivedOn)}</Row>
          <Row label={t("drawer.freeUntil")}>{s.freeTimeEnds && formatDate(s.freeTimeEnds)}</Row>
          <Row label={t("drawer.cleared")}>{s.clearedOn && formatDate(s.clearedOn)}</Row>
          <Row label={t("drawer.delivered")}>{s.deliveredOn && formatDate(s.deliveredOn)}</Row>
        </dl>
      </div>

      {s.containers.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-bold">{t("form.containers")}</h4>
          <div className="flex flex-wrap gap-2">
            {s.containers.map(c => (
              <span key={c.id} className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 text-xs">
                <b className="tabular-nums">{c.number}</b>{c.type && ` · ${c.type}`}{c.sealNumber && ` · ${t("print.seal")} ${c.sealNumber}`}
              </span>
            ))}
          </div>
        </div>
      )}
      {s.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg bg-muted/30 p-3">{s.notes}</p>}
    </div>
  );
}

function Goods({ s }: { s: ShipmentDto }) {
  const { t } = useTranslation("trade");
  if (s.items.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">{t("drawer.noGoods")}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs text-muted-foreground">
          <tr>
            <th className={TH}>{t("form.col.description")}</th><th className={TH}>{t("form.col.hsCode")}</th>
            <th className={cn(TH, "text-end")}>{t("form.col.qty")}</th><th className={cn(TH, "text-end")}>{t("form.col.unitPrice")}</th>
            <th className={cn(TH, "text-end")}>{t("print.amount")}</th><th className={cn(TH, "text-end")}>{t("form.col.weight")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {s.items.map(i => (
            <tr key={i.id}>
              <td className="px-4 py-2.5"><p className="font-medium">{i.description}</p>{i.originCountry && <p className="text-xs text-muted-foreground">{i.originCountry}</p>}</td>
              <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{i.hsCode ?? "—"}</td>
              <td className="px-4 py-2.5 text-end tabular-nums">{i.quantity.toLocaleString()} {i.unit}</td>
              <td className="px-4 py-2.5 text-end tabular-nums">{formatCurrency(i.unitPrice, s.currency)}</td>
              <td className="px-4 py-2.5 text-end tabular-nums font-semibold">{formatCurrency(i.lineValue, s.currency)}</td>
              <td className="px-4 py-2.5 text-end tabular-nums text-muted-foreground">{i.weightKg ?? "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/20">
          <tr><td colSpan={4} className="px-4 py-2.5 font-semibold">{t("print.total")}</td>
            <td className="px-4 py-2.5 text-end tabular-nums font-bold">{formatCurrency(s.goodsValue, s.currency)}</td><td /></tr>
        </tfoot>
      </table>
    </div>
  );
}

function History({ s }: { s: ShipmentDto }) {
  const { t } = useTranslation("trade");
  return (
    <ol className="relative border-s border-border ms-2 space-y-4">
      {[...s.milestones].reverse().map(m => (
        <li key={m.id} className="ms-4">
          <span className="absolute -start-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
          <p className="text-sm font-semibold">{t(`status.${m.status}`)}</p>
          <p className="text-xs text-muted-foreground">{formatDate(m.occurredOn)}{m.recordedBy && ` · ${m.recordedBy}`}</p>
          {m.note && <p className="text-sm mt-0.5">{m.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export function ShipmentDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation("trade");
  const { data: s, isLoading, error } = useShipment(id);
  const del = useDeleteShipment();
  const canDocs = useCan("trade.documents.view");
  const [tab, setTab] = React.useState<Tab>("overview");
  const [editing, setEditing] = React.useState(false);
  const [moving, setMoving] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("tabs.overview") }, { id: "goods", label: t("tabs.goods") },
    ...(canDocs ? [{ id: "documents" as Tab, label: `${t("tabs.documents")}${s?.documents.length ? ` (${s.documents.length})` : ""}` }] : []),
    ...(s && s.costs !== null ? [{ id: "costs" as Tab, label: t("tabs.costs") }] : []),
    ...(s && s.payments !== null ? [{ id: "payments" as Tab, label: t("tabs.payments") }] : []),
    { id: "history", label: t("tabs.history") },
  ];

  return (
    <>
      <Modal side size="xl" onClose={onClose}
        title={s ? <span className="flex items-center gap-2">{s.shipmentNumber}<Pill meta={statusMeta(s.status)}>{t(`status.${s.status}`)}</Pill></span> : t("loading")}
        subtitle={s ? `${t(`direction.${s.direction}`)} · ${s.partnerName ?? t("drawer.noPartner")}` : undefined}
        footer={s && (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Can permission="trade.shipments.edit">
                {nextStatuses(s.status).length > 0 && (
                  <Button size="sm" className="gap-1.5" onClick={() => setMoving(true)}><ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />{t("status.update")}</Button>
                )}
                {s.status !== "closed" && s.status !== "cancelled" && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />{t("action.edit")}</Button>
                )}
              </Can>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={s.items.length === 0} onClick={() => printCommercialInvoice(s)}>
                <FileText className="h-3.5 w-3.5" />{t("drawer.invoicePdf")}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={s.items.length === 0} onClick={() => printPackingList(s)}>
                <Printer className="h-3.5 w-3.5" />{t("drawer.packingPdf")}
              </Button>
            </div>
            {(s.status === "booked" || s.status === "cancelled") && (
              <Can permission="trade.shipments.delete">
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setRemoving(true)}><Trash2 className="h-3.5 w-3.5" />{t("action.delete")}</Button>
              </Can>
            )}
          </div>
        )}>
        {isLoading && <p className="text-sm text-muted-foreground text-center py-12">{t("loading")}</p>}
        {error && <p className="text-sm text-destructive text-center py-12">{(error as Error).message}</p>}
        {s && (
          <>
            <Stepper status={s.status} />
            <div className="flex gap-1 border-b border-border overflow-x-auto">
              {tabs.map(x => (
                <button key={x.id} onClick={() => setTab(x.id)}
                  className={cn("px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px",
                    tab === x.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {x.label}
                </button>
              ))}
            </div>
            {tab === "overview" && <Overview s={s} />}
            {tab === "goods" && <Goods s={s} />}
            {tab === "documents" && <DocumentsTab shipment={s} />}
            {tab === "costs" && <CostsTab shipment={s} />}
            {tab === "payments" && <PaymentsTab shipment={s} />}
            {tab === "history" && <History s={s} />}
          </>
        )}
      </Modal>

      <AnimatePresence>
        {s && moving && <StatusDialog shipment={s} onClose={() => setMoving(false)} />}
        {s && editing && <ShipmentForm shipment={s} onClose={() => setEditing(false)} />}
        {s && removing && (
          <ConfirmDialog title={t("drawer.deleteTitle")} body={t("drawer.deleteBody", { number: s.shipmentNumber })} confirmLabel={t("action.delete")}
            pending={del.isPending} onConfirm={() => del.mutate(s.id, { onSuccess: onClose })} onClose={() => setRemoving(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
