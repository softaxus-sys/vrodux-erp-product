import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";
import { usePurchaseOrder, usePurchaseOrders } from "@/hooks/purchase/use-purchase-orders";
import { useSalesOrder, useSalesOrders } from "@/hooks/sales/use-sales-orders";
import type { Direction, ItemRequest } from "@/lib/trade/trade.api";
import { Field, SearchBox, useDebounced } from "../../shared/ui";

export interface OrderLink { type: "purchase" | "sales"; id: string; number: string; }

interface Props {
  direction: Direction;
  link: OrderLink | null;
  onLink: (link: OrderLink | null) => void;
  /** Hands the order's goods lines to the form. */
  onUseLines: (items: ItemRequest[]) => void;
}

/**
 * Optional link from a shipment to the Purchase order (import) or Sales order (export) it fulfils.
 * Trade never needs it — the order reference is free text — so this renders nothing at all for a
 * workspace without that module, or for a user who may not see its orders.
 */
export function OrderLinkPicker(props: Props) {
  const module = props.direction === "import" ? "purchase" : "sales";
  const hasModule = useAuthStore(s => s.hasModuleAccess)(module);
  const allowed = useAuthStore(s => s.hasRawPermission)(`${module}.orders.view`);
  if (!hasModule || !allowed) return null;
  return props.direction === "import" ? <PurchaseLink {...props} /> : <SalesLink {...props} />;
}

function Shell({ label, link, onLink, search, setSearch, results, loading, canUse, onUse }: {
  label: string; link: OrderLink | null; onLink: (l: OrderLink | null) => void;
  search: string; setSearch: (s: string) => void; results: { id: string; number: string; who: string | null }[];
  loading: boolean; canUse: boolean; onUse: () => void;
}) {
  const { t } = useTranslation("trade");
  const type = label === "purchase" ? "purchase" : "sales";

  return (
    <Field label={t(`orderLink.${type}`)} hint={t("orderLink.hint")}>
      {link ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
          <span className="text-sm inline-flex items-center gap-1.5 min-w-0"><Link2 className="h-3.5 w-3.5 shrink-0" /><b className="truncate">{link.number}</b></span>
          <span className="flex items-center gap-1 shrink-0">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={!canUse} onClick={onUse}>{t("orderLink.useLines")}</Button>
            <button type="button" onClick={() => onLink(null)} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label={t("action.delete")}><X className="h-3.5 w-3.5" /></button>
          </span>
        </div>
      ) : (
        <div className="space-y-1.5">
          <SearchBox value={search} onChange={setSearch} placeholder={t("orderLink.search")} />
          {search.trim().length >= 2 && (
            <div className="rounded-lg border border-border max-h-44 overflow-y-auto divide-y divide-border">
              {loading ? <p className="px-3 py-2 text-xs text-muted-foreground">{t("loading")}</p>
                : results.length === 0 ? <p className="px-3 py-2 text-xs text-muted-foreground">{t("orderLink.none")}</p>
                : results.map(o => (
                  <button key={o.id} type="button" onClick={() => { onLink({ type, id: o.id, number: o.number }); setSearch(""); }}
                    className="w-full text-start px-3 py-2 text-sm hover:bg-muted/40">
                    <b>{o.number}</b>{o.who && <span className="text-muted-foreground"> · {o.who}</span>}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}

function PurchaseLink({ link, onLink, onUseLines }: Props) {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data, isLoading } = usePurchaseOrders({ search: q.trim().length >= 2 ? q : undefined, pageSize: 8 });
  const full = usePurchaseOrder(link?.type === "purchase" ? link.id : null);

  return (
    <Shell label="purchase" link={link} onLink={onLink} search={search} setSearch={setSearch} loading={isLoading}
      results={q.trim().length >= 2 ? (data?.items ?? []).map(o => ({ id: o.id, number: o.orderNumber, who: o.vendorName })) : []}
      canUse={!!full.data?.items?.length}
      onUse={() => onUseLines((full.data?.items ?? []).map(i => ({
        description: i.description, quantity: i.quantity, unitPrice: i.unitCost, productId: i.productId, unit: "pcs",
      })))} />
  );
}

function SalesLink({ link, onLink, onUseLines }: Props) {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data, isLoading } = useSalesOrders({ search: q.trim().length >= 2 ? q : undefined, pageSize: 8 });
  const full = useSalesOrder(link?.type === "sales" ? link.id : null);

  return (
    <Shell label="sales" link={link} onLink={onLink} search={search} setSearch={setSearch} loading={isLoading}
      results={q.trim().length >= 2 ? (data?.items ?? []).map(o => ({ id: o.id, number: o.orderNumber, who: o.customerName })) : []}
      canUse={!!full.data?.items?.length}
      onUse={() => onUseLines((full.data?.items ?? []).map(i => ({
        description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, productId: i.productId, unit: "pcs",
      })))} />
  );
}
