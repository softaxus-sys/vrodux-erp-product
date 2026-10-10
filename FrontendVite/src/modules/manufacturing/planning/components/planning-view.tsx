import * as React from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { useCurrency } from "@/hooks/use-currency";
import { useCan } from "@/components/auth/can";
import {
  useMaterialRequirements, useProductionYield, useSchedule, useWip, useWorkCentreLoad,
} from "@/hooks/manufacturing/use-manufacturing";
import { useModuleLink, useRequestPurchase } from "@/hooks/manufacturing/use-manufacturing-links";
import { fmtMinutes, fmtQty, orderStatusMeta } from "@/lib/manufacturing/manufacturing.api";

const TH = "font-semibold px-4 py-3";
type Cell = string | number | null | undefined;

/** First day of the current month, as the default start of the yield period. */
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12).toISOString().split("T")[0]; };
const today = () => new Date().toISOString().split("T")[0];

/** One export definition serves both formats, so the CSV and the PDF can never disagree. */
function exporters(title: string, subtitle: string, columns: string[], rows: Cell[][]) {
  const stamp = today();
  return {
    onCsv: () => downloadFile(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${stamp}.csv`,
      toCsv(rows.map(r => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? ""]))), columns)),
    onPdf: () => exportPdf({ title, subtitle, columns, rows, landscape: columns.length > 6 }),
  };
}

function Section({ id, title, description, actions, children }: {
  id: string; title: string; description: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function State({ loading, error, empty, emptyText, children }: {
  loading: boolean; error: unknown; empty: boolean; emptyText: string; children: React.ReactNode;
}) {
  const { t } = useTranslation("manufacturing");
  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">{t("loading")}</div>;
  if (error)   return <div className="p-10 text-center text-sm text-destructive">{(error as Error)?.message}</div>;
  if (empty)   return <div className="p-10 text-center text-sm text-muted-foreground">{emptyText}</div>;
  return <div className="overflow-x-auto">{children}</div>;
}

function MaterialRequirements() {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const { data: rows = [], isLoading, error } = useMaterialRequirements();
  const canRequest = useModuleLink("purchase", "purchase.orders.create");
  const request = useRequestPurchase();

  const short = rows.filter(r => r.shortage > 0);
  const shortValue = short.reduce((s, r) => s + r.shortage * r.unitCost, 0);
  const exp = exporters(t("planning.requirements.title"), t("planning.requirements.description"),
    [t("orders.col.component"), "SKU", t("planning.requirements.orders"), t("orders.col.required"), t("orders.col.onHand"), t("planning.requirements.shortage")],
    rows.map(r => [r.name, r.sku, r.openOrders, r.required, r.onHand, r.shortage]));

  return (
    <Section id="requirements" title={t("planning.requirements.title")} description={t("planning.requirements.description")}
      actions={<>
        {short.length > 0 && canRequest && (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={request.isPending}
            onClick={() => request.mutate({
              reference: t("planning.requirements.reference"),
              lines: short.map(r => ({ name: r.name, sku: r.sku, unit: r.unit, quantity: r.shortage, unitCost: r.unitCost })),
            })}>
            {request.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
            {t("planning.requirements.requestAll", { n: short.length })}
          </Button>
        )}
        <ExportMenu {...exp} disabled={rows.length === 0} />
      </>}>
      <State loading={isLoading} error={error} empty={rows.length === 0} emptyText={t("planning.requirements.empty")}>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className={cn(TH, "text-start")}>{t("orders.col.component")}</th>
              <th className={cn(TH, "text-end")}>{t("planning.requirements.orders")}</th>
              <th className={cn(TH, "text-end")}>{t("orders.col.required")}</th>
              <th className={cn(TH, "text-end")}>{t("orders.col.onHand")}</th>
              <th className={cn(TH, "text-end")}>{t("planning.requirements.shortage")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.productId} className="border-t border-border">
                <td className="px-4 py-3">
                  <p>{r.name}</p>
                  {r.sku && <p className="text-[11px] text-muted-foreground">{r.sku}</p>}
                </td>
                <td className="px-4 py-3 text-end tabular-nums">{r.openOrders}</td>
                <td className="px-4 py-3 text-end tabular-nums">{fmtQty(r.required)} {r.unit}</td>
                <td className="px-4 py-3 text-end tabular-nums">{fmtQty(r.onHand)}</td>
                <td className={cn("px-4 py-3 text-end tabular-nums", r.shortage > 0 ? "text-destructive font-semibold" : "text-success")}>
                  <span className="inline-flex items-center gap-1 justify-end">
                    {r.shortage > 0 ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {r.shortage > 0 ? `${fmtQty(r.shortage)} ${r.unit}` : t("planning.requirements.covered")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {short.length > 0 && (
          <p className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            {t("planning.requirements.shortValue", { amount: formatCurrency(shortValue, currency) })}
          </p>
        )}
      </State>
    </Section>
  );
}

function WorkCentreLoad() {
  const { t } = useTranslation("manufacturing");
  const { data: rows = [], isLoading, error } = useWorkCentreLoad();
  const exp = exporters(t("planning.load.title"), t("planning.load.description"),
    [t("workCentres.name"), t("planning.load.operations"), t("planning.load.queued"), t("planning.load.capacity"), t("planning.load.days"), t("planning.load.earliestDue")],
    rows.map(r => [r.name, r.openOperations, fmtMinutes(r.remainingMinutes), r.capacityHoursPerDay, r.daysQueued, r.earliestDueDate]));
  const busiest = Math.max(1, ...rows.map(r => r.daysQueued));

  return (
    <Section id="load" title={t("planning.load.title")} description={t("planning.load.description")}
      actions={<ExportMenu {...exp} disabled={rows.length === 0} />}>
      <State loading={isLoading} error={error} empty={rows.length === 0} emptyText={t("planning.load.empty")}>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className={cn(TH, "text-start")}>{t("workCentres.name")}</th>
              <th className={cn(TH, "text-end")}>{t("planning.load.operations")}</th>
              <th className={cn(TH, "text-end")}>{t("planning.load.queued")}</th>
              <th className={cn(TH, "text-end")}>{t("planning.load.capacity")}</th>
              <th className={cn(TH, "text-start w-56")}>{t("planning.load.days")}</th>
              <th className={cn(TH, "text-start")}>{t("planning.load.earliestDue")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.workCentreId} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-end tabular-nums">{r.openOperations}</td>
                <td className="px-4 py-3 text-end tabular-nums">{fmtMinutes(r.remainingMinutes)}</td>
                <td className="px-4 py-3 text-end tabular-nums">{t("planning.load.hoursPerDay", { hours: fmtQty(r.capacityHoursPerDay) })}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full", r.latePressure ? "bg-destructive" : "bg-primary")}
                        style={{ width: `${Math.min(100, (r.daysQueued / busiest) * 100)}%` }} />
                    </div>
                    <span className={cn("tabular-nums text-xs w-14 text-end", r.latePressure && "text-destructive font-semibold")}>
                      {t("planning.load.daysValue", { days: fmtQty(r.daysQueued) })}
                    </span>
                  </div>
                </td>
                <td className={cn("px-4 py-3", r.latePressure && "text-destructive font-medium")}>
                  <span className="inline-flex items-center gap-1">
                    {r.latePressure && <AlertTriangle className="h-3 w-3" />}{formatDate(r.earliestDueDate)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-3 border-t border-border text-xs text-muted-foreground">{t("planning.load.note")}</p>
      </State>
    </Section>
  );
}

function Schedule() {
  const { t } = useTranslation("manufacturing");
  const { data: rows = [], isLoading, error } = useSchedule();
  const exp = exporters(t("planning.schedule.title"), t("planning.schedule.description"),
    [t("orders.col.due"), t("orders.col.order"), t("orders.col.product"), t("orders.col.operation"), t("bomForm.col.workCentre"), t("orders.col.plannedTime"), t("orders.col.status")],
    rows.map(r => [r.dueDate, r.orderNumber, r.productName, r.operationName, r.workCentreName, fmtMinutes(r.plannedMinutes), t(`orderStatus.${r.status}`, { defaultValue: r.status })]));
  const now = today();

  return (
    <Section id="schedule" title={t("planning.schedule.title")} description={t("planning.schedule.description")}
      actions={<ExportMenu {...exp} disabled={rows.length === 0} />}>
      <State loading={isLoading} error={error} empty={rows.length === 0} emptyText={t("planning.schedule.empty")}>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className={cn(TH, "text-start")}>{t("orders.col.due")}</th>
              <th className={cn(TH, "text-start")}>{t("orders.col.order")}</th>
              <th className={cn(TH, "text-start")}>{t("orders.col.operation")}</th>
              <th className={cn(TH, "text-start")}>{t("bomForm.col.workCentre")}</th>
              <th className={cn(TH, "text-end")}>{t("orders.col.plannedTime")}</th>
              <th className={cn(TH, "text-start")}>{t("orders.col.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const late = !!r.dueDate && r.dueDate < now;
              const meta = orderStatusMeta(r.status);
              return (
                <tr key={`${r.orderId}-${i}`} className="border-t border-border">
                  <td className={cn("px-4 py-2.5 whitespace-nowrap", late && "text-destructive font-medium")}>{formatDate(r.dueDate)}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{r.orderNumber}</p>
                    <p className="text-[11px] text-muted-foreground">{r.productName}</p>
                  </td>
                  <td className="px-4 py-2.5">{r.operationName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.workCentreName}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{fmtMinutes(r.plannedMinutes)}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", meta.color, meta.bg)}>
                      {t(`orderStatus.${r.status}`, { defaultValue: r.status })}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </State>
    </Section>
  );
}

function WorkInProgress() {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const { data: rows = [], isLoading, error } = useWip();
  const total = rows.reduce((s, r) => s + r.totalCost, 0);
  const exp = exporters(t("planning.wip.title"), t("planning.wip.description"),
    [t("orders.col.order"), t("orders.col.product"), t("orders.cost.material"), t("orders.cost.labour"), t("orders.cost.overhead"), t("orders.cost.total")],
    rows.map(r => [r.orderNumber, r.productName, r.materialCost, r.labourCost, r.overheadCost, r.totalCost]));

  return (
    <Section id="wip" title={t("planning.wip.title")} description={t("planning.wip.description")}
      actions={<ExportMenu {...exp} disabled={rows.length === 0} />}>
      <State loading={isLoading} error={error} empty={rows.length === 0} emptyText={t("planning.wip.empty")}>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className={cn(TH, "text-start")}>{t("orders.col.order")}</th>
              <th className={cn(TH, "text-end")}>{t("orders.cost.material")}</th>
              <th className={cn(TH, "text-end")}>{t("orders.cost.labour")}</th>
              <th className={cn(TH, "text-end")}>{t("orders.cost.overhead")}</th>
              <th className={cn(TH, "text-end")}>{t("orders.cost.total")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.orderId} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.orderNumber}</p>
                  <p className="text-[11px] text-muted-foreground">{r.productName} · {fmtQty(r.plannedQuantity)} {r.unit}</p>
                </td>
                <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(r.materialCost, currency)}</td>
                <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(r.labourCost, currency)}</td>
                <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(r.overheadCost, currency)}</td>
                <td className="px-4 py-3 text-end tabular-nums font-medium">{formatCurrency(r.totalCost, currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30 font-semibold">
              <td className="px-4 py-3" colSpan={4}>{t("planning.wip.total")}</td>
              <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(total, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </State>
    </Section>
  );
}

function YieldReport() {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const [from, setFrom] = React.useState(monthStart);
  const [to, setTo] = React.useState(today);
  const { data: rows = [], isLoading, error } = useProductionYield(from || undefined, to || undefined);
  const exp = exporters(t("planning.yield.title"), `${from} – ${to}`,
    [t("orders.col.product"), t("planning.yield.orders"), t("orders.field.produced"), t("planning.yield.scrapped"), t("planning.yield.yield"),
      t("orders.cost.material"), t("planning.yield.conversion"), t("orders.cost.scrap"), t("orders.field.unitCost")],
    rows.map(r => [r.productName, r.orders, r.produced, r.scrapped, `${r.yieldPercent}%`, r.materialCost, r.labourCost + r.overheadCost, r.scrapCost, r.averageUnitCost]));

  return (
    <Section id="yield" title={t("planning.yield.title")} description={t("planning.yield.description")}
      actions={<>
        <Input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}
          aria-label={t("planning.yield.from")} className="h-8 text-xs w-36" />
        <span className="text-xs text-muted-foreground">–</span>
        <Input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}
          aria-label={t("planning.yield.to")} className="h-8 text-xs w-36" />
        <ExportMenu {...exp} disabled={rows.length === 0} />
      </>}>
      <State loading={isLoading} error={error} empty={rows.length === 0} emptyText={t("planning.yield.empty")}>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className={cn(TH, "text-start")}>{t("orders.col.product")}</th>
              <th className={cn(TH, "text-end")}>{t("planning.yield.orders")}</th>
              <th className={cn(TH, "text-end")}>{t("orders.field.produced")}</th>
              <th className={cn(TH, "text-end")}>{t("planning.yield.scrapped")}</th>
              <th className={cn(TH, "text-end")}>{t("planning.yield.yield")}</th>
              <th className={cn(TH, "text-end")}>{t("orders.cost.material")}</th>
              <th className={cn(TH, "text-end")}>{t("planning.yield.conversion")}</th>
              <th className={cn(TH, "text-end")}>{t("orders.cost.scrap")}</th>
              <th className={cn(TH, "text-end")}>{t("orders.field.unitCost")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.productId} className="border-t border-border">
                <td className="px-4 py-3">{r.productName}</td>
                <td className="px-4 py-3 text-end tabular-nums">{r.orders}</td>
                <td className="px-4 py-3 text-end tabular-nums">{fmtQty(r.produced)} {r.unit}</td>
                <td className={cn("px-4 py-3 text-end tabular-nums", r.scrapped > 0 && "text-destructive")}>{fmtQty(r.scrapped)}</td>
                <td className={cn("px-4 py-3 text-end tabular-nums font-medium", r.yieldPercent < 95 ? "text-amber-600" : "text-success")}>
                  {r.yieldPercent}%
                </td>
                <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(r.materialCost, currency)}</td>
                <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(r.labourCost + r.overheadCost, currency)}</td>
                <td className={cn("px-4 py-3 text-end tabular-nums", r.scrapCost > 0 && "text-destructive")}>{formatCurrency(r.scrapCost, currency)}</td>
                <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(r.averageUnitCost, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </State>
    </Section>
  );
}

export function PlanningView() {
  const { t } = useTranslation("manufacturing");
  const canView = useCan("manufacturing.planning.view");
  const { hash } = useLocation();

  // Deep links from the Reports hub land on a section (#wip, #yield, …).
  React.useEffect(() => {
    if (!hash || !canView) return;
    const id = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(id);
  }, [hash, canView]);

  if (!canView) return <div className="p-12 text-center text-sm text-muted-foreground">{t("planning.noAccess")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("planning.title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("planning.description")}</p>
      </div>
      <MaterialRequirements />
      <WorkCentreLoad />
      <Schedule />
      <WorkInProgress />
      <YieldReport />
    </div>
  );
}
