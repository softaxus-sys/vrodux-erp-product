import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Search, Plus, ClipboardList, AlertTriangle, BookOpen, Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/export-menu";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useLazyList } from "@/hooks/use-lazy-list";
import { Can, useCan } from "@/components/auth/can";
import { useProductionOrders, useProductionSummary } from "@/hooks/manufacturing/use-manufacturing";
import { useModuleLink } from "@/hooks/manufacturing/use-manufacturing-links";
import { PostToFinanceModal } from "./post-to-finance-modal";
import {
  ORDER_STATUSES, fmtQty, manufacturingApi, orderStatusMeta,
  type ProductionOrderDto, type ProductionOrderStatus, type ProductionOrderSummaryDto,
} from "@/lib/manufacturing/manufacturing.api";
import { PlanOrderForm } from "./plan-order-form";
import { OrderDrawer } from "./order-drawer";

const OPEN: ProductionOrderStatus[] = ["planned", "released", "in_progress"];
const TODAY = () => new Date().toISOString().split("T")[0];

const isOverdue = (o: ProductionOrderSummaryDto) =>
  !!o.dueDate && OPEN.includes(o.status) && o.dueDate < TODAY();

function Tile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn("text-2xl font-bold mt-1 tabular-nums", tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function ProductionOrdersView() {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const canView = useCan("manufacturing.orders.view");
  const { data: orders = [], isLoading, isError, error } = useProductionOrders();
  const { data: summary } = useProductionSummary();

  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<"open" | "all" | ProductionOrderStatus>("open");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProductionOrderDto | null>(null);

  // Completed orders whose cost has no journal entry yet, posted together in one go.
  const canEdit = useCan("manufacturing.orders.edit");
  const canPostFinance = useModuleLink("finance", "finance.journals.create") && canEdit;
  const unposted = React.useMemo(() => orders.filter(o => o.status === "completed" && !o.isPosted), [orders]);
  const [toPost, setToPost] = React.useState<ProductionOrderDto[] | null>(null);
  const [loadingPost, setLoadingPost] = React.useState(false);
  const openBulkPost = async () => {
    setLoadingPost(true);
    try { setToPost(await Promise.all(unposted.slice(0, 50).map(o => manufacturingApi.getOrder(o.id)))); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoadingPost(false); }
  };

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter(o => filter === "all" || (filter === "open" ? OPEN.includes(o.status) : o.status === filter))
      .filter(o => !q || o.orderNumber.toLowerCase().includes(q) || o.productName.toLowerCase().includes(q)
        || (o.reference ?? "").toLowerCase().includes(q));
  }, [orders, search, filter]);

  const { visible, hasMore, loadMore, sentinelRef, shown, total } = useLazyList(filtered, 25);

  if (!canView) {
    return <div className="p-12 text-center text-sm text-muted-foreground">{t("orders.noAccess")}</div>;
  }

  const exportColumns = [t("orders.col.order"), t("orders.col.product"), t("orders.field.planned"), t("orders.field.produced"),
    t("orders.field.scrapped"), t("orders.col.warehouse"), t("orders.col.due"), t("orders.field.reference"), t("orders.cost.total"), t("orders.col.status")];
  const exportRows = filtered.map(o => [o.orderNumber, o.productName, o.plannedQuantity, o.producedQuantity, o.scrappedQuantity,
    o.warehouseName, o.dueDate, o.reference, o.totalCost, t(`orderStatus.${o.status}`, { defaultValue: o.status })]);
  const exportCsv = () => downloadFile(`production_orders_${TODAY()}.csv`,
    toCsv(exportRows.map(r => Object.fromEntries(exportColumns.map((c, i) => [c, r[i] ?? ""]))), exportColumns));
  const exportPdfReport = () => exportPdf({
    title: t("orders.title"), subtitle: t("shownOf", { shown: filtered.length, total: orders.length }),
    columns: exportColumns, rows: exportRows, landscape: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("orders.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("orders.description")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canPostFinance && unposted.length > 0 && (
            <Button size="sm" variant="outline" className="h-9 gap-1.5 text-sm" disabled={loadingPost} onClick={openBulkPost}>
              {loadingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
              {t("orders.postUnposted", { n: unposted.length })}
            </Button>
          )}
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={filtered.length === 0} />
          <Can permission="manufacturing.orders.create">
            <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />{t("orders.new")}
            </Button>
          </Can>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile label={t("orderStatus.planned")}     value={summary?.planned ?? 0} />
        <Tile label={t("orderStatus.released")}    value={summary?.released ?? 0} />
        <Tile label={t("orderStatus.in_progress")} value={summary?.inProgress ?? 0} />
        <Tile label={t("orderStatus.completed")}   value={summary?.completed ?? 0} tone="text-success" />
        <Tile label={t("orders.overdue")}          value={summary?.overdue ?? 0} tone={summary?.overdue ? "text-destructive" : undefined} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={t("orders.search")} value={search} onChange={e => setSearch(e.target.value)} className="ps-8 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(["open", "all", ...ORDER_STATUSES] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {f === "open" ? t("orders.filterOpen") : f === "all" ? t("filterAll") : t(`orderStatus.${f}`)}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">{t("loading")}</div>
          ) : isError ? (
            <div className="p-12 text-center text-sm text-destructive">{(error as Error)?.message}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mt-3">
                {orders.length === 0 ? t("orders.emptyFirst") : t("orders.emptyFiltered")}
              </p>
              {orders.length === 0 && summary?.activeBoms === 0 && (
                <Link to="/manufacturing/boms" className="inline-block mt-2 text-sm text-primary hover:underline">
                  {t("orders.createBomFirst")}
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-start font-semibold px-4 py-3">{t("orders.col.order")}</th>
                    <th className="text-start font-semibold px-4 py-3">{t("orders.col.product")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("orders.col.quantity")}</th>
                    <th className="text-start font-semibold px-4 py-3">{t("orders.col.warehouse")}</th>
                    <th className="text-start font-semibold px-4 py-3">{t("orders.col.due")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("orders.cost.total")}</th>
                    <th className="text-start font-semibold px-4 py-3">{t("orders.col.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(o => {
                    const meta = orderStatusMeta(o.status);
                    const overdue = isOverdue(o);
                    return (
                      <tr key={o.id} onClick={() => setSelectedId(o.id)}
                        className="border-t border-border hover:bg-muted/20 cursor-pointer">
                        <td className="px-4 py-3">
                          <p className="font-medium">{o.orderNumber}</p>
                          {o.reference && <p className="text-[11px] text-muted-foreground">{o.reference}</p>}
                          {o.parentOrderNumber && <p className="text-[11px] text-blue-600">{t("orders.subAssemblyOf", { number: o.parentOrderNumber })}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p>{o.productName}</p>
                          {o.productSku && <p className="text-[11px] text-muted-foreground">{o.productSku}</p>}
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums">
                          {o.status === "completed" ? `${fmtQty(o.producedQuantity)} / ` : ""}{fmtQty(o.plannedQuantity)} {o.unit}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{o.warehouseName ?? "—"}</td>
                        <td className={cn("px-4 py-3", overdue && "text-destructive font-medium")}>
                          <span className="inline-flex items-center gap-1">
                            {overdue && <AlertTriangle className="h-3 w-3" />}{formatDate(o.dueDate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(o.totalCost, currency)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", meta.color, meta.bg)}>
                            {t(`orderStatus.${o.status}`, { defaultValue: o.status })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div ref={sentinelRef} />
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
                <span>{t("shownOf", { shown, total })}</span>
                {hasMore && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadMore}>{t("loadMore")}</Button>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDrawer orderId={selectedId} onClose={() => setSelectedId(null)} onOpenOrder={setSelectedId}
        onEdit={order => { setEditing(order); setFormOpen(true); }} />

      <AnimatePresence>
        {toPost && <PostToFinanceModal orders={toPost} onClose={() => setToPost(null)} />}
      </AnimatePresence>

      <PlanOrderForm open={formOpen} editing={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />
    </div>
  );
}
