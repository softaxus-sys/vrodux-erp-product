import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Loader2, Settings2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { Can, useCan } from "@/components/auth/can";
import {
  useCreateWorkCentre, useDeleteWorkCentre, useUpdateWorkCentre, useWorkCentres,
} from "@/hooks/manufacturing/use-manufacturing";
import type { WorkCentreDto } from "@/lib/manufacturing/manufacturing.api";

const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
const LABEL = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

function WorkCentreForm({ editing, onClose }: { editing: WorkCentreDto | null; onClose: () => void }) {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const create = useCreateWorkCentre();
  const update = useUpdateWorkCentre();
  const saving = create.isPending || update.isPending;

  const [name, setName] = React.useState(editing?.name ?? "");
  const [code, setCode] = React.useState(editing?.code ?? "");
  const [labour, setLabour] = React.useState(editing ? String(editing.labourRatePerHour) : "");
  const [overhead, setOverhead] = React.useState(editing ? String(editing.overheadRatePerHour) : "");
  const [active, setActive] = React.useState(editing?.isActive ?? true);
  const [capacity, setCapacity] = React.useState(editing ? String(editing.capacityHoursPerDay) : "8");

  const save = () => {
    if (!name.trim()) return;
    const body = {
      name: name.trim(), code: code.trim() || null,
      labourRatePerHour: num(labour), overheadRatePerHour: num(overhead), isActive: active,
      capacityHoursPerDay: num(capacity) > 0 ? num(capacity) : 8,
    };
    if (editing) update.mutate({ id: editing.id, body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-24 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{editing ? t("workCentres.edit") : t("workCentres.new")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground" aria-label={t("action.close")}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <label className={LABEL}>{t("workCentres.name")}</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("workCentres.namePlaceholder")} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>{t("workCentres.code")}</label>
            <Input value={code} onChange={e => setCode(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={LABEL}>{t("workCentres.labourRate", { currency })}</label>
            <Input type="number" min={0} step="any" value={labour} onChange={e => setLabour(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>{t("workCentres.overheadRate", { currency })}</label>
            <Input type="number" min={0} step="any" value={overhead} onChange={e => setOverhead(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("workCentres.rateHint")}</p>
        <div className="space-y-1.5">
          <label className={LABEL}>{t("workCentres.capacity")}</label>
          <Input type="number" min={0.25} max={24} step="any" value={capacity} onChange={e => setCapacity(e.target.value)} className="h-9 text-sm w-32" />
          <p className="text-[11px] text-muted-foreground">{t("workCentres.capacityHint")}</p>
        </div>
        {editing && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />{t("workCentres.active")}
          </label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" onClick={save} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("action.save")}
          </Button>
        </div>
      </motion.div>
    </>
  );
}

export function WorkCentresView() {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const canView = useCan("manufacturing.work-centres.view");
  const { data: centres = [], isLoading, isError, error } = useWorkCentres(false, canView);
  const del = useDeleteWorkCentre();

  const [form, setForm] = React.useState<{ editing: WorkCentreDto | null } | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<WorkCentreDto | null>(null);

  if (!canView) return <div className="p-12 text-center text-sm text-muted-foreground">{t("boms.noAccess")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("workCentres.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("workCentres.description")}</p>
        </div>
        <Can permission="manufacturing.work-centres.create">
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setForm({ editing: null })}>
            <Plus className="h-4 w-4" />{t("workCentres.new")}
          </Button>
        </Can>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">{t("loading")}</div>
          ) : isError ? (
            <div className="p-12 text-center text-sm text-destructive">{(error as Error)?.message}</div>
          ) : centres.length === 0 ? (
            <div className="p-12 text-center">
              <Settings2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mt-3">{t("workCentres.empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-start font-semibold px-4 py-3">{t("workCentres.name")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("workCentres.col.labour")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("workCentres.col.overhead")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("planning.load.capacity")}</th>
                    <th className="text-start font-semibold px-4 py-3">{t("boms.col.status")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {centres.map(c => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.name}</p>
                        {c.code && <p className="text-[11px] text-muted-foreground">{c.code}</p>}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(c.labourRatePerHour, currency)}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(c.overheadRatePerHour, currency)}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{t("planning.load.hoursPerDay", { hours: c.capacityHoursPerDay })}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold",
                          c.isActive ? "text-success bg-success/10" : "text-muted-foreground bg-muted")}>
                          {c.isActive ? t("workCentres.statusActive") : t("workCentres.statusInactive")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Can permission="manufacturing.work-centres.edit">
                            <button onClick={() => setForm({ editing: c })} title={t("action.edit")} aria-label={t("action.edit")}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          </Can>
                          <Can permission="manufacturing.work-centres.delete">
                            <button onClick={() => setPendingDelete(c)} title={t("action.delete")} aria-label={t("action.delete")}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </Can>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AnimatePresence>
        {form && <WorkCentreForm key={form.editing?.id ?? "new"} editing={form.editing} onClose={() => setForm(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50" onClick={() => setPendingDelete(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed left-1/2 top-1/3 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl">
              <p className="font-semibold text-sm">{t("workCentres.deleteTitle")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("workCentres.deleteBody", { name: pendingDelete.name })}</p>
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
