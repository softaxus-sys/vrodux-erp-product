import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, Play, PackageMinus, PackageCheck, Ban, Pencil, Trash2, AlertTriangle, Check, ShoppingCart,
  BookOpen, Printer, Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { exportPdf } from "@/lib/pdf";
import { useCurrency } from "@/hooks/use-currency";
import { useCan } from "@/components/auth/can";
import {
  useCancelProductionOrder, useCompleteProductionOrder, useDeleteProductionOrder, useIssueMaterials,
  useProductionOrder, useRecordOperation, useReleaseProductionOrder, useReturnMaterials,
} from "@/hooks/manufacturing/use-manufacturing";
import { useModuleLink, useRequestPurchase } from "@/hooks/manufacturing/use-manufacturing-links";
import { fmtMinutes, fmtQty, orderStatusMeta, type ProductionOrderDto } from "@/lib/manufacturing/manufacturing.api";
import { PostToFinanceModal } from "./post-to-finance-modal";

interface Props {
  orderId: string | null;
  onClose: () => void;
  onEdit: (order: ProductionOrderDto) => void;
  /** Jump to another order — a sub-assembly, or the order it feeds. */
  onOpenOrder?: (id: string) => void;
}

const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
const SECTION = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";
const TH = "font-semibold px-3 py-2";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm mt-0.5">{children}</p>
    </div>
  );
}

