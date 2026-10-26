/**
 * Stock by branch: what each branch server last reported holding of each product. Read-only at head office;
 * a branch's figure changes only through that branch's own sales, refunds and stock adjustments.
 */
import * as React from "react";
import { AlertTriangle, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import { useLazyList } from "@/hooks/use-lazy-list";
import { useBranchStock } from "@/hooks/pos/use-branch-stock";

const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function BranchStockView() {
  return (
    <Can
      anyOf={["pos.reports.view", "pos.products.view"]}
      fallback={<div className="p-10 text-center text-sm text-muted-foreground">You need the POS products or reports permission to see stock by branch.</div>}
    >
      <Report />
    </Can>
  );
}

function Report() {
  const [search, setSearch] = React.useState("");
  const [branch, setBranch] = React.useState("all");
  const { data, isLoading, isError, error, refetch, isFetching } = useBranchStock(search, branch === "all" ? undefined : branch);

  const rows = data ?? [];
  const branches = React.useMemo(() => {
    const m = new Map<string, string>();
    (data ?? []).forEach(r => m.set(r.branchId, r.branchName));
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
  const { visible, hasMore, loadMore, sentinelRef, shown, total } = useLazyList(rows, 50);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Stock by branch</h1>
          <p className="text-sm text-muted-foreground">What each branch holds, as last reported by its branch server.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, SKU or barcode" className="pl-8 h-9 w-72" />
        </div>
        <select value={branch} onChange={e => setBranch(e.target.value)} className="h-9 px-3 rounded-lg border border-border bg-card text-sm">
          <option value="all">All branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />{(error as Error)?.message ?? "Could not load stock."}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Product</th>
              <th className="text-left px-3 py-2">Branch</th>
              <th className="text-right px-3 py-2">In stock</th>
              <th className="text-right px-3 py-2">Reorder at</th>
              <th className="text-left px-3 py-2">As of</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                Nothing reported yet. A branch appears here after its branch server has synced at least once.
              </td></tr>
            )}
            {visible.map(r => {
              const low = r.reorderLevel > 0 && r.stockQuantity <= r.reorderLevel;
              return (
                <tr key={`${r.branchId}-${r.productId}`} className="border-t border-border">
                  <td className="px-3 py-2"><div className="font-medium">{r.productName}</div>{r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}</td>
                  <td className="px-3 py-2">{r.branchName}</td>
                  <td className={cn("px-3 py-2 text-right tabular-nums font-medium", r.stockQuantity <= 0 ? "text-destructive" : low ? "text-amber-600" : "")}>{qty(r.stockQuantity)} {r.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.reorderLevel > 0 ? qty(r.reorderLevel) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(r.asOf)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div ref={sentinelRef} />
        {rows.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs text-muted-foreground">
            <span>{shown} of {total}</span>
            {hasMore && <Button size="sm" variant="ghost" onClick={loadMore}>Load more</Button>}
          </div>
        )}
      </div>
    </div>
  );
}
