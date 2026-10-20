import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { Loader2, Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { useCreateDutyRate, useDeleteDutyRate, useDutyRates, useUpdateDutyRate } from "@/hooks/trade/use-trade";
import type { DutyRateDto } from "@/lib/trade/trade.api";
import { ConfirmDialog, Field, Modal, PageHeader, SearchBox, TableState, TH, num, useDebounced } from "../../shared/ui";

function RateForm({ rate, onClose }: { rate: DutyRateDto | null; onClose: () => void }) {
  const { t } = useTranslation("trade");
  const create = useCreateDutyRate();
  const update = useUpdateDutyRate();
  const [f, setF] = React.useState({
    hsCode: rate?.hsCode ?? "", dutyPercent: rate ? String(rate.dutyPercent) : "", description: rate?.description ?? "", notes: rate?.notes ?? "",
  });
  const pending = create.isPending || update.isPending;
  const digits = f.hsCode.replace(/\D/g, "").length;
  const valid = digits >= 2 && digits <= 12 && f.dutyPercent.trim() !== "" && num(f.dutyPercent) >= 0 && num(f.dutyPercent) <= 500;

  const submit = () => {
    const r = { hsCode: f.hsCode.trim(), dutyPercent: num(f.dutyPercent), description: f.description || null, notes: f.notes || null };
    if (rate) update.mutate({ id: rate.id, r }, { onSuccess: onClose }); else create.mutate(r, { onSuccess: onClose });
  };

  return (
    <Modal title={rate ? t("duty.edit") : t("duty.new")} onClose={onClose} size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={pending || !valid} onClick={submit}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("action.save")}
          </Button>
        </>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("duty.hsCode")} hint={t("duty.hsHint")}>
          <Input value={f.hsCode} onChange={e => setF(p => ({ ...p, hsCode: e.target.value }))} className="h-9 text-sm" autoFocus />
        </Field>
        <Field label={t("duty.rate")}>
          <Input type="number" min={0} max={500} step="any" value={f.dutyPercent} onChange={e => setF(p => ({ ...p, dutyPercent: e.target.value }))} className="h-9 text-sm" />
        </Field>
      </div>
      <Field label={t("duty.descriptionLabel")}><Input value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} className="h-9 text-sm" /></Field>
      <Field label={t("duty.notes")}><Input value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} className="h-9 text-sm" /></Field>
    </Modal>
  );
}

export function DutyRatesView() {
  const { t } = useTranslation("trade");
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search);
  const { data = [], isLoading, error } = useDutyRates(debounced);
  const del = useDeleteDutyRate();
  const [editing, setEditing] = React.useState<DutyRateDto | "new" | null>(null);
  const [removing, setRemoving] = React.useState<DutyRateDto | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader title={t("duty.title")} description={t("duty.description")}>
        <Can permission="trade.costs.create">
          <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />{t("duty.new")}</Button>
        </Can>
      </PageHeader>
      <SearchBox value={search} onChange={setSearch} placeholder={t("duty.search")} className="w-full sm:w-80" />
      <Card>
        <CardContent className="p-0">
          <TableState loading={isLoading} error={error as Error | null} empty={!isLoading && data.length === 0} emptyText={t("duty.empty")} icon={Percent} />
          {data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr><th className={TH}>{t("duty.hsCode")}</th><th className={TH}>{t("duty.descriptionLabel")}</th><th className={TH}>{t("duty.rate")}</th><th className={TH} /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map(r => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium tabular-nums">{r.hsCode}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.description ?? "—"}{r.notes && <p className="text-xs">{r.notes}</p>}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold">{r.dutyPercent}%</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Can permission="trade.costs.edit"><button className="p-1.5 rounded hover:bg-muted text-muted-foreground" onClick={() => setEditing(r)} aria-label={t("action.edit")}><Pencil className="h-4 w-4" /></button></Can>
                          <Can permission="trade.costs.delete"><button className="p-1.5 rounded hover:bg-destructive/10 text-destructive" onClick={() => setRemoving(r)} aria-label={t("action.delete")}><Trash2 className="h-4 w-4" /></button></Can>
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
      <p className="text-xs text-muted-foreground">{t("duty.matchNote")}</p>

      <AnimatePresence>
        {editing && <RateForm key={editing === "new" ? "new" : editing.id} rate={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        {removing && (
          <ConfirmDialog title={t("duty.deleteTitle")} body={t("duty.deleteBody", { code: removing.hsCode })} confirmLabel={t("action.delete")} pending={del.isPending}
            onConfirm={() => del.mutate(removing.id, { onSuccess: () => setRemoving(null) })} onClose={() => setRemoving(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
