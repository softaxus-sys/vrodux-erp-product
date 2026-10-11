import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronRight, PackageSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
import { useInTransit } from "@/hooks/trade/use-trade";
import { statusMeta, type InTransitProductDto } from "@/lib/trade/trade.api";
import { PageHeader, Pill, SearchBox, TableState, TH, useDebounced } from "../../shared/ui";

function Row({ p }: { p: InTransitProductDto }) {
  const { t } = useTranslation("trade");
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <tr className="hover:bg-muted/20 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            {open ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground rtl:rotate-180" />}
            <div>
              <p className="font-medium">{p.description}</p>
              <p className="text-xs text-muted-foreground">
                {p.sku ?? "—"}{!p.productId && ` · ${t("inTransit.notLinked")}`}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-end tabular-nums font-semibold">{p.incoming > 0 ? `${p.incoming.toLocaleString()} ${p.unit}` : "—"}</td>
        <td className="px-4 py-3 text-end tabular-nums text-muted-foreground">{p.outgoing > 0 ? `${p.outgoing.toLocaleString()} ${p.unit}` : "—"}</td>
        <td className="px-4 py-3">
          {p.nextEta ? formatDate(p.nextEta) : <span className="text-muted-foreground">—</span>}
          {p.delayed && <span className="ms-2 text-[11px] font-semibold text-destructive">{t("inTransit.delayed")}</span>}
        </td>
        <td className="px-4 py-3 tabular-nums">{p.shipments}</td>
      </tr>
      {open && (
        <tr className="bg-muted/10">
          <td colSpan={5} className="px-4 py-3">
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {p.lines.map(l => (
                <li key={`${l.shipmentId}-${l.quantity}`}>
                  <Link to={`/trade/shipments?id=${l.shipmentId}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/30">
                    {l.direction === "import" ? <ArrowDownToLine className="h-3.5 w-3.5 text-blue-600" /> : <ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-600" />}
                    <span className="font-medium">{l.shipmentNumber}</span>
                    <Pill meta={statusMeta(l.status)}>{t(`status.${l.status}`)}</Pill>
                    <span className="ms-auto tabular-nums">{l.quantity.toLocaleString()} {p.unit}</span>
                    <span className={cn("w-28 text-end text-xs", "text-muted-foreground")}>{l.eta ? formatDate(l.eta) : "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

export function InTransitView() {
  const { t } = useTranslation("trade");
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search);
  const { data = [], isLoading, error } = useInTransit({ search: debounced });

  return (
    <div className="space-y-5">
      <PageHeader title={t("inTransit.title")} description={t("inTransit.description")} />
      <SearchBox value={search} onChange={setSearch} placeholder={t("inTransit.search")} className="w-full sm:w-80" />
      <Card>
        <CardContent className="p-0">
          <TableState loading={isLoading} error={error as Error | null} empty={!isLoading && data.length === 0}
            emptyText={t("inTransit.empty")} icon={PackageSearch} />
          {data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className={TH}>{t("inTransit.product")}</th>
                    <th className={cn(TH, "text-end")}>{t("inTransit.incoming")}</th>
                    <th className={cn(TH, "text-end")}>{t("inTransit.outgoing")}</th>
                    <th className={TH}>{t("inTransit.nextArrival")}</th>
                    <th className={TH}>{t("inTransit.shipments")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map(p => <Row key={p.productId ?? `${p.description}|${p.unit}`} p={p} />)}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
