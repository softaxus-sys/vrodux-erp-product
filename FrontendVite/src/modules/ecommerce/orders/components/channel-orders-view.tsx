import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Download, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useChannelOrders, useChannels, useImportOrders } from "@/hooks/ecommerce/use-ecommerce";
import { ORDER_STATUS_META, meta, type ChannelOrderDto } from "@/lib/ecommerce/ecommerce.api";
import { PageHeader, Pager, Pill, SELECT, SearchBox, TH, TableState, useDebounced } from "../../shared/ui";

const PAGE_SIZE = 25;

function OrderRow({ order }: { order: ChannelOrderDto }) {
  const { t } = useTranslation("ecommerce");
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <tr className="hover:bg-muted/20 cursor-pointer align-top" onClick={() => setOpen(o => !o)}>
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            {open ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground rtl:rotate-180" />}
            <div>
              <p className="font-semibold">{order.orderNumber}</p>
              <p className="text-xs text-muted-foreground">{order.channelName}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <p>{order.customerName ?? "—"}</p>
          {order.email && <p className="text-xs text-muted-foreground" dir="ltr">{order.email}</p>}
        </td>
        <td className="px-4 py-3 tabular-nums font-medium text-end">{formatCurrency(order.total, order.currencyCode ?? undefined)}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{order.financialStatus ?? "—"}</td>
        <td className="px-4 py-3">
          <Pill meta={meta(ORDER_STATUS_META, order.status)}>{t(`orderStatus.${order.status}`)}</Pill>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(order.placedAt)}</td>
      </tr>
      {open && (
        <tr className="bg-muted/10">
          <td colSpan={6} className="px-4 py-3 space-y-3">
            {order.note && <p className="text-xs rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-300/50 px-3 py-2">{order.note}</p>}
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground bg-muted/30">
                  <tr>
                    <th className="text-start px-3 py-2 font-semibold">{t("orders.item")}</th>
                    <th className="text-end px-3 py-2 font-semibold">{t("orders.qty")}</th>
                    <th className="text-end px-3 py-2 font-semibold">{t("orders.price")}</th>
                    <th className="text-start px-3 py-2 font-semibold">{t("orders.stock")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {order.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2"><p>{l.title}</p>{l.sku && <p className="text-muted-foreground" dir="ltr">{l.sku}</p>}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{l.quantity}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{formatCurrency(l.unitPrice, order.currencyCode ?? undefined)}</td>
                      <td className="px-3 py-2">
                        {l.stockReturned ? t("orders.returned") : l.stockTaken ? t("orders.taken")
                          : l.productId ? t("orders.notTaken") : <span className="text-amber-700 dark:text-amber-300">{t("orders.noMatch")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function ChannelOrdersView() {
  const { t } = useTranslation("ecommerce");
  const channels = useChannels();
  const importNow = useImportOrders();
  const [channelId, setChannelId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const q = useDebounced(search);

  React.useEffect(() => setPage(1), [channelId, status, q]);

  const orders = useChannelOrders({ channelId: channelId || undefined, status: status || undefined, search: q || undefined, page, pageSize: PAGE_SIZE });
  const rows = orders.data?.items ?? [];
  const list = channels.data ?? [];

  const runImport = async () => {
    const targets = channelId ? list.filter(c => c.id === channelId) : list.filter(c => c.status !== "paused" && c.importOrders);
    let imported = 0;
    for (const c of targets) {
      try { imported += (await importNow.mutateAsync(c.id)).ordersImported; } catch { /* toast shown */ }
    }
    toast.success(t("orders.imported", { count: imported }));
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.title")} description={t("orders.subtitle")}>
        <Can permission="ecommerce.orders.edit">
          <Button variant="outline" onClick={runImport} disabled={importNow.isPending || list.length === 0} className="gap-1.5">
            {importNow.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t("orders.importNow")}
          </Button>
        </Can>
      </PageHeader>

      <div className="flex flex-wrap gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder={t("orders.search")} className="w-full sm:w-72" />
        {list.length > 1 && (
          <select className={`${SELECT} sm:w-48`} value={channelId} onChange={e => setChannelId(e.target.value)} aria-label={t("listings.store")}>
            <option value="">{t("listings.allStores")}</option>
            {list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select className={`${SELECT} sm:w-48`} value={status} onChange={e => setStatus(e.target.value)} aria-label={t("listings.status")}>
          <option value="">{t("orders.allStatuses")}</option>
          {["imported", "unmatched", "cancelled"].map(s => <option key={s} value={s}>{t(`orderStatus.${s}`)}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        <TableState loading={orders.isLoading} error={orders.error as Error | null} empty={rows.length === 0}
          emptyText={t("orders.empty")} icon={ShoppingCart} />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>{t("orders.order")}</th>
                  <th className={TH}>{t("orders.customer")}</th>
                  <th className={`${TH} text-end`}>{t("orders.total")}</th>
                  <th className={TH}>{t("orders.payment")}</th>
                  <th className={TH}>{t("listings.status")}</th>
                  <th className={TH}>{t("orders.placed")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">{rows.map(o => <OrderRow key={o.id} order={o} />)}</tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageSize={PAGE_SIZE} total={orders.data?.totalCount ?? 0} onPage={setPage} />
      </Card>
    </div>
  );
}
