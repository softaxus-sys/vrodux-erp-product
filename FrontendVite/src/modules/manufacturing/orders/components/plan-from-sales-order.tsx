import * as React from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Factory, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBoms } from "@/hooks/manufacturing/use-manufacturing";
import { manufacturingApi } from "@/lib/manufacturing/manufacturing.api";
import type { SalesOrderDto } from "@/lib/pos/types";

const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };

/**
 * Plans production for the lines of a sales order that have an active bill of materials.
 * Rendered by the Sales order drawer only when the tenant also has Manufacturing — Sales itself
 * knows nothing about production; the link is the sales order number kept as the order's reference.
 */
export function PlanFromSalesOrderModal({ order, onClose }: { order: SalesOrderDto; onClose: () => void }) {
  const { t } = useTranslation("manufacturing");
  const qc = useQueryClient();
  const { data: boms = [], isLoading } = useBoms("active");
  const [saving, setSaving] = React.useState(false);

  // One row per order line that can be made: matched to an active BOM by product.
  const rows = React.useMemo(() => order.items
    .map(item => ({ item, bom: item.productId ? boms.find(b => b.productId === item.productId) : undefined }))
    .filter((r): r is { item: SalesOrderDto["items"][number]; bom: NonNullable<typeof r.bom> } => !!r.bom),
  [order.items, boms]);
  const unmatched = order.items.length - rows.length;

  const [picked, setPicked] = React.useState<Record<string, boolean>>({});
  const [qty, setQty] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    setPicked(Object.fromEntries(rows.map(r => [r.item.id, true])));
    setQty(Object.fromEntries(rows.map(r => [r.item.id, String(r.item.quantity)])));
  }, [rows]);

  const chosen = rows.filter(r => picked[r.item.id] && num(qty[r.item.id] ?? "") > 0);

  const plan = async () => {
    setSaving(true);
    let created = 0;
    try {
      // One at a time: each is its own order, and a failure should say which line it was.
      for (const r of chosen) {
        await manufacturingApi.createOrder({
          bomId: r.bom.id, plannedQuantity: num(qty[r.item.id]),
          dueDate: order.expectedDate ? order.expectedDate.slice(0, 10) : null,
          reference: order.orderNumber,
        });
        created++;
      }
      toast.success(t("salesLink.created", { n: created, number: order.orderNumber }));
      onClose();
    } catch (e) {
      toast.error(created > 0
        ? t("salesLink.partial", { n: created, error: (e as Error).message })
        : (e as Error).message);
    } finally {
      qc.invalidateQueries({ queryKey: ["manufacturing"] });
      setSaving(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-20 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{t("salesLink.title")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("salesLink.subtitle", { number: order.orderNumber })}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground" aria-label={t("action.close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline me-2" />{t("loading")}</div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("salesLink.noneMatch")}</p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {rows.map(r => (
              <label key={r.item.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={!!picked[r.item.id]}
                  onChange={e => setPicked(p => ({ ...p, [r.item.id]: e.target.checked }))} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm truncate">{r.item.description}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">{r.bom.name} · {r.bom.bomNumber}</span>
                </span>
                <Input type="number" min={0} step="any" value={qty[r.item.id] ?? ""} onClick={e => e.preventDefault()}
                  onChange={e => setQty(q => ({ ...q, [r.item.id]: e.target.value }))} className="h-8 text-sm w-24" />
                <span className="text-[11px] text-muted-foreground w-8">{r.bom.unit}</span>
              </label>
            ))}
          </div>
        )}
        {!isLoading && unmatched > 0 && rows.length > 0 && (
          <p className="text-[11px] text-muted-foreground">{t("salesLink.unmatched", { n: unmatched })}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={chosen.length === 0 || saving} onClick={plan}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Factory className="h-3.5 w-3.5" />}
            {t("salesLink.plan")}
          </Button>
        </div>
      </motion.div>
    </>
  );
}
