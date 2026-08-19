import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Truck, Calendar, Loader2, PackageCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useDeliveryChallans } from "@/hooks/sales/use-delivery-challans";

const STATUS_STYLES: Record<string, { color: string; bg: string; dot: string }> = {
  posted:    { color: "text-success",     bg: "bg-success/10",     dot: "bg-success" },
  cancelled: { color: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive" },
};

export function DeliveryChallansView() {
  const { t } = useTranslation("sales");
  const [search, setSearch] = React.useState("");
  const { data, isLoading } = useDeliveryChallans();

  const items = (data ?? []).filter(c =>
    !search ||
    c.challanNumber.toLowerCase().includes(search.toLowerCase()) ||
    c.salesOrderNumber.toLowerCase().includes(search.toLowerCase()) ||
    c.customerName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("challans.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("challans.description")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder={t("challans.search")} value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm" />
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">{t("challans.loading")}</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("challans.table.challanNum")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("challans.table.order")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("challans.table.customer")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("challans.table.date")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t("challans.table.driver")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("challans.table.items")}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("challans.table.status")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">{t("challans.noResults")}</td></tr>
              ) : items.map((c, i) => {
                const sc = STATUS_STYLES[c.status] ?? { color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };
                return (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <PackageCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm font-semibold">{c.challanNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-sm">{c.salesOrderNumber}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium">{c.customerName}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />{formatDate(c.challanDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Truck className="h-3 w-3" />{c.driverName ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{c.itemCount}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{t(`challans.status.${c.status}`)}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
}
