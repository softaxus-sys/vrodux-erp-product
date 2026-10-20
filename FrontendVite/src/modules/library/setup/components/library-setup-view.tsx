import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useCan } from "@/components/auth/can";
import {
  useBranches, useCreateBranch, useCreateMembershipType, useDeleteBranch, useDeleteMembershipType,
  useMembershipTypes, useUpdateBranch, useUpdateMembershipType,
} from "@/hooks/library/use-library";
import type { BranchDto, MembershipTypeDto } from "@/lib/library/library.api";
import { ConfirmDialog, Field, Modal, PageHeader, Pill, TH, num, useCanAny } from "../../shared/ui";
import { BranchStaffModal } from "./branch-staff-modal";
import { RemindersCard } from "./reminders-card";
import { PortalCard } from "./portal-card";

const ACTIVE = { color: "text-success", bg: "bg-success/10" };
const INACTIVE = { color: "text-muted-foreground", bg: "bg-muted" };

function Footer({ saving, disabled, onClose, onSave }: { saving: boolean; disabled: boolean; onClose: () => void; onSave: () => void }) {
  const { t } = useTranslation("library");
  return (
    <>
      <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{t("action.cancel")}</Button>
      <Button size="sm" className="gap-1.5" onClick={onSave} disabled={disabled || saving}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("action.save")}
      </Button>
    </>
  );
}

function ActiveToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation("library");
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{t("setup.active")}
    </label>
  );
}