export function OrderDrawer({ orderId, onClose, onEdit, onOpenOrder }: Props) {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const canEdit = useCan("manufacturing.orders.edit");
  const canDelete = useCan("manufacturing.orders.delete");
  const canRequestPurchase = useModuleLink("purchase", "purchase.orders.create");
  const canPostFinance = useModuleLink("finance", "finance.journals.create");
  const { data: order, isLoading, isError, error } = useProductionOrder(orderId);

  const release = useReleaseProductionOrder();
  const issue = useIssueMaterials();
  const giveBack = useReturnMaterials();
  const record = useRecordOperation();
  const complete = useCompleteProductionOrder();
  const cancel = useCancelProductionOrder();
  const del = useDeleteProductionOrder();
  const requestPurchase = useRequestPurchase();
  const busy = release.isPending || issue.isPending || giveBack.isPending || complete.isPending || cancel.isPending || del.isPending;

  // componentId → quantity / batch typed for an issue or a return; operationId → minutes typed.
  const [mode, setMode] = React.useState<"issue" | "return">("issue");
  const [qty, setQty] = React.useState<Record<string, string>>({});
  const [batch, setBatch] = React.useState<Record<string, string>>({});
  const [opMinutes, setOpMinutes] = React.useState<Record<string, string>>({});
  const [panel, setPanel] = React.useState<"none" | "complete" | "cancel" | "delete">("none");
  const [produced, setProduced] = React.useState("");
  const [scrapped, setScrapped] = React.useState("");
  const [qualityNotes, setQualityNotes] = React.useState("");
  const [batchNumber, setBatchNumber] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [scrapSeparate, setScrapSeparate] = React.useState(true);
  const [issueRemaining, setIssueRemaining] = React.useState(true);
  const [posting, setPosting] = React.useState(false);

  React.useEffect(() => {
    setQty({}); setBatch({}); setOpMinutes({}); setPanel("none"); setPosting(false); setMode("issue");
  }, [orderId, order?.status]);

  const open = !!orderId;
  const status = order?.status;
  const isOpen = status === "planned" || status === "released" || status === "in_progress";
  const canWork = canEdit && (status === "released" || status === "in_progress");
  const outstanding = order?.components.filter(c => c.remainingQuantity > 0) ?? [];
  const anyIssued = order?.components.some(c => c.issuedQuantity > 0) ?? false;
  const typedLines = Object.entries(qty)
    .map(([componentId, v]) => ({ componentId, quantity: num(v), batchNumber: batch[componentId]?.trim() || null }))
    .filter(l => l.quantity > 0);
  const shortages = (order?.components ?? [])
    .filter(c => c.stockOnHand != null && c.remainingQuantity > c.stockOnHand)
    .map(c => ({ name: c.name, sku: c.sku, unit: c.unit, quantity: c.remainingQuantity - (c.stockOnHand ?? 0), unitCost: c.unitCost }));

  const switchMode = (next: "issue" | "return") => { setMode(next); setQty({}); setBatch({}); };

  const openComplete = () => {
    if (!order) return;
    setProduced(String(order.plannedQuantity)); setScrapped(""); setQualityNotes("");
    setBatchNumber(""); setExpiryDate(""); setScrapSeparate(true);
    setIssueRemaining(outstanding.length > 0);
    setPanel("complete");
  };

  // The paper that goes to the floor: what to pick and what to do, with room to write on.
  const printJobCard = () => {
    if (!order) return;
    exportPdf({
      title: `${t("orders.jobCard")} — ${order.orderNumber}`,
      subtitle: [
        `${order.productName} · ${fmtQty(order.plannedQuantity)} ${order.unit}`,
        order.warehouseName, order.dueDate && `${t("orders.field.due")}: ${formatDate(order.dueDate)}`, order.reference,
      ].filter(Boolean).join(" · "),
      columns: [t("orders.print.type"), t("orders.print.item"), t("orders.print.planned"), t("orders.print.actual"), t("orders.print.batch")],
      rows: [
        ...order.components.map(c => [t("orders.print.material"), `${c.name}${c.sku ? ` (${c.sku})` : ""}`,
          `${fmtQty(c.requiredQuantity)} ${c.unit}`, c.issuedQuantity > 0 ? fmtQty(c.issuedQuantity) : "", ""]),
        ...order.operations.map(o => [t("orders.print.operation"), `${o.name} — ${o.workCentreName}`,
          fmtMinutes(o.plannedMinutes), o.isDone ? fmtMinutes(o.actualMinutes) : "", ""]),
        ...order.outputs.map(o => [t("orders.print.byProduct"), o.name, `${fmtQty(o.plannedQuantity)} ${o.unit}`, "", ""]),
      ],
    });
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
            <motion.div className="fixed end-0 top-0 h-full w-full max-w-2xl bg-card border-s border-border z-50 flex flex-col shadow-2xl"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold truncate">{order?.orderNumber ?? t("orders.drawerTitle")}</h2>
                    {order && (
                      <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", orderStatusMeta(order.status).color, orderStatusMeta(order.status).bg)}>
                        {t(`orderStatus.${order.status}`, { defaultValue: order.status })}
                      </span>
                    )}
                  </div>
                  {order && <p className="text-xs text-muted-foreground mt-0.5 truncate">{order.productName}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {order && (
                    <button onClick={printJobCard} title={t("orders.jobCard")} aria-label={t("orders.jobCard")}
                      className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><Printer className="w-4 h-4" /></button>
                  )}
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground" aria-label={t("action.close")}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin me-2" />{t("loading")}
                </div>
              ) : isError || !order ? (
                <div className="flex-1 flex items-center justify-center text-sm text-destructive px-6 text-center">
                  {(error as Error)?.message ?? t("orders.loadFailed")}
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {order.parentOrderId && (
                      <button type="button" onClick={() => onOpenOrder?.(order.parentOrderId!)}
                        className="w-full text-start rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-sm hover:underline">
                        {t("orders.subAssemblyOf", { number: order.parentOrderNumber })}
                      </button>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <Field label={t("orders.field.planned")}>{fmtQty(order.plannedQuantity)} {order.unit}</Field>
                      <Field label={t("orders.field.produced")}>
                        {order.status === "completed" ? `${fmtQty(order.producedQuantity)} ${order.unit}` : "—"}
                      </Field>
                      <Field label={t("orders.field.scrapped")}>
                        {order.status === "completed" ? fmtQty(order.scrappedQuantity) : "—"}
                      </Field>
                      <Field label={t("orders.field.warehouse")}>{order.warehouseName ?? t("orders.noWarehouse")}</Field>
                      <Field label={t("orders.field.start")}>{formatDate(order.plannedStartDate)}</Field>
                      <Field label={t("orders.field.due")}>{formatDate(order.dueDate)}</Field>
                      <Field label={t("orders.field.bom")}>{order.bomNumber}</Field>
                      <Field label={t("orders.field.reference")}>{order.reference ?? "—"}</Field>
                      <Field label={t("orders.field.batch")}>
                        {order.batchNumber ? `${order.batchNumber}${order.expiryDate ? ` · ${formatDate(order.expiryDate)}` : ""}` : "—"}
                      </Field>
                      <Field label={t("orders.field.requisition")}>{order.requisitionNumber ?? "—"}</Field>
                      <Field label={t("orders.field.ledger")}>{order.journalEntryNumber ?? (order.journalEntryId ? t("orders.posted") : "—")}</Field>
                    </div>

                    {order.notes && <div className="rounded-lg bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">{order.notes}</div>}
                    {order.qualityNotes && (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm whitespace-pre-wrap">
                        <span className="font-semibold">{t("orders.qualityNotes")}: </span>{order.qualityNotes}
                      </div>
                    )}

                    {/* Materials */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className={SECTION}>{t("orders.materials")}</p>
                        <div className="flex items-center gap-3">
                          {canWork && anyIssued && (
                            <button type="button" onClick={() => switchMode(mode === "issue" ? "return" : "issue")}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                              <Undo2 className="h-3 w-3" />{mode === "issue" ? t("orders.returnMode") : t("orders.issueMode")}
                            </button>
                          )}
                          {isOpen && shortages.length > 0 && canRequestPurchase && !order.requisitionNumber && (
                            <button type="button" disabled={requestPurchase.isPending}
                              onClick={() => requestPurchase.mutate({ lines: shortages, reference: order.orderNumber, requiredBy: order.plannedStartDate, orderId: order.id })}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50">
                              {requestPurchase.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
                              {t("orders.requestPurchase")}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className={cn(TH, "text-start")}>{t("orders.col.component")}</th>
                              <th className={cn(TH, "text-end")}>{t("orders.col.required")}</th>
                              <th className={cn(TH, "text-end")}>{t("orders.col.issued")}</th>
                              <th className={cn(TH, "text-end")}>{t("orders.col.onHand")}</th>
                              {canWork && <th className={cn(TH, "text-start w-28")}>{mode === "issue" ? t("orders.col.issueNow") : t("orders.col.returnNow")}</th>}
                              {canWork && <th className={cn(TH, "text-start w-28")}>{t("orders.col.batch")}</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {order.components.map(c => {
                              const short = c.stockOnHand != null && c.remainingQuantity > 0 && c.stockOnHand < c.remainingQuantity;
                              const idle  = mode === "return" && c.issuedQuantity <= 0;
                              return (
                                <tr key={c.id} className="border-t border-border">
                                  <td className="px-3 py-2">
                                    <p className="truncate">{c.name}</p>
                                    {c.sku && <p className="text-[11px] text-muted-foreground">{c.sku}</p>}
                                  </td>
                                  <td className="px-3 py-2 text-end tabular-nums">{fmtQty(c.requiredQuantity)} {c.unit}</td>
                                  <td className={cn("px-3 py-2 text-end tabular-nums", c.remainingQuantity === 0 && "text-success")}>
                                    {fmtQty(c.issuedQuantity)}
                                  </td>
                                  <td className={cn("px-3 py-2 text-end tabular-nums", short && "text-destructive font-medium")}>
                                    <span className="inline-flex items-center gap-1 justify-end">
                                      {short && <AlertTriangle className="h-3 w-3" aria-label={t("orders.short")} />}
                                      {fmtQty(c.stockOnHand)}
                                    </span>
                                  </td>
                                  {canWork && (
                                    <td className="px-3 py-2">
                                      <Input type="number" min={0} step="any" value={qty[c.id] ?? ""} disabled={idle}
                                        max={mode === "return" ? c.issuedQuantity : undefined}
                                        placeholder={mode === "issue" ? fmtQty(c.remainingQuantity) : "0"}
                                        onChange={e => setQty(prev => ({ ...prev, [c.id]: e.target.value }))}
                                        className="h-8 text-sm" />
                                    </td>
                                  )}
                                  {canWork && (
                                    <td className="px-3 py-2">
                                      <Input value={batch[c.id] ?? ""} disabled={idle} placeholder="—"
                                        onChange={e => setBatch(prev => ({ ...prev, [c.id]: e.target.value }))}
                                        className="h-8 text-sm" />
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {canWork && <p className="text-[11px] text-muted-foreground">{mode === "issue" ? t("orders.issueHint") : t("orders.returnHint")}</p>}
                    </div>

                    {/* Operations */}
                    {order.operations.length > 0 && (
                      <div className="space-y-2">
                        <p className={SECTION}>{t("orders.operations")}</p>
                        <div className="rounded-lg border border-border overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <tr>
                                <th className={cn(TH, "text-start")}>{t("orders.col.operation")}</th>
                                <th className={cn(TH, "text-end")}>{t("orders.col.plannedTime")}</th>
                                <th className={cn(TH, "text-end")}>{t("orders.col.actualTime")}</th>
                                {canWork && <th className={cn(TH, "text-start w-40")}>{t("orders.col.recordMinutes")}</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {order.operations.map(op => (
                                <tr key={op.id} className="border-t border-border">
                                  <td className="px-3 py-2">
                                    <p className="truncate">{op.name}</p>
                                    <p className="text-[11px] text-muted-foreground">{op.workCentreName}</p>
                                  </td>
                                  <td className="px-3 py-2 text-end tabular-nums">{fmtMinutes(op.plannedMinutes)}</td>
                                  <td className={cn("px-3 py-2 text-end tabular-nums", op.isDone && "text-success")}>
                                    {op.isDone ? fmtMinutes(op.actualMinutes) : "—"}
                                  </td>
                                  {canWork && (
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-1">
                                        <Input type="number" min={0} step="any" value={opMinutes[op.id] ?? ""}
                                          placeholder={String(op.isDone ? op.actualMinutes : op.plannedMinutes)}
                                          onChange={e => setOpMinutes(prev => ({ ...prev, [op.id]: e.target.value }))}
                                          className="h-8 text-sm" />
                                        <button type="button" disabled={record.isPending}
                                          title={t("orders.recordOperation")} aria-label={t("orders.recordOperation")}
                                          onClick={() => record.mutate({
                                            id: order.id, operationId: op.id,
                                            actualMinutes: opMinutes[op.id] ? num(opMinutes[op.id]) : op.plannedMinutes,
                                          })}
                                          className="p-1.5 rounded-lg text-success hover:bg-success/10 disabled:opacity-50 shrink-0">
                                          <Check className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {canWork && <p className="text-[11px] text-muted-foreground">{t("orders.operationsHint")}</p>}
                      </div>
                    )}

                    {/* By-products */}
                    {order.outputs.length > 0 && (
                      <div className="space-y-2">
                        <p className={SECTION}>{t("orders.byProducts")}</p>
                        <div className="rounded-lg border border-border divide-y divide-border text-sm">
                          {order.outputs.map(o => (
                            <div key={o.id} className="flex items-center justify-between px-3 py-2 gap-3">
                              <span className="truncate">{o.name}</span>
                              <span className="tabular-nums text-muted-foreground shrink-0">
                                {order.status === "completed"
                                  ? t("orders.byProductReceived", { received: fmtQty(o.receivedQuantity), unit: o.unit })
                                  : t("orders.byProductExpected", { planned: fmtQty(o.plannedQuantity), unit: o.unit })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sub-assembly orders */}
                    {order.subOrders.length > 0 && (
                      <div className="space-y-2">
                        <p className={SECTION}>{t("orders.subOrders")}</p>
                        <div className="rounded-lg border border-border divide-y divide-border text-sm">
                          {order.subOrders.map(s => (
                            <button key={s.id} type="button" onClick={() => onOpenOrder?.(s.id)}
                              className="w-full flex items-center justify-between px-3 py-2 gap-3 text-start hover:bg-muted/30">
                              <span className="min-w-0">
                                <span className="block truncate">{s.productName}</span>
                                <span className="block text-[11px] text-muted-foreground">{s.orderNumber} · {fmtQty(s.plannedQuantity)} {s.unit}</span>
                              </span>
                              <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0", orderStatusMeta(s.status).color, orderStatusMeta(s.status).bg)}>
                                {t(`orderStatus.${s.status}`, { defaultValue: s.status })}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Material movements — which batch went where */}
                    {order.issues.length > 0 && (
                      <details className="group">
                        <summary className={cn(SECTION, "cursor-pointer select-none")}>{t("orders.movements", { n: order.issues.length })}</summary>
                        <div className="mt-2 rounded-lg border border-border divide-y divide-border text-sm">
                          {order.issues.map(i => (
                            <div key={i.id} className="flex items-center justify-between px-3 py-1.5 gap-3">
                              <span className="min-w-0">
                                <span className="block truncate">{i.productName}</span>
                                <span className="block text-[11px] text-muted-foreground">
                                  {formatDate(i.createdAt)}{i.batchNumber ? ` · ${t("orders.col.batch")} ${i.batchNumber}` : ""}
                                </span>
                              </span>
                              <span className={cn("tabular-nums shrink-0", i.quantity < 0 ? "text-success" : "")}>
                                {i.quantity < 0 ? t("orders.returned", { quantity: fmtQty(-i.quantity) }) : t("orders.issued", { quantity: fmtQty(i.quantity) })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Cost */}
                    <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("orders.cost.material")}</span><span className="tabular-nums">{formatCurrency(order.materialCost, currency)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("orders.cost.labour")}</span><span className="tabular-nums">{formatCurrency(order.labourCost, currency)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("orders.cost.overhead")}</span><span className="tabular-nums">{formatCurrency(order.overheadCost, currency)}</span></div>
                      <div className="flex justify-between font-semibold border-t border-border pt-1"><span>{t("orders.cost.total")}</span><span className="tabular-nums">{formatCurrency(order.totalCost, currency)}</span></div>
                      {order.scrapCost > 0 && (
                        <div className="flex justify-between text-destructive"><span>{t("orders.cost.scrap")}</span><span className="tabular-nums">{formatCurrency(order.scrapCost, currency)}</span></div>
                      )}
                      {order.status === "completed" && (
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("orders.field.unitCost")}</span><span className="tabular-nums">{formatCurrency(order.unitCost, currency)}</span></div>
                      )}
                    </div>

                    {panel === "complete" && (
                      <div className="rounded-lg border border-border p-4 space-y-3">
                        <p className="text-sm font-semibold">{t("orders.complete.title")}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className={SECTION}>{t("orders.complete.produced", { unit: order.unit })}</label>
                            <Input type="number" min={0} step="any" value={produced} onChange={e => setProduced(e.target.value)} className="h-9 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <label className={SECTION}>{t("orders.complete.scrapped", { unit: order.unit })}</label>
                            <Input type="number" min={0} step="any" value={scrapped} placeholder="0" onChange={e => setScrapped(e.target.value)} className="h-9 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <label className={SECTION}>{t("orders.complete.batch")}</label>
                            <Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder={t("orders.complete.batchPlaceholder")} className="h-9 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <label className={SECTION}>{t("orders.complete.expiry")}</label>
                            <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} disabled={!batchNumber.trim()} className="h-9 text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className={SECTION}>{t("orders.complete.qualityNotes")}</label>
                          <textarea value={qualityNotes} onChange={e => setQualityNotes(e.target.value)} rows={2} maxLength={1000}
                            placeholder={t("orders.complete.qualityPlaceholder")}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                        {num(scrapped) > 0 && (
                          <label className="flex items-start gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={scrapSeparate} onChange={e => setScrapSeparate(e.target.checked)} className="mt-0.5" />
                            <span>{t("orders.complete.scrapSeparate")}</span>
                          </label>
                        )}
                        {outstanding.length > 0 && (
                          <label className="flex items-start gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={issueRemaining} onChange={e => setIssueRemaining(e.target.checked)} className="mt-0.5" />
                            <span>{t("orders.complete.issueRemaining")}</span>
                          </label>
                        )}
                        <p className="text-[11px] text-muted-foreground">{t("orders.complete.hint")}</p>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setPanel("none")} disabled={busy}>{t("action.cancel")}</Button>
                          <Button size="sm" className="gap-1.5" disabled={busy || num(produced) <= 0}
                            onClick={() => complete.mutate({
                              id: order.id, producedQuantity: num(produced), scrappedQuantity: num(scrapped),
                              qualityNotes: qualityNotes.trim() || null,
                              costScrapSeparately: num(scrapped) > 0 && scrapSeparate,
                              batchNumber: batchNumber.trim() || null,
                              expiryDate: batchNumber.trim() && expiryDate ? expiryDate : null,
                              issueRemaining: issueRemaining && outstanding.length > 0,
                            })}>
                            {complete.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
                            {t("orders.complete.confirm")}
                          </Button>
                        </div>
                      </div>
                    )}

                    {(panel === "cancel" || panel === "delete") && (
                      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                        <p className="text-sm font-semibold">{panel === "cancel" ? t("orders.cancelTitle") : t("orders.deleteTitle")}</p>
                        <p className="text-sm text-muted-foreground">{panel === "cancel" ? t("orders.cancelBody") : t("orders.deleteBody")}</p>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setPanel("none")} disabled={busy}>{t("action.back")}</Button>
                          <Button size="sm" className="bg-destructive hover:bg-destructive/90 gap-1.5" disabled={busy}
                            onClick={() => panel === "cancel" ? cancel.mutate(order.id) : del.mutate(order.id, { onSuccess: onClose })}>
                            {(cancel.isPending || del.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {panel === "cancel" ? t("orders.cancelConfirm") : t("action.delete")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {panel === "none" && (
                    <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-end gap-2 shrink-0 empty:hidden">
                      {canDelete && (status === "planned" || status === "cancelled") && (
                        <Button variant="outline" size="sm" className="gap-1.5 me-auto text-destructive" disabled={busy} onClick={() => setPanel("delete")}>
                          <Trash2 className="h-3.5 w-3.5" />{t("action.delete")}
                        </Button>
                      )}
                      {canEdit && !anyIssued && isOpen && (
                        <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => setPanel("cancel")}>
                          <Ban className="h-3.5 w-3.5" />{t("orders.cancelOrder")}
                        </Button>
                      )}
                      {canEdit && status === "planned" && (
                        <>
                          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => onEdit(order)}>
                            <Pencil className="h-3.5 w-3.5" />{t("action.edit")}
                          </Button>
                          <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => release.mutate(order.id)}>
                            {release.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                            {t("orders.release")}
                          </Button>
                        </>
                      )}
                      {canWork && mode === "return" && (
                        <Button variant="outline" size="sm" className="gap-1.5" disabled={busy || typedLines.length === 0}
                          onClick={() => giveBack.mutate({ id: order.id, lines: typedLines })}>
                          {giveBack.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                          {t("orders.returnEntered")}
                        </Button>
                      )}
                      {canWork && mode === "issue" && (
                        <>
                          {(typedLines.length > 0 || outstanding.length > 0) && (
                            <Button variant="outline" size="sm" className="gap-1.5" disabled={busy}
                              onClick={() => issue.mutate({ id: order.id, lines: typedLines.length > 0 ? typedLines : undefined })}>
                              {issue.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageMinus className="h-3.5 w-3.5" />}
                              {typedLines.length > 0 ? t("orders.issueEntered") : t("orders.issueAll")}
                            </Button>
                          )}
                          <Button size="sm" className="gap-1.5" disabled={busy} onClick={openComplete}>
                            <PackageCheck className="h-3.5 w-3.5" />{t("orders.completeOrder")}
                          </Button>
                        </>
                      )}
                      {status === "completed" && canEdit && canPostFinance && !order.journalEntryId && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPosting(true)}>
                          <BookOpen className="h-3.5 w-3.5" />{t("orders.postToFinance")}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {posting && order && <PostToFinanceModal orders={[order]} onClose={() => setPosting(false)} />}
      </AnimatePresence>
    </>
  );
}
