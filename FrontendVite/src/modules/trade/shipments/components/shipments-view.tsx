import * as React from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowDownToLine, ArrowUpFromLine, Container, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useShipments } from "@/hooks/trade/use-trade";
import { JOURNEY, daysFromToday, statusMeta, type Direction, type ShipmentSummaryDto } from "@/lib/trade/trade.api";
import { PageHeader, Pager, Pill, SearchBox, SELECT, TableState, TH, useDebounced } from "../../shared/ui";
import { ShipmentDrawer } from "./shipment-drawer";
import { ShipmentForm } from "./shipment-form";

const PAGE_SIZE = 25;

/** "in 3 days" / "2 days late" next to an expected arrival that has not happened yet. */
function EtaCell({ s }: { s: ShipmentSummaryDto }) {
  const { t } = useTranslation("trade");
  if (!s.eta) return <span className="text-muted-foreground">—</span>;
  const days = daysFromToday(s.eta);
  const moving = s.status === "booked" || s.status === "in_transit";
  return (
    <div>
      <p>{formatDate(s.eta)}</p>
      {moving && days !== null && (
        <p className={cn("text-[11px]", days < 0 ? "text-destructive font-semibold" : days <= 7 ? "text-amber-600 font-semibold" : "text-muted-foreground")}>
          {days < 0 ? t("list.lateBy", { count: Math.abs(days) }) : days === 0 ? t("list.today") : t("list.inDays", { count: days })}
        </p>
      )}
    </div>
  );
}

export function ShipmentsView() {
  const { t } = useTranslation("trade");
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = React.useState("");
  const [direction, setDirection] = React.useState<"" | Direction>("");
  const [status, setStatus] = React.useState(params.get("status") ?? "");
  const [openOnly, setOpenOnly] = React.useState(params.get("open") === "1");
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(params.get("id"));
  const [creating, setCreating] = React.useState<Direction | null>(null);
  const debounced = useDebounced(search);

  // Links from the dashboard land here with ?id=…; once consumed they should not pin the drawer open.
  React.useEffect(() => {
    if (params.get("id") || params.get("status") || params.get("open")) setParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { setPage(1); }, [debounced, direction, status, openOnly]);

  const { data, isLoading, error } = useShipments({ search: debounced, direction, status, openOnly, page, pageSize: PAGE_SIZE });
  const rows = data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title={t("list.title")} description={t("list.description")}>
        <Can permission="trade.shipments.create">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreating("export")}><ArrowUpFromLine className="h-4 w-4" />{t("list.newExport")}</Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreating("import")}><ArrowDownToLine className="h-4 w-4" />{t("list.newImport")}</Button>
        </Can>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder={t("list.search")} className="w-full sm:w-80" />
        <div className="inline-flex rounded-md border border-input overflow-hidden text-sm">
          {([["", t("list.all")], ["import", t("direction.import")], ["export", t("direction.export")]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setDirection(v as "" | Direction)}
              className={cn("px-3 h-9", direction === v ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted/40")}>{label}</button>
          ))}
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className={`${SELECT} sm:w-44`}>
          <option value="">{t("list.allStatuses")}</option>
          {[...JOURNEY, "cancelled"].map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} />{t("list.openOnly")}
        </label>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableState loading={isLoading} error={error as Error | null} empty={!isLoading && rows.length === 0}
            emptyText={t("list.empty")} icon={Container} />
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className={TH}>{t("list.shipment")}</th><th className={TH}>{t("list.partner")}</th>
                    <th className={TH}>{t("list.route")}</th><th className={TH}>{t("list.eta")}</th>
                    <th className={TH}>{t("list.status")}</th><th className={cn(TH, "text-end")}>{t("list.value")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(s => (
                    <tr key={s.id} onClick={() => setOpenId(s.id)} className="hover:bg-muted/20 cursor-pointer">
                      <td className="px-4 py-3">
                        <p className="font-semibold flex items-center gap-1.5">
                          {s.direction === "import" ? <ArrowDownToLine className="h-3.5 w-3.5 text-blue-600" /> : <ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-600" />}
                          {s.shipmentNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[s.blNumber, s.orderReference, `${s.containerCount} ${t("list.containers")}`].filter(Boolean).join(" · ")}
                        </p>
                      </td>
                      <td className="px-4 py-3">{s.partnerName ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {[s.originPort ?? s.originCountry, s.destinationPort ?? s.destinationCountry].filter(Boolean).join(" → ") || "—"}
                        <p className="text-[11px]">{t(`mode.${s.mode}`)}{s.incoterm ? ` · ${s.incoterm}` : ""}</p>
                      </td>
                      <td className="px-4 py-3"><EtaCell s={s} /></td>
                      <td className="px-4 py-3"><Pill meta={statusMeta(s.status)}>{t(`status.${s.status}`)}</Pill></td>
                      <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(s.goodsValue, s.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
        </CardContent>
      </Card>

      <AnimatePresence>
        {openId && <ShipmentDrawer key={openId} id={openId} onClose={() => setOpenId(null)} />}
        {creating && <ShipmentForm shipment={null} defaultDirection={creating} onClose={() => setCreating(null)} onSaved={s => setOpenId(s.id)} />}
      </AnimatePresence>
    </div>
  );
}
