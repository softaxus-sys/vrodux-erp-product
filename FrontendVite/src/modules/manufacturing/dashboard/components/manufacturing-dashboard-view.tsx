import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, ClipboardList, Layers, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useCan } from "@/components/auth/can";
import {
  useMaterialRequirements, useProductionOrders, useProductionSummary, useProductionYield, useWip, useWorkCentreLoad,
} from "@/hooks/manufacturing/use-manufacturing";
import { fmtQty, orderStatusMeta, type ProductionOrderStatus } from "@/lib/manufacturing/manufacturing.api";

const OPEN: ProductionOrderStatus[] = ["planned", "released", "in_progress"];
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12).toISOString().split("T")[0]; };
const today = () => new Date().toISOString().split("T")[0];

function Tile({ label, value, hint, tone, to }: { label: string; value: React.ReactNode; hint?: string; tone?: string; to?: string }) {
  const body = (
    <Card className={cn(to && "hover:border-primary/50 transition-colors")}>
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn("text-2xl font-bold mt-1 tabular-nums truncate", tone)}>{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Panel({ title, to, linkLabel, children }: { title: string; to?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-bold">{title}</h2>
          {to && (
            <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {linkLabel}<ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

const Empty = ({ text }: { text: string }) => <p className="px-4 py-8 text-center text-sm text-muted-foreground">{text}</p>;

export function ManufacturingDashboardView() {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const canOrders = useCan("manufacturing.orders.view");
  const canPlanning = useCan("manufacturing.planning.view");

  const { data: summary } = useProductionSummary(canOrders);
  const { data: orders = [] } = useProductionOrders(undefined, canOrders);
  const { data: requirements = [] } = useMaterialRequirements(canPlanning);
  const { data: wip = [] } = useWip(canPlanning);
  const { data: load = [] } = useWorkCentreLoad(canPlanning);
  const { data: yields = [] } = useProductionYield(monthStart(), today(), canPlanning);

  if (!canOrders && !canPlanning) {
    return <div className="p-12 text-center text-sm text-muted-foreground">{t("orders.noAccess")}</div>;
  }

  const now = today();
  const openOrders = orders.filter(o => OPEN.includes(o.status));
  const upcoming = [...openOrders]
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 6);
  const shortages = requirements.filter(r => r.shortage > 0);
  const wipValue = wip.reduce((s, r) => s + r.totalCost, 0);
  const produced = yields.reduce((s, r) => s + r.produced, 0);
  const scrapped = yields.reduce((s, r) => s + r.scrapped, 0);
  const yieldPct = produced + scrapped > 0 ? Math.round((produced / (produced + scrapped)) * 1000) / 10 : null;
  const monthCost = yields.reduce((s, r) => s + r.materialCost + r.labourCost + r.overheadCost, 0);
  const statusCounts: [ProductionOrderStatus, number][] = [
    ["planned", summary?.planned ?? 0], ["released", summary?.released ?? 0], ["in_progress", summary?.inProgress ?? 0],
    ["completed", summary?.completed ?? 0], ["cancelled", summary?.cancelled ?? 0],
  ];
  const totalOrders = Math.max(1, statusCounts.reduce((s, [, n]) => s + n, 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.description")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { to: "/manufacturing/orders", icon: ClipboardList, label: t("orders.title"), show: canOrders },
            { to: "/manufacturing/boms", icon: Layers, label: t("boms.title"), show: true },
            { to: "/manufacturing/work-centres", icon: Settings2, label: t("workCentres.title"), show: true },
          ].filter(l => l.show).map(l => (
            <Link key={l.to} to={l.to}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm hover:bg-muted/40">
              <l.icon className="h-3.5 w-3.5" />{l.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile label={t("dashboard.openOrders")} value={openOrders.length} to="/manufacturing/orders"
          hint={t("dashboard.inProgress", { n: summary?.inProgress ?? 0 })} />
        <Tile label={t("orders.overdue")} value={summary?.overdue ?? 0} to="/manufacturing/orders"
          tone={summary?.overdue ? "text-destructive" : undefined} />
        {canPlanning && (
          <>
            <Tile label={t("dashboard.shortages")} value={shortages.length} to="/manufacturing/planning#requirements"
              tone={shortages.length ? "text-destructive" : "text-success"} />
            <Tile label={t("planning.wip.title")} value={formatCurrency(wipValue, currency)} to="/manufacturing/planning#wip" />
            <Tile label={t("dashboard.yieldMonth")} value={yieldPct == null ? "—" : `${yieldPct}%`} to="/manufacturing/planning#yield"
              tone={yieldPct != null && yieldPct < 95 ? "text-amber-600" : undefined}
              hint={t("dashboard.producedMonth", { quantity: fmtQty(produced), cost: formatCurrency(monthCost, currency) })} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {canOrders && (
          <Panel title={t("dashboard.byStatus")}>
            <div className="p-4 space-y-2.5">
              {statusCounts.map(([status, count]) => {
                const meta = orderStatusMeta(status);
                return (
                  <div key={status} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-muted-foreground">{t(`orderStatus.${status}`)}</span>
                    <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full", meta.bg, "ring-1 ring-inset ring-current", meta.color)}
                        style={{ width: `${(count / totalOrders) * 100}%` }} />
                    </div>
                    <span className="w-8 text-end tabular-nums font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {canOrders && (
          <Panel title={t("dashboard.upcoming")} to="/manufacturing/orders" linkLabel={t("dashboard.viewAll")}>
            {upcoming.length === 0 ? <Empty text={t("dashboard.noOpenOrders")} /> : (
              <div className="divide-y divide-border">
                {upcoming.map(o => {
                  const late = !!o.dueDate && o.dueDate < now;
                  return (
                    <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{o.productName}</span>
                        <span className="block text-[11px] text-muted-foreground">{o.orderNumber} · {fmtQty(o.plannedQuantity)} {o.unit}</span>
                      </span>
                      <span className={cn("shrink-0 inline-flex items-center gap-1 text-xs", late && "text-destructive font-semibold")}>
                        {late && <AlertTriangle className="h-3 w-3" />}{o.dueDate ? formatDate(o.dueDate) : t("dashboard.noDueDate")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        )}

        {canPlanning && (
          <Panel title={t("dashboard.shortages")} to="/manufacturing/planning#requirements" linkLabel={t("dashboard.viewAll")}>
            {shortages.length === 0 ? <Empty text={t("dashboard.noShortages")} /> : (
              <div className="divide-y divide-border">
                {shortages.slice(0, 6).map(r => (
                  <div key={r.productId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 tabular-nums text-destructive font-medium">−{fmtQty(r.shortage)} {r.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {canPlanning && (
          <Panel title={t("planning.load.title")} to="/manufacturing/planning#load" linkLabel={t("dashboard.viewAll")}>
            {load.length === 0 ? <Empty text={t("planning.load.empty")} /> : (
              <div className="p-4 space-y-2.5">
                {load.slice(0, 6).map(r => {
                  const busiest = Math.max(1, ...load.map(x => x.daysQueued));
                  return (
                    <div key={r.workCentreId} className="flex items-center gap-3 text-sm">
                      <span className="w-32 shrink-0 truncate">{r.name}</span>
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full", r.latePressure ? "bg-destructive" : "bg-primary")}
                          style={{ width: `${Math.min(100, (r.daysQueued / busiest) * 100)}%` }} />
                      </div>
                      <span className={cn("w-16 text-end tabular-nums text-xs", r.latePressure && "text-destructive font-semibold")}>
                        {t("planning.load.daysValue", { days: fmtQty(r.daysQueued) })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
