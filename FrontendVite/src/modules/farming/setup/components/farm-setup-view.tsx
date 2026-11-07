import * as React from "react";
import { ft, useFt } from "@/lib/farming/ft";
import { AnimatePresence } from "framer-motion";
import { Pencil, Plus, Tractor, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { useAct, useFarmSettings, useFarms, useUnits } from "@/hooks/farming/use-farming";
import { FARM_TYPES, farmingApi, farmTypeLabel, UNIT_KINDS, type FarmDto, type FarmUnitDto } from "@/lib/farming/farming.api";
import { ConfirmDialog, FormModal, PageHeader, TableState, TH, num, orUndef, useCanAny } from "../../shared/ui";
import { useFarmOptions } from "../../shared/options";

function TypesCard() {
  const { data } = useFarmSettings();
  const canEdit = useCanAny(["farming.setup.edit"]);
  const save = useAct((t: string[]) => farmingApi.updateSettings({ enabledTypes: t, milkUnit: data?.milkUnit }), "Farm types saved.");
  const on = data?.enabledTypes ?? [];
  const toggle = (t: string) => save.mutate(on.includes(t) ? on.filter(x => x !== t) : [...on, t]);
  return (
    <Card className="p-4 space-y-3">
      <div><p className="font-semibold text-sm">{ft("Types of farming")}</p>
        <p className="text-xs text-muted-foreground">{ft("Every type is on for a new workspace. Switch off what you don't run to keep the forms short.")}</p></div>
      <div className="flex flex-wrap gap-2">{FARM_TYPES.map(t => (
        <label key={t.value} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={on.includes(t.value)} disabled={!canEdit || save.isPending}
            onChange={() => toggle(t.value)} />{t.label}
        </label>))}</div>
    </Card>
  );
}

export function FarmSetupView() {
  useFt();
  const { data: farms = [], isLoading, error } = useFarms();
  const { data: units = [] } = useUnits();
  const opts = useFarmOptions();
  const [farm, setFarm] = React.useState<FarmDto | "new" | null>(null);
  const [unit, setUnit] = React.useState<FarmUnitDto | "new" | null>(null);
  const [del, setDel] = React.useState<{ kind: "farm" | "unit"; id: string; name: string } | null>(null);

  const saveFarm = useAct((v: { id?: string; b: Record<string, unknown> }) => farmingApi.saveFarm(v.id, v.b), "Farm saved.");
  const saveUnit = useAct((v: { id?: string; b: Record<string, unknown> }) => farmingApi.saveUnit(v.id, v.b), "Saved.");
  const remove = useAct((d: { kind: string; id: string }) => d.kind === "farm" ? farmingApi.deleteFarm(d.id) : farmingApi.deleteUnit(d.id), "Removed.");
  const f = farm === "new" ? undefined : farm ?? undefined;
  const u = unit === "new" ? undefined : unit ?? undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Farms & setup" description="Your farm sites, and the sheds, barns, ponds, fields and apiaries on them." >
        <Can permission="farming.setup.edit"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setFarm("new")}><Plus className="h-4 w-4" />{ft("Add farm")}</Button></Can>
        <Can permission="farming.setup.edit"><Button size="sm" className="gap-1.5" onClick={() => setUnit("new")}><Plus className="h-4 w-4" />{ft("Add shed / pond / field")}</Button></Can>
      </PageHeader>
      <TypesCard />

      <Card className="overflow-hidden">
        <p className="font-semibold text-sm px-4 pt-4">{ft("Farms")}</p>
        <TableState loading={isLoading} error={error as Error | null} empty={farms.length === 0} emptyText="No farms yet." icon={Tractor} />
        {farms.length > 0 && (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs"><tr><th className={TH}>{ft("Name")}</th><th className={TH}>{ft("Location")}</th><th className={TH}>{ft("Area (acres)")}</th><th className={TH}>{ft("Manager")}</th><th className={TH}>{ft("Units")}</th><th /></tr></thead>
            <tbody>{farms.map(x => (
              <tr key={x.id} className="border-t border-border"><td className="px-4 py-2 font-medium">{x.name}</td><td className="px-4">{x.location ?? "—"}</td><td className="px-4 tabular-nums">{x.areaAcres || "—"}</td>
                <td className="px-4">{x.manager ?? "—"}</td><td className="px-4">{x.unitCount}</td>
                <td className="px-4 text-end whitespace-nowrap"><Can permission="farming.setup.edit">
                  <Button size="icon" variant="ghost" aria-label={ft("Edit")} onClick={() => setFarm(x)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={ft("Remove")} onClick={() => setDel({ kind: "farm", id: x.id, name: x.name })}><Trash2 className="h-4 w-4" /></Button></Can></td></tr>))}</tbody></table></div>)}
      </Card>

      <Card className="overflow-hidden">
        <p className="font-semibold text-sm px-4 pt-4">{ft("Sheds, ponds and fields")}</p>
        <TableState loading={false} empty={units.length === 0} emptyText="Nothing added yet. Add a shed, barn, pond or field to start." icon={Tractor} />
        {units.length > 0 && (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs"><tr><th className={TH}>{ft("Name")}</th><th className={TH}>{ft("Type")}</th><th className={TH}>{ft("Kind")}</th><th className={TH}>{ft("Farm")}</th><th className={TH}>{ft("Head now / capacity")}</th><th /></tr></thead>
            <tbody>{units.map(x => (
              <tr key={x.id} className="border-t border-border"><td className="px-4 py-2 font-medium">{x.name}{!x.isActive && <span className="text-xs text-muted-foreground"> (not in use)</span>}</td>
                <td className="px-4">{farmTypeLabel(x.type)}</td><td className="px-4 capitalize">{ft(x.kind)}</td><td className="px-4">{x.farmName}</td>
                <td className="px-4 tabular-nums">{x.headCount.toLocaleString()}{x.capacity ? ` / ${x.capacity.toLocaleString()}` : ""}</td>
                <td className="px-4 text-end whitespace-nowrap"><Can permission="farming.setup.edit">
                  <Button size="icon" variant="ghost" aria-label={ft("Edit")} onClick={() => setUnit(x)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={ft("Remove")} onClick={() => setDel({ kind: "unit", id: x.id, name: x.name })}><Trash2 className="h-4 w-4" /></Button></Can></td></tr>))}</tbody></table></div>)}
      </Card>

      <AnimatePresence>
        {farm && (
          <FormModal title={f ? ft("Edit {{name}}", { name: f.name }) : "Add farm"} pending={saveFarm.isPending} onClose={() => setFarm(null)}
            initial={{ name: f?.name ?? "", location: f?.location ?? "", areaAcres: String(f?.areaAcres ?? ""), manager: f?.manager ?? "", phone: f?.phone ?? "", notes: f?.notes ?? "" }}
            fields={[{ key: "name", label: "Name", required: true }, { key: "location", label: "Location" }, { key: "areaAcres", label: "Area (acres)", type: "number" },
              { key: "manager", label: "Manager" }, { key: "phone", label: "Phone" }, { key: "notes", label: "Notes", type: "textarea" }]}
            onSubmit={v => saveFarm.mutate({ id: f?.id, b: { name: String(v.name).trim(), location: orUndef(v.location), areaAcres: num(v.areaAcres), manager: orUndef(v.manager), phone: orUndef(v.phone), notes: orUndef(v.notes) } }, { onSuccess: () => setFarm(null) })} />
        )}
        {unit && (
          <FormModal title={u ? ft("Edit {{name}}", { name: u.name }) : "Add shed / pond / field"} pending={saveUnit.isPending} onClose={() => setUnit(null)}
            initial={{ name: u?.name ?? "", farmId: u?.farmId ?? farms[0]?.id ?? "", type: u?.type ?? opts.types[0]?.value ?? "dairy", kind: u?.kind ?? "shed", capacity: String(u?.capacity ?? ""), notes: u?.notes ?? "", isActive: u?.isActive ?? true }}
            fields={[{ key: "name", label: "Name", required: true, placeholder: "Shed A, Pond 2, North field…" },
              { key: "farmId", label: "Farm", type: "select", required: true, options: opts.farms },
              { key: "type", label: "Type of farming", type: "select", required: true, options: opts.types },
              { key: "kind", label: "Kind", type: "select", required: true, options: UNIT_KINDS.map(k => ({ value: k, label: k })) },
              { key: "capacity", label: "Capacity", type: "number", hint: "Head (animals, birds, fish) or acres for a field." },
              { key: "isActive", label: "In use", type: "checkbox" }, { key: "notes", label: "Notes", type: "textarea" }]}
            onSubmit={v => saveUnit.mutate({ id: u?.id, b: { name: String(v.name).trim(), farmId: v.farmId, type: v.type, kind: v.kind, capacity: num(v.capacity), notes: orUndef(v.notes), isActive: !!v.isActive } }, { onSuccess: () => setUnit(null) })} />
        )}
        {del && <ConfirmDialog title={ft("Remove {{name}}?", { name: del.name })} body="It stays in past records but can no longer be chosen." confirmLabel="Remove" pending={remove.isPending}
          onClose={() => setDel(null)} onConfirm={() => remove.mutate(del, { onSuccess: () => setDel(null) })} />}
      </AnimatePresence>
    </div>
  );
}
