import * as React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Pager } from "@/components/ui/pager";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useUnlistedProducts } from "@/hooks/inventory/use-listings";
import { ListOnlineButton } from "./list-online-button";

const PAGE_SIZE = 20;

/**
 * The worklist: active stock items that are not in any online listing. Tick what should be sold online
 * and press List online. Stock stays in one place; this only decides what is offered.
 */
export function UnlistedPanel() {
  const { t } = useTranslation("inventory");
  const currency = useCurrency();
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());

  React.useEffect(() => { const h = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(h); }, [search]);

  const { data, isLoading, isFetching } = useUnlistedProducts({ page, pageSize: PAGE_SIZE, search: q || undefined });
  const items = data?.items ?? [];
  const allOnPage = items.length > 0 && items.every(i => picked.has(i.id));

  const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePage = () => setPicked(prev => {
    const n = new Set(prev);
    if (allOnPage) items.forEach(i => n.delete(i.id)); else items.forEach(i => n.add(i.id));
    return n;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("listings.listOnline.unlisted.hint")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("listings.page.search")} className="ps-9 h-9" />
        </div>
        {picked.size > 0 && (
          <>
            <span className="text-xs text-muted-foreground">{t("listings.listOnline.selected", { count: picked.size })}</span>
            <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>{t("listings.listOnline.clear")}</Button>
            <ListOnlineButton productIds={[...picked]} onDone={() => setPicked(new Set())} />
          </>
        )}
        {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-semibold">{q ? t("listings.page.noMatch") : t("listings.listOnline.unlisted.empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 w-10">
                    <input type="checkbox" checked={allOnPage} onChange={togglePage}
                      aria-label={t("listings.listOnline.unlisted.selectAll")} className="h-4 w-4 rounded border-border" />
                  </th>
                  <th className="px-3 py-2.5 text-start font-semibold">{t("listings.listOnline.unlisted.name")}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{t("listings.listOnline.unlisted.category")}</th>
                  <th className="px-3 py-2.5 text-end font-semibold">{t("listings.listOnline.unlisted.price")}</th>
                  <th className="px-3 py-2.5 text-end font-semibold">{t("listings.listOnline.unlisted.stock")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(p => (
                  <tr key={p.id} onClick={() => toggle(p.id)} className={cn("cursor-pointer hover:bg-muted/40", picked.has(p.id) && "bg-primary/5")}>
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)}
                        aria-label={t("listings.listOnline.unlisted.selectRow", { name: p.name })} className="h-4 w-4 rounded border-border" />
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold truncate">{p.name}</p>
                      {p.sku && <p className="text-[11px] text-muted-foreground font-mono">{p.sku}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.categoryName}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums whitespace-nowrap">{formatCurrency(p.salePrice, currency)}</td>
                    <td className={cn("px-3 py-2.5 text-end tabular-nums", p.stockQuantity <= 0 && "text-destructive font-semibold")}>{p.stockQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.totalCount > 0 && (
          <div className="border-t border-border">
            <Pager page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} pageSize={PAGE_SIZE} busy={isFetching} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
