import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Ship } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useInTransit } from "@/hooks/trade/use-trade";
import { formatDate } from "@/lib/utils";

/**
 * "On its way" for one Inventory product, shown on the product's stock drawer. Trade is optional, so
 * this renders nothing at all unless the workspace has the module and the user may see shipments —
 * and nothing while loading or when there is nothing coming, so it never adds a blank box.
 */
export function IncomingStock({ productId, unit }: { productId: string; unit: string }) {
  const { t } = useTranslation("trade");
  const hasModule = useAuthStore(s => s.hasModuleAccess)("trade");
  const allowed   = useAuthStore(s => s.hasRawPermission)("trade.shipments.view");
  const enabled   = hasModule && allowed;
  const { data } = useInTransit({ productId }, enabled);

  const row = data?.[0];
  if (!enabled || !row || (row.incoming <= 0 && row.outgoing <= 0)) return null;

  return (
    <div className="rounded-xl border border-sky-300/60 bg-sky-50 dark:bg-sky-900/10 p-3 space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300"><Ship className="h-3.5 w-3.5" />{t("inTransit.onTheWay")}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {row.incoming > 0 && <span><b className="tabular-nums">{row.incoming.toLocaleString()}</b> {unit} {t("inTransit.incomingShort")}{row.nextEta && ` · ${t("inTransit.nextArrival")} ${formatDate(row.nextEta)}`}</span>}
        {row.outgoing > 0 && <span><b className="tabular-nums">{row.outgoing.toLocaleString()}</b> {unit} {t("inTransit.outgoingShort")}</span>}
        {row.delayed && <span className="text-destructive font-semibold">{t("inTransit.delayed")}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {row.lines.slice(0, 4).map(l => (
          <Link key={`${l.shipmentId}-${l.quantity}`} to={`/trade/shipments?id=${l.shipmentId}`} className="text-xs text-primary hover:underline">{l.shipmentNumber}</Link>
        ))}
      </div>
    </div>
  );
}
