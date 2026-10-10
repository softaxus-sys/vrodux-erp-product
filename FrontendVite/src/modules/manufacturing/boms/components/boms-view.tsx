import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, Loader2, Layers, CheckCircle2, Archive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useLazyList } from "@/hooks/use-lazy-list";
import { Can, useCan } from "@/components/auth/can";
import { useBoms, useDeleteBom, useSetBomStatus } from "@/hooks/manufacturing/use-manufacturing";
import { bomStatusMeta, fmtQty, type BomStatus, type BomSummaryDto } from "@/lib/manufacturing/manufacturing.api";
import { BomForm } from "./bom-form";
import { ExportMenu } from "@/components/ui/export-menu";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";

const FILTERS: ("all" | BomStatus)[] = ["all", "active", "draft", "archived"];

export function BomsView() {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const canView = useCan("manufacturing.boms.view");
  const { data: boms = [], isLoading, isError, error } = useBoms(undefined, canView);
  const setStatus = useSetBomStatus();
  const del = useDeleteBom();

  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | BomStatus>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<BomSummaryDto | null>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return boms.filter(b =>
      (filter === "all" || b.status === filter) &&
      (!q || b.name.toLowerCase().includes(q) || b.productName.toLowerCase().includes(q) || b.bomNumber.toLowerCase().includes(q)));
  }, [boms, search, filter]);

  const { visible, hasMore, loadMore, sentinelRef, shown, total } = useLazyList(filtered, 25);

  if (!canView) {
    return <div className="p-12 text-center text-sm text-muted-foreground">{t("boms.noAccess")}</div>;
  }

  const exportColumns = [t("boms.col.bom"), t("boms.col.product"), t("boms.col.batch"), t("boms.col.components"),
    t("bomForm.materialCost"), t("bomForm.operationCost"), t("boms.col.costPerUnit"), t("boms.col.status")];
  const exportRows = filtered.map(b => [`${b.name} (${b.bomNumber})`, b.productName, `${b.outputQuantity} ${b.unit}`, b.lineCount,
    b.materialCost, b.operationCost, b.costPerUnit, t(`bomStatus.${b.status}`, { defaultValue: b.status })]);
  const exportCsv = () => downloadFile(`bills_of_materials_${new Date().toISOString().split("T")[0]}.csv`,
    toCsv(exportRows.map(r => Object.fromEntries(exportColumns.map((c, i) => [c, r[i] ?? ""]))), exportColumns));
  const exportPdfReport = () => exportPdf({
    title: t("boms.title"), subtitle: t("shownOf", { shown: filtered.length, total: boms.length }),
    columns: exportColumns, rows: exportRows, landscape: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("boms.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("boms.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={filtered.length === 0} />
          <Can permission="manufacturing.boms.create">
            <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => { setEditingId(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />{t("boms.new")}
            </Button>
          </Can>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={t("boms.search")} value={search} onChange={e => setSearch(e.target.value)} className="ps-8 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {f === "all" ? t("filterAll") : t(`bomStatus.${f}`)}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">{t("loading")}</div>
          ) : isError ? (
            <div className="p-12 text-center text-sm text-destructive">{(error as Error)?.message}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Layers className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mt-3">{boms.length === 0 ? t("boms.emptyFirst") : t("boms.emptyFiltered")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-start font-semibold px-4 py-3">{t("boms.col.bom")}</th>
                    <th className="text-start font-semibold px-4 py-3">{t("boms.col.product")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("boms.col.batch")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("boms.col.components")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("boms.col.costPerUnit")}</th>
                    <th className="text-start font-semibold px-4 py-3">{t("boms.col.status")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map(b => {
                    const meta = bomStatusMeta(b.status);
                    return (
                      <tr key={b.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-medium">{b.name}</p>
                          <p className="text-[11px] text-muted-foreground">{b.bomNumber}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p>{b.productName}</p>
                          {b.productSku && <p className="text-[11px] text-muted-foreground">{b.productSku}</p>}
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums">{fmtQty(b.outputQuantity)} {b.unit}</td>
                        <td className="px-4 py-3 text-end tabular-nums">{b.lineCount}</td>
                        <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(b.costPerUnit, currency)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", meta.color, meta.bg)}>
                            {t(`bomStatus.${b.status}`, { defaultValue: b.status })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Can permission="manufacturing.boms.edit">
                              {b.status !== "active" ? (
                                <button onClick={() => setStatus.mutate({ id: b.id, status: "active" })} disabled={setStatus.isPending}
                                  title={t("boms.activate")} aria-label={t("boms.activate")}
                                  className="p-1.5 rounded-lg hover:bg-success/10 text-muted-foreground hover:text-success">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <button onClick={() => setStatus.mutate({ id: b.id, status: "archived" })} disabled={setStatus.isPending}
                                  title={t("boms.archive")} aria-label={t("boms.archive")}
                                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                                  <Archive className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button onClick={() => { setEditingId(b.id); setFormOpen(true); }}
                                title={t("action.edit")} aria-label={t("action.edit")}
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </Can>
                            <Can permission="manufacturing.boms.delete">
                              <button onClick={() => setPendingDelete(b)} title={t("action.delete")} aria-label={t("action.delete")}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </Can>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div ref={sentinelRef} />
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
                <span>{t("shownOf", { shown, total })}</span>
                {hasMore && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadMore}>{t("loadMore")}</Button>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <BomForm open={formOpen} editingId={editingId} onClose={() => { setFormOpen(false); setEditingId(null); }} />

      <AnimatePresence>
        {pendingDelete && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50" onClick={() => setPendingDelete(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed left-1/2 top-1/3 -translate-x-1/2 z-50 w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl">
              <p className="font-semibold text-sm">{t("boms.deleteTitle")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("boms.deleteBody", { name: pendingDelete.name })}</p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)} disabled={del.isPending}>{t("action.cancel")}</Button>
                <Button size="sm" className="bg-destructive hover:bg-destructive/90 gap-1.5" disabled={del.isPending}
                  onClick={() => del.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) })}>
                  {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}{t("action.delete")}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
