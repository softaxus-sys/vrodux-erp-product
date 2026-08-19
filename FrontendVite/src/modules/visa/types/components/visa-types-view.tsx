import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, Clock, Landmark, ChevronDown, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useVisaTypes, useDeleteVisaType } from "@/hooks/visa/use-visa";
import { Can, useCan } from "@/components/auth/can";
import type { VisaTypeDto } from "@/lib/visa/visa.api";
import { VisaTypeForm } from "./visa-type-form";

const CATEGORY_META: Record<string, { color: string; bg: string }> = {
  employment: { color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  family:     { color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/20" },
  visit:      { color: "text-teal-600",    bg: "bg-teal-50 dark:bg-teal-900/20" },
  golden:     { color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  student:    { color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  freelance:  { color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  other:      { color: "text-muted-foreground", bg: "bg-muted" },
};

function TypeCard({ vt, index, onEdit, onDelete, deleting }: { vt: VisaTypeDto; index: number; onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  const { t } = useTranslation("visa");
  const currency = useCurrency();
  const [open, setOpen] = React.useState(false);
  const cat = CATEGORY_META[vt.category] ?? CATEGORY_META.other;
  const catLabel = t(`types.category.${vt.category}`, { defaultValue: vt.category });
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * 0.03 }}>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">{vt.name}</p>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", cat.color, cat.bg)}>{catLabel}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase">{vt.channel}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{t("types.processingDays", { count: vt.processingDays })}</span>
                <span className="inline-flex items-center gap-1"><Landmark className="h-3 w-3" />{t("types.govtFee", { amount: formatCurrency(vt.defaultGovtFee, currency) })}</span>
                <span className="inline-flex items-center gap-1">{t("types.serviceFee", { amount: formatCurrency(vt.defaultServiceFee, currency) })}</span>
                <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{t("types.documentCount", { count: vt.requiredDocuments.length })}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Can permission="visa.cases.edit">
                <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label={t("types.button.edit")}><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={onDelete} disabled={deleting} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" aria-label={t("types.button.delete")}>
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </Can>
              <button onClick={() => setOpen(o => !o)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label={t("types.toggleDocs")}>
                <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
              </button>
            </div>
          </div>
          {open && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("types.requiredDocs")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {vt.requiredDocuments.map(d => (
                  <div key={d} className="flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="truncate">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function VisaTypesView() {
  const { t } = useTranslation("visa");
  const { data: types = [], isLoading } = useVisaTypes();
  const del = useDeleteVisaType();
  const canEdit = useCan("visa.cases.edit");
  const [search, setSearch] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<VisaTypeDto | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<VisaTypeDto | null>(null);

  const categories = React.useMemo(() => ["all", ...Array.from(new Set(types.map(x => x.category)))], [types]);
  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return types.filter(x =>
      (cat === "all" || x.category === cat) &&
      (!search || x.name.toLowerCase().includes(q) || x.requiredDocuments.some(d => d.toLowerCase().includes(q))));
  }, [types, search, cat]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (vt: VisaTypeDto) => { setEditing(vt); setFormOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("types.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("types.description")}</p>
        </div>
        <Can permission="visa.cases.edit">
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={openNew}><Plus className="h-4 w-4" />{t("types.button.new")}</Button>
        </Can>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={t("types.search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
                cat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {c === "all" ? t("types.filterAll") : t(`types.category.${c}`, { defaultValue: c })}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">{t("types.loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground">{t("types.emptyState")}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((vt, i) => (
            <TypeCard key={vt.id} vt={vt} index={i} onEdit={() => openEdit(vt)}
              onDelete={() => setPendingDelete(vt)} deleting={del.isPending && pendingDelete?.id === vt.id} />
          ))}
        </div>
      )}

      {canEdit && <VisaTypeForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} editing={editing} />}

      {/* Delete confirmation */}
      <AnimatePresence>
        {pendingDelete && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50" onClick={() => setPendingDelete(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed left-1/2 top-1/3 -translate-x-1/2 z-50 w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl">
              <p className="font-semibold text-sm">{t("types.deleteTitle")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{pendingDelete.name}</span> {t("types.deleteBody")}
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)} disabled={del.isPending}>{t("types.button.cancel")}</Button>
                <Button size="sm" className="bg-destructive hover:bg-destructive/90 gap-1.5" disabled={del.isPending}
                  onClick={() => del.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })}>
                  {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}{t("types.button.remove")}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
