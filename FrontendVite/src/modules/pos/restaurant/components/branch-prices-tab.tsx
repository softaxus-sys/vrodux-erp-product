import * as React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useCan } from "@/components/auth/can";
import { useCurrentBranch } from "@/hooks/restaurant/use-current-branch";
import { useMenu, useMenuBranchSettings, useSetMenuItemBranchSetting } from "@/hooks/restaurant/use-restaurant";
import type { MenuItem, MenuItemBranchSetting } from "@/lib/restaurant/restaurant.api";

/**
 * One shared menu for the whole group, with each branch's exceptions: its own price for an item,
 * or "not sold here". A row with no change keeps following the menu, including later price changes.
 */
export function BranchPricesTab() {
  const { t } = useTranslation("restaurant");
  const { branchId: current, options } = useCurrentBranch();
  const [branchId, setBranchId] = React.useState<string | null>(current ?? options[0]?.id ?? null);
  React.useEffect(() => { if (!branchId && options[0]) setBranchId(options[0].id); }, [branchId, options]);

  const { data: categories = [], isLoading } = useMenu(false);
  const { data: settings = [], isLoading: loadingSettings } = useMenuBranchSettings(branchId);
  const [search, setSearch] = React.useState("");

  const byItem = React.useMemo(
    () => new Map(settings.map(s => [s.menuItemId, s] as const)), [settings]);

  const q = search.trim().toLowerCase();
  const groups = categories
    .map(c => ({ ...c, items: c.items.filter(i => !q || i.name.toLowerCase().includes(q)) }))
    .filter(c => c.items.length > 0);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={branchId ?? ""} onChange={e => setBranchId(e.target.value || null)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium">
          {options.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-card ps-9 pe-3 text-sm" />
        </div>
        <p className="text-sm text-muted-foreground basis-full">{t("branch.menuPricesHint")}</p>
      </div>

      {!branchId ? (
        <p className="text-sm text-muted-foreground">{t("branch.pickBranch")}</p>
      ) : isLoading || loadingSettings ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        groups.map(c => (
          <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-muted/40 text-sm font-bold">{c.name}</div>
            <div className="divide-y divide-border">
              {c.items.map(i => (
                <BranchPriceRow key={`${branchId}-${i.id}`} item={i} branchId={branchId} setting={byItem.get(i.id)} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function BranchPriceRow({ item, branchId, setting }: {
  item: MenuItem; branchId: string; setting?: MenuItemBranchSetting;
}) {
  const { t } = useTranslation("restaurant");
  const currency = useCurrency();
  const canEdit = useCan("restaurant.menu.edit");
  const save = useSetMenuItemBranchSetting();

  const sold = setting?.isAvailable ?? true;
  const [price, setPrice] = React.useState(setting?.priceOverride?.toString() ?? "");
  React.useEffect(() => { setPrice(setting?.priceOverride?.toString() ?? ""); }, [setting?.priceOverride]);

  const commit = (next: { price?: string; sold?: boolean }) => {
    const p = (next.price ?? price).trim();
    const parsed = p === "" ? null : Number(p);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) return;
    const isAvailable = next.sold ?? sold;
    if (parsed === (setting?.priceOverride ?? null) && isAvailable === sold) return;
    save.mutate({ itemId: item.id, branchId, priceOverride: parsed, isAvailable });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3 px-4 py-2.5", !sold && "opacity-60")}>
      <label className="flex items-center gap-2 flex-1 min-w-[180px]">
        <input type="checkbox" checked={sold} disabled={!canEdit || save.isPending}
          onChange={e => commit({ sold: e.target.checked })} className="h-4 w-4" />
        <span className="font-medium">{item.name}</span>
        {!sold && <span className="text-xs text-muted-foreground">· {t("branch.notSoldHere")}</span>}
      </label>
      <span className="text-sm text-muted-foreground w-32 text-end tabular-nums">
        {t("branch.menuPrice")}: {formatCurrency(item.price, currency)}
      </span>
      <input type="number" min={0} step="0.01" inputMode="decimal" value={price} disabled={!canEdit || !sold}
        placeholder={t("branch.branchPrice")}
        onChange={e => setPrice(e.target.value)} onBlur={() => commit({ price })}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="h-9 w-32 rounded-lg border border-border bg-card px-2 text-sm text-end tabular-nums" />
    </div>
  );
}
