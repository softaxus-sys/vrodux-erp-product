import * as React from "react";
import { useTranslation } from "react-i18next";
import { Globe, Loader2, Package, Plus, Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pager } from "@/components/ui/pager";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useListings } from "@/hooks/inventory/use-listings";
import { useInventoryCategories } from "@/hooks/inventory/use-inventory-categories";
import { ListingEditor } from "./listing-editor";
import { ListingPhoto } from "./listing-photos";

const PAGE_SIZE = 20;
type Filter = "all" | "published" | "draft";

export function ListingsView() {
  const { t } = useTranslation("inventory");
  const currency = useCurrency();
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [categoryId, setCategoryId] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [editor, setEditor] = React.useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  React.useEffect(() => { const h = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(h); }, [search]);

  const { data: categories = [] } = useInventoryCategories({ isActive: true });
  const { data, isLoading, isFetching, isError, refetch } = useListings({
    page, pageSize: PAGE_SIZE, search: q || undefined, categoryId: categoryId || undefined,
    published: filter === "all" ? undefined : filter === "published",
  });
  const items = data?.items ?? [];

  // Tiles describe the whole workspace, not the filtered page: three small cheap queries.
  const all = useListings({ page: 1, pageSize: 1 });
  const pub = useListings({ page: 1, pageSize: 1, published: true });
  const total = all.data?.totalCount ?? 0;
  const published = pub.data?.totalCount ?? 0;

  const priceRange = (from: number | null, to: number | null) =>
    from == null ? "—" : from === to ? formatCurrency(from, currency) : `${formatCurrency(from, currency)} – ${formatCurrency(to ?? from, currency)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingBag className="h-6 w-6 text-primary" />{t("listings.page.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("listings.page.subtitle")}</p>
        </div>
        <Can permission="inventory.stock.create">
          <Button className="gap-1.5" onClick={() => setEditor({ open: true, id: null })}>
            <Plus className="h-4 w-4" />{t("listings.page.new")}
          </Button>
        </Can>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {([
          [t("listings.page.total"), total, "text-foreground"],
          [t("listings.page.published"), published, "text-success"],
          [t("listings.page.drafts"), Math.max(0, total - published), "text-muted-foreground"],
        ] as const).map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums mt-1", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("listings.page.search")} className="ps-9 h-9" />
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-card">
          {(["all", "published", "draft"] as Filter[]).map(f => (
            <button key={f} type="button" onClick={() => { setFilter(f); setPage(1); }}
              className={cn("px-3 h-8 rounded-md text-xs font-semibold transition-colors",
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t(`listings.page.filter.${f}`)}
            </button>
          ))}
        </div>
        <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-border bg-card text-sm">
          <option value="">{t("listings.page.allCategories")}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-destructive">{t("listings.page.loadFailed")}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>{t("listings.page.retry")}</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-semibold">{q || filter !== "all" || categoryId ? t("listings.page.noMatch") : t("listings.page.empty")}</p>
            {!q && filter === "all" && !categoryId && <p className="text-xs text-muted-foreground max-w-sm mx-auto">{t("listings.page.emptyHint")}</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-start font-semibold">{t("listings.page.cols.product")}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{t("listings.page.cols.category")}</th>
                  <th className="px-3 py-2.5 text-end font-semibold">{t("listings.page.cols.variants")}</th>
                  <th className="px-3 py-2.5 text-end font-semibold">{t("listings.page.cols.price")}</th>
                  <th className="px-3 py-2.5 text-end font-semibold">{t("listings.page.cols.stock")}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{t("listings.page.cols.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(l => (
                  <tr key={l.id} tabIndex={0} role="button"
                    onClick={() => setEditor({ open: true, id: l.id })}
                    onKeyDown={e => { if (e.key === "Enter") setEditor({ open: true, id: l.id }); }}
                    className="cursor-pointer hover:bg-muted/40 focus:bg-muted/40 focus:outline-none">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {l.coverImageId
                          ? <ListingPhoto listingId={l.id} imageId={l.coverImageId} className="h-11 w-11 rounded-lg shrink-0" />
                          : <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center shrink-0"><Package className="h-5 w-5 text-muted-foreground/40" /></div>}
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{l.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate" dir="ltr">/products/{l.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.categoryName}{l.brandName ? ` · ${l.brandName}` : ""}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{l.variantCount}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums whitespace-nowrap">{priceRange(l.priceFrom, l.priceTo)}</td>
                    <td className={cn("px-3 py-2.5 text-end tabular-nums", l.totalStock <= 0 && "text-destructive font-semibold")}>{l.totalStock}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold",
                        l.publishedOnline ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                        {l.publishedOnline && <Globe className="h-3 w-3" />}
                        {l.publishedOnline ? t("listings.status.published") : t("listings.status.draft")}
                      </span>
                    </td>
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

      <ListingEditor open={editor.open} listingId={editor.id} onClose={() => setEditor({ open: false, id: null })} />
    </div>
  );
}
