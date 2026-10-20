import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { useCreateParty, useDeleteParty, useParties, useUpdateParty } from "@/hooks/trade/use-trade";
import { PARTY_KINDS, type PartyDto, type PartyRequest } from "@/lib/trade/trade.api";
import { useFieldErrors } from "@/hooks/use-field-errors";
import { FieldError } from "@/components/ui/field-error";
import {
  ConfirmDialog, Field, Modal, PageHeader, Pill, SearchBox, SELECT, TableState, TH, useDebounced,
} from "../../shared/ui";

const EMPTY: PartyRequest = { kind: "supplier", name: "", country: "", contactName: "", email: "", phone: "", address: "", taxNumber: "", notes: "", isActive: true };

function PartyForm({ party, defaultKind, onClose }: { party: PartyDto | null; defaultKind?: string; onClose: () => void }) {
  const { t } = useTranslation("trade");
  const create = useCreateParty();
  const update = useUpdateParty();
  const fe = useFieldErrors();
  const [f, setF] = React.useState<PartyRequest>(party
    ? { kind: party.kind, name: party.name, country: party.country ?? "", contactName: party.contactName ?? "", email: party.email ?? "",
        phone: party.phone ?? "", address: party.address ?? "", taxNumber: party.taxNumber ?? "", notes: party.notes ?? "", isActive: party.isActive }
    : { ...EMPTY, kind: defaultKind ?? "supplier" });
  const set = <K extends keyof PartyRequest>(k: K, v: PartyRequest[K]) => { setF(p => ({ ...p, [k]: v })); fe.clearField(String(k)); };
  const pending = create.isPending || update.isPending;

  const submit = () => {
    const opts = { onSuccess: onClose, onError: (e: unknown) => fe.capture(e) };
    if (party) update.mutate({ id: party.id, r: f }, opts); else create.mutate(f, opts);
  };

  return (
    <Modal title={party ? t("parties.edit") : t("parties.new")} onClose={onClose} size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={pending || !f.name.trim()} onClick={submit}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("action.save")}
          </Button>
        </>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("parties.kind")}>
          <select value={f.kind} onChange={e => set("kind", e.target.value)} className={SELECT}>
            {PARTY_KINDS.map(k => <option key={k} value={k}>{t(`partyKind.${k}`)}</option>)}
          </select>
        </Field>
        <Field label={t("parties.country")}>
          <Input value={f.country ?? ""} onChange={e => set("country", e.target.value)} className="h-9 text-sm" />
        </Field>
      </div>
      <Field label={t("parties.name")}>
        <Input value={f.name} onChange={e => set("name", e.target.value)} className="h-9 text-sm" autoFocus />
        <FieldError message={fe.get("name")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("parties.contact")}><Input value={f.contactName ?? ""} onChange={e => set("contactName", e.target.value)} className="h-9 text-sm" /></Field>
        <Field label={t("parties.phone")}><Input value={f.phone ?? ""} onChange={e => set("phone", e.target.value)} className="h-9 text-sm" /></Field>
      </div>
      <Field label={t("parties.email")}>
        <Input type="email" value={f.email ?? ""} onChange={e => set("email", e.target.value)} className="h-9 text-sm" />
        <FieldError message={fe.get("email")} />
      </Field>
      <Field label={t("parties.address")}><Input value={f.address ?? ""} onChange={e => set("address", e.target.value)} className="h-9 text-sm" /></Field>
      <Field label={t("parties.taxNumber")}><Input value={f.taxNumber ?? ""} onChange={e => set("taxNumber", e.target.value)} className="h-9 text-sm" /></Field>
      <Field label={t("parties.notes")}><Input value={f.notes ?? ""} onChange={e => set("notes", e.target.value)} className="h-9 text-sm" /></Field>
      {party && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.isActive ?? true} onChange={e => set("isActive", e.target.checked)} />
          {t("parties.active")}
        </label>
      )}
    </Modal>
  );
}

export function PartiesView() {
  const { t } = useTranslation("trade");
  const [search, setSearch] = React.useState("");
  const [kind, setKind] = React.useState("");
  const debounced = useDebounced(search);
  const { data = [], isLoading, error } = useParties({ search: debounced, kind });
  const del = useDeleteParty();
  const [editing, setEditing] = React.useState<PartyDto | "new" | null>(null);
  const [removing, setRemoving] = React.useState<PartyDto | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader title={t("parties.title")} description={t("parties.description")}>
        <Can permission="trade.parties.create">
          <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />{t("parties.new")}</Button>
        </Can>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder={t("parties.search")} className="w-full sm:w-72" />
        <select value={kind} onChange={e => setKind(e.target.value)} className={`${SELECT} sm:w-48`}>
          <option value="">{t("parties.allKinds")}</option>
          {PARTY_KINDS.map(k => <option key={k} value={k}>{t(`partyKind.${k}`)}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableState loading={isLoading} error={error as Error | null} empty={!isLoading && data.length === 0}
            emptyText={t("parties.empty")} icon={Users} />
          {data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className={TH}>{t("parties.name")}</th><th className={TH}>{t("parties.kind")}</th>
                    <th className={TH}>{t("parties.country")}</th><th className={TH}>{t("parties.contact")}</th>
                    <th className={TH}>{t("parties.shipments")}</th><th className={TH} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map(p => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.name}</p>
                        {!p.isActive && <span className="text-[11px] text-muted-foreground">{t("parties.inactive")}</span>}
                      </td>
                      <td className="px-4 py-3"><Pill meta={{ color: "text-primary", bg: "bg-primary/10" }}>{t(`partyKind.${p.kind}`)}</Pill></td>
                      <td className="px-4 py-3 text-muted-foreground">{p.country ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.contactName ?? "—"}
                        {(p.email || p.phone) && <p className="text-xs">{[p.email, p.phone].filter(Boolean).join(" · ")}</p>}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{p.shipments}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Can permission="trade.parties.edit">
                            <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" onClick={() => setEditing(p)} aria-label={t("action.edit")}><Pencil className="h-4 w-4" /></button>
                          </Can>
                          <Can permission="trade.parties.delete">
                            <button className="p-1.5 rounded hover:bg-destructive/10 text-destructive" onClick={() => setRemoving(p)} aria-label={t("action.delete")}><Trash2 className="h-4 w-4" /></button>
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
        {editing && <PartyForm key={editing === "new" ? "new" : editing.id} party={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        {removing && (
          <ConfirmDialog title={t("parties.deleteTitle")} body={t("parties.deleteBody", { name: removing.name })}
            confirmLabel={t("action.delete")} pending={del.isPending}
            onConfirm={() => del.mutate(removing.id, { onSuccess: () => setRemoving(null) })} onClose={() => setRemoving(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export { PartyForm };