function BranchForm({ editing, onClose }: { editing: BranchDto | null; onClose: () => void }) {
  const { t } = useTranslation("library");
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const [f, setF] = React.useState({
    name: editing?.name ?? "", code: editing?.code ?? "", address: editing?.address ?? "",
    phone: editing?.phone ?? "", email: editing?.email ?? "",
  });
  const [active, setActive] = React.useState(editing?.isActive ?? true);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(prev => ({ ...prev, [k]: e.target.value }));

  const save = () => {
    if (!f.name.trim()) return;
    const body = { name: f.name.trim(), code: f.code || null, address: f.address || null, phone: f.phone || null, email: f.email || null, isActive: active };
    if (editing) update.mutate({ id: editing.id, body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };

  return (
    <Modal title={editing ? t("setup.branch.edit") : t("setup.branch.new")} onClose={onClose}
      footer={<Footer saving={create.isPending || update.isPending} disabled={!f.name.trim()} onClose={onClose} onSave={save} />}>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label={t("setup.name")} className="sm:col-span-2"><Input value={f.name} onChange={set("name")} className="h-9 text-sm" autoFocus /></Field>
        <Field label={t("setup.branch.code")}><Input value={f.code} onChange={set("code")} className="h-9 text-sm" /></Field>
        <Field label={t("members.field.address")} className="sm:col-span-3"><Input value={f.address} onChange={set("address")} className="h-9 text-sm" /></Field>
        <Field label={t("members.field.phone")}><Input value={f.phone} onChange={set("phone")} className="h-9 text-sm" /></Field>
        <Field label={t("members.field.email")} className="sm:col-span-2"><Input type="email" value={f.email} onChange={set("email")} className="h-9 text-sm" /></Field>
      </div>
      {editing && <ActiveToggle checked={active} onChange={setActive} />}
    </Modal>
  );
}

function TypeForm({ editing, onClose }: { editing: MembershipTypeDto | null; onClose: () => void }) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const create = useCreateMembershipType();
  const update = useUpdateMembershipType();
  const [f, setF] = React.useState({
    name: editing?.name ?? "", maxLoans: String(editing?.maxLoans ?? 5), loanDays: String(editing?.loanDays ?? 14),
    maxRenewals: String(editing?.maxRenewals ?? 2), finePerDay: String(editing?.finePerDay ?? 0),
    maxReservations: String(editing?.maxReservations ?? 3), annualFee: String(editing?.annualFee ?? 0),
    sameTitleReserveAfterDays: String(editing?.sameTitleReserveAfterDays ?? 1),
  });
  const [active, setActive] = React.useState(editing?.isActive ?? true);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(prev => ({ ...prev, [k]: e.target.value }));
  const valid = f.name.trim().length > 0 && num(f.maxLoans) >= 1 && num(f.loanDays) >= 1;

  const save = () => {
    if (!valid) return;
    const body = {
      name: f.name.trim(), maxLoans: Math.floor(num(f.maxLoans)), loanDays: Math.floor(num(f.loanDays)),
      maxRenewals: Math.floor(num(f.maxRenewals)), finePerDay: num(f.finePerDay),
      maxReservations: Math.floor(num(f.maxReservations)), annualFee: num(f.annualFee), isActive: active,
      sameTitleReserveAfterDays: Math.max(0, Math.floor(num(f.sameTitleReserveAfterDays))),
    };
    if (editing) update.mutate({ id: editing.id, body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };

  const number = (k: keyof typeof f, label: string, step?: string) => (
    <Field label={label}><Input type="number" min={0} step={step ?? "1"} value={f[k]} onChange={set(k)} className="h-9 text-sm" /></Field>
  );

  return (
    <Modal title={editing ? t("setup.type.edit") : t("setup.type.new")} onClose={onClose}
      footer={<Footer saving={create.isPending || update.isPending} disabled={!valid} onClose={onClose} onSave={save} />}>
      <Field label={t("setup.name")}><Input value={f.name} onChange={set("name")} className="h-9 text-sm" autoFocus /></Field>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {number("maxLoans", t("setup.type.maxLoans"))}
        {number("loanDays", t("setup.type.loanDays"))}
        {number("maxRenewals", t("setup.type.maxRenewals"))}
        {number("maxReservations", t("setup.type.maxReservations"))}
        {number("finePerDay", t("setup.type.finePerDay", { currency }), "any")}
        {number("annualFee", t("setup.type.annualFee", { currency }), "any")}
      </div>
      {number("sameTitleReserveAfterDays", t("setup.type.sameTitleWait"))}
      <p className="text-[11px] text-muted-foreground">{t("setup.type.sameTitleWaitHint")}</p>
      <p className="text-[11px] text-muted-foreground">{t("setup.type.hint")}</p>
      {editing && <ActiveToggle checked={active} onChange={setActive} />}
    </Modal>
  );
}

function Section({ title, description, addLabel, canEdit, onAdd, children }: {
  title: string; description: string; addLabel: string; canEdit: boolean; onAdd: () => void; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-bold">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          {canEdit && <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={onAdd}><Plus className="h-3.5 w-3.5" />{addLabel}</Button>}
        </div>
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

export function LibrarySetupView() {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const canView = useCanAny(["library.setup.view", "library.setup.edit"]);
  const canEdit = useCan("library.setup.edit");
  const { data: branches = [] } = useBranches(false, canView);
  const { data: types = [] } = useMembershipTypes(false, canView);
  const deleteBranch = useDeleteBranch();
  const deleteType = useDeleteMembershipType();

  const [branchForm, setBranchForm] = React.useState<{ editing: BranchDto | null } | null>(null);
  const [typeForm, setTypeForm] = React.useState<{ editing: MembershipTypeDto | null } | null>(null);
  const [pendingBranch, setPendingBranch] = React.useState<BranchDto | null>(null);
  const [staffBranch, setStaffBranch] = React.useState<BranchDto | null>(null);
  const [pendingType, setPendingType] = React.useState<MembershipTypeDto | null>(null);

  if (!canView) return <div className="p-12 text-center text-sm text-muted-foreground">{t("noAccess")}</div>;

  const iconBtn = "p-1.5 rounded-lg hover:bg-muted text-muted-foreground";
  const rowActions = (onEdit: () => void, onDelete: () => void) => canEdit && (
    <div className="flex items-center justify-end gap-1">
      <button onClick={onEdit} className={iconBtn} title={t("action.edit")} aria-label={t("action.edit")}><Pencil className="h-3.5 w-3.5" /></button>
      <button onClick={onDelete} className={`${iconBtn} hover:bg-destructive/10 hover:text-destructive`} title={t("action.delete")} aria-label={t("action.delete")}>
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
  const head = "bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground";
  const numTh = "text-end font-semibold px-4 py-3";
  const numTd = "px-4 py-3 text-end tabular-nums";

  return (
    <div className="space-y-6">
      <PageHeader title={t("setup.title")} description={t("setup.description")} />

      <Section title={t("setup.branch.heading")} description={t("setup.branch.description")} addLabel={t("setup.branch.new")}
        canEdit={canEdit} onAdd={() => setBranchForm({ editing: null })}>
        <table className="w-full text-sm">
          <thead className={head}>
            <tr>
              <th className={TH}>{t("col.branch")}</th>
              <th className={TH}>{t("members.contact")}</th>
              <th className={numTh}>{t("col.copies")}</th>
              <th className={numTh}>{t("col.onLoan")}</th>
              <th className={TH}>{t("setup.staff.column")}</th>
              <th className={TH}>{t("field.status")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {branches.map(b => (
              <tr key={b.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{b.name}</p>
                  {(b.code || b.address) && <p className="text-[11px] text-muted-foreground">{[b.code, b.address].filter(Boolean).join(" · ")}</p>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{[b.phone, b.email].filter(Boolean).join(" · ") || "—"}</td>
                <td className={numTd}>{b.copies}</td>
                <td className={numTd}>{b.onLoan}</td>
                <td className="px-4 py-3">
                  <button disabled={!canEdit} onClick={() => setStaffBranch(b)} title={t("setup.staff.title")}
                    className="inline-flex items-center gap-1.5 text-start text-sm rounded-md px-1.5 py-0.5 -mx-1.5 enabled:hover:bg-muted">
                    <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {b.staff.length === 0
                      ? <span className="text-muted-foreground">{t("setup.staff.anyone")}</span>
                      : <span className="max-w-[14rem] truncate">{b.staff.map(s => s.userName).join(", ")}</span>}
                  </button>
                </td>
                <td className="px-4 py-3"><Pill meta={b.isActive ? ACTIVE : INACTIVE}>{b.isActive ? t("setup.active") : t("setup.inactive")}</Pill></td>
                <td className="px-4 py-3">{rowActions(() => setBranchForm({ editing: b }), () => setPendingBranch(b))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t("setup.type.heading")} description={t("setup.type.description")} addLabel={t("setup.type.new")}
        canEdit={canEdit} onAdd={() => setTypeForm({ editing: null })}>
        <table className="w-full text-sm">
          <thead className={head}>
            <tr>
              <th className={TH}>{t("setup.name")}</th>
              <th className={numTh}>{t("setup.type.maxLoans")}</th>
              <th className={numTh}>{t("setup.type.loanDays")}</th>
              <th className={numTh}>{t("setup.type.maxRenewals")}</th>
              <th className={numTh}>{t("setup.type.finePerDay", { currency })}</th>
              <th className={numTh}>{t("setup.type.members")}</th>
              <th className={TH}>{t("field.status")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {types.map(x => (
              <tr key={x.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{x.name}</td>
                <td className={numTd}>{x.maxLoans}</td>
                <td className={numTd}>{x.loanDays}</td>
                <td className={numTd}>{x.maxRenewals}</td>
                <td className={numTd}>{formatCurrency(x.finePerDay, currency)}</td>
                <td className={numTd}>{x.members}</td>
                <td className="px-4 py-3"><Pill meta={x.isActive ? ACTIVE : INACTIVE}>{x.isActive ? t("setup.active") : t("setup.inactive")}</Pill></td>
                <td className="px-4 py-3">{rowActions(() => setTypeForm({ editing: x }), () => setPendingType(x))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <RemindersCard canEdit={canEdit} />
      <PortalCard canEdit={canEdit} />

      <AnimatePresence>
        {branchForm && <BranchForm key={branchForm.editing?.id ?? "new-branch"} editing={branchForm.editing} onClose={() => setBranchForm(null)} />}
        {staffBranch && <BranchStaffModal key={`staff-${staffBranch.id}`} branch={staffBranch} onClose={() => setStaffBranch(null)} />}
        {typeForm && <TypeForm key={typeForm.editing?.id ?? "new-type"} editing={typeForm.editing} onClose={() => setTypeForm(null)} />}
        {pendingBranch && (
          <ConfirmDialog key="del-branch" title={t("setup.branch.deleteTitle")} confirmLabel={t("action.delete")}
            body={t("setup.deleteBody", { name: pendingBranch.name })} pending={deleteBranch.isPending}
            onClose={() => setPendingBranch(null)}
            onConfirm={() => deleteBranch.mutate(pendingBranch.id, { onSettled: () => setPendingBranch(null) })} />
        )}
        {pendingType && (
          <ConfirmDialog key="del-type" title={t("setup.type.deleteTitle")} confirmLabel={t("action.delete")}
            body={t("setup.deleteBody", { name: pendingType.name })} pending={deleteType.isPending}
            onClose={() => setPendingType(null)}
            onConfirm={() => deleteType.mutate(pendingType.id, { onSettled: () => setPendingType(null) })} />
        )}
      </AnimatePresence>
    </div>
  );
}
