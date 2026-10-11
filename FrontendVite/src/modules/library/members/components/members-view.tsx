import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { BookMarked, Coins, Globe, IdCard, Loader2, Pencil, Plus, Trash2, UploadCloud, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { Can, useCan } from "@/components/auth/can";
import {
  useBranches, useCreateMember, useDeleteMember, useMember, useMembers, useMembershipTypes, useMyBranches,
  useClearMemberPortalPin, useSetMemberPortalPin, useUpdateMember, useWorkingBranch,
} from "@/hooks/library/use-library";
import { portalUrl, type MemberPortalPinDto } from "@/lib/library/portal.api";
import { useAuthStore } from "@/store/auth.store";
import { statusMeta, type MemberDto } from "@/lib/library/library.api";
import {
  ConfirmDialog, Field, Modal, PageHeader, Pager, Pill, SearchBox, SELECT, TableState, TH, useCanAny, useDebounced,
} from "../../shared/ui";
import { ImportModal } from "../../shared/import-modal";
import { CardsModal } from "../../shared/print-modals";
import { LoansPanel } from "../../circulation/components/loans-panel";
import { ReserveForm } from "../../circulation/components/reservations-panel";
import { AddFineForm, FinesTable } from "../../fines/components/fines-view";

const PAGE_SIZE = 50;
/** What the list and the record show: an expired membership outranks its stored status. */
const shownStatus = (m: MemberDto) => (m.status === "suspended" ? "suspended" : m.isExpired ? "expired" : "active");

function MemberForm({ editing, defaultBranchId, onClose }: {
  editing: MemberDto | null; defaultBranchId: string; onClose: () => void;
}) {
  const { t } = useTranslation("library");
  const create = useCreateMember();
  const update = useUpdateMember();
  const { data: types = [] } = useMembershipTypes(true);
  const { data: branches = [] } = useBranches(true);
  const saving = create.isPending || update.isPending;

  const [f, setF] = React.useState({
    memberNumber: editing?.memberNumber ?? "", fullName: editing?.fullName ?? "", email: editing?.email ?? "",
    phone: editing?.phone ?? "", address: editing?.address ?? "", idNumber: editing?.idNumber ?? "",
    membershipTypeId: editing?.membershipTypeId ?? "", homeBranchId: editing?.homeBranchId ?? defaultBranchId,
    expiresOn: editing?.expiresOn ?? "", status: editing?.status ?? "active", notes: editing?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }));

  // The member's own type stays selectable even if it has since been made inactive.
  const typeId = f.membershipTypeId || types[0]?.id || "";
  const valid = f.fullName.trim().length > 0 && !!typeId && (!editing || f.memberNumber.trim().length > 0);

  const save = () => {
    if (!valid) return;
    const body = {
      memberNumber: f.memberNumber.trim() || null, fullName: f.fullName.trim(), email: f.email || null,
      phone: f.phone || null, address: f.address || null, idNumber: f.idNumber || null,
      membershipTypeId: typeId, homeBranchId: f.homeBranchId || null, expiresOn: f.expiresOn || null,
      status: f.status, notes: f.notes || null,
    };
    if (editing) update.mutate({ id: editing.id, body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };

  return (
    <Modal title={editing ? t("members.form.edit") : t("members.form.new")} onClose={onClose} size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" onClick={save} disabled={!valid || saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("action.save")}
          </Button>
        </>
      }>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t("members.field.fullName")}><Input value={f.fullName} onChange={set("fullName")} className="h-9 text-sm" autoFocus /></Field>
        <Field label={t("members.field.number")} hint={editing ? undefined : t("members.field.numberHint")}>
          <Input value={f.memberNumber} onChange={set("memberNumber")} className="h-9 text-sm font-mono" />
        </Field>
        <Field label={t("members.field.type")}>
          <select value={typeId} onChange={set("membershipTypeId")} className={SELECT}>
            {editing && !types.some(x => x.id === editing.membershipTypeId) && (
              <option value={editing.membershipTypeId}>{editing.membershipTypeName}</option>
            )}
            {types.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label={t("members.field.homeBranch")}>
          <select value={f.homeBranchId} onChange={set("homeBranchId")} className={SELECT}>
            <option value="">{t("members.field.noBranch")}</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label={t("members.field.phone")}><Input value={f.phone} onChange={set("phone")} className="h-9 text-sm" /></Field>
        <Field label={t("members.field.email")}><Input type="email" value={f.email} onChange={set("email")} className="h-9 text-sm" /></Field>
        <Field label={t("members.field.idNumber")} hint={t("members.field.idNumberHint")}>
          <Input value={f.idNumber} onChange={set("idNumber")} className="h-9 text-sm" />
        </Field>
        <Field label={t("members.field.expiresOn")} hint={t("members.field.expiresHint")}>
          <Input type="date" value={f.expiresOn} onChange={set("expiresOn")} className="h-9 text-sm" />
        </Field>
        <Field label={t("members.field.address")} className="sm:col-span-2">
          <Input value={f.address} onChange={set("address")} className="h-9 text-sm" />
        </Field>
        {editing && (
          <Field label={t("field.status")} hint={t("members.field.statusHint")}>
            <select value={f.status} onChange={set("status")} className={SELECT}>
              <option value="active">{t("memberStatus.active")}</option>
              <option value="suspended">{t("memberStatus.suspended")}</option>
            </select>
          </Field>
        )}
        <Field label={t("field.notes")} className={editing ? undefined : "sm:col-span-2"}>
          <Input value={f.notes} onChange={set("notes")} className="h-9 text-sm" />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Online access for one member: give a PIN, replace it, or take access away. The PIN is shown
 * once, right after it is made — only its hash is kept, so nobody can look it up later.
 */
function PortalAccess({ member }: { member: MemberDto }) {
  const { t } = useTranslation("library");
  const slug = useAuthStore(s => s.tenant?.slug);
  const canEdit = useCan("library.members.edit");
  const setPin = useSetMemberPortalPin();
  const clearPin = useClearMemberPortalPin();
  const [issued, setIssued] = React.useState<MemberPortalPinDto | null>(null);
  const [confirm, setConfirm] = React.useState<"replace" | "remove" | null>(null);

  const issue = () => setPin.mutate(member.id, { onSuccess: setIssued, onSettled: () => setConfirm(null) });

  return (
    <div className="rounded-lg border border-border px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t("portal.member.heading")}</p>
        <p className="text-xs text-muted-foreground">
          {member.hasPortalAccess ? t("portal.member.has") : t("portal.member.none")}
        </p>
      </div>
      {canEdit && (
        <div className="flex items-center gap-2">
          {member.hasPortalAccess && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirm("remove")}>
              {t("portal.member.remove")}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" disabled={setPin.isPending}
            onClick={() => (member.hasPortalAccess ? setConfirm("replace") : issue())}>
            {setPin.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {member.hasPortalAccess ? t("portal.member.newPin") : t("portal.member.give")}
          </Button>
        </div>
      )}

      <AnimatePresence>
        {confirm === "replace" && (
          <ConfirmDialog key="replace" title={t("portal.member.replaceTitle")} confirmLabel={t("portal.member.newPin")}
            body={t("portal.member.replaceBody", { name: member.fullName })} destructive={false} pending={setPin.isPending}
            onClose={() => setConfirm(null)} onConfirm={issue} />
        )}
        {confirm === "remove" && (
          <ConfirmDialog key="remove" title={t("portal.member.removeTitle")} confirmLabel={t("portal.member.remove")}
            body={t("portal.member.removeBody", { name: member.fullName })} pending={clearPin.isPending}
            onClose={() => setConfirm(null)}
            onConfirm={() => clearPin.mutate(member.id, { onSettled: () => setConfirm(null) })} />
        )}
        {issued && (
          <Modal key="pin" title={t("portal.member.pinTitle")} subtitle={member.fullName} onClose={() => setIssued(null)}
            footer={<Button size="sm" onClick={() => setIssued(null)}>{t("portal.member.pinDone")}</Button>}>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border px-3 py-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("portal.member.cardNumber")}</p>
                <p className="text-lg font-bold mt-1 break-all">{issued.memberNumber}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("portal.member.pin")}</p>
                <p className="text-lg font-bold mt-1 tracking-[0.25em] tabular-nums">{issued.pin}</p>
              </div>
            </div>
            {slug && (
              <p className="text-xs text-muted-foreground break-all">{t("portal.member.signInAt")} <span className="font-medium text-foreground">{portalUrl(slug)}</span></p>
            )}
            <p className="rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm px-3 py-2">
              {t("portal.member.pinOnce")}
            </p>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemberDrawer({ id, deskBranchId, onClose }: { id: string; deskBranchId: string; onClose: () => void }) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const { data: m, isLoading, isError, error } = useMember(id);
  const { branches } = useMyBranches();
  const del = useDeleteMember();
  const canLoans = useCanAny(["library.circulation.view", "library.members.view"]);
  const canReserve = useCan("library.circulation.create");

  const [tab, setTab] = React.useState<"loans" | "fines">("loans");
  const [editing, setEditing] = React.useState(false);
  const [reserving, setReserving] = React.useState(false);
  const [fining, setFining] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [card, setCard] = React.useState(false);

  return (
    <>
      <Modal side size="xl" onClose={onClose}
        title={m?.fullName ?? t("loading")}
        subtitle={m ? `${m.memberNumber} · ${m.membershipTypeName}` : undefined}
        footer={m && (
          <>
            <Can permission="library.members.delete">
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive me-auto" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />{t("action.delete")}
              </Button>
            </Can>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCard(true)}>
              <IdCard className="h-3.5 w-3.5" />{t("print.cards.button")}
            </Button>
            <Can permission="library.fines.create">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFining(true)}><Coins className="h-3.5 w-3.5" />{t("fines.add")}</Button>
            </Can>
            {canReserve && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReserving(true)}>
                <BookMarked className="h-3.5 w-3.5" />{t("reservations.reserve")}
              </Button>
            )}
            <Can permission="library.members.edit">
              <Button size="sm" className="gap-1.5" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />{t("action.edit")}</Button>
            </Can>
          </>
        )}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : isError || !m ? (
          <p className="text-sm text-destructive">{(error as Error)?.message ?? t("loadFailed")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t("field.status"), value: <Pill meta={statusMeta(shownStatus(m))}>{t(`memberStatus.${shownStatus(m)}`)}</Pill> },
                { label: t("members.onLoan"), value: `${m.activeLoans} / ${m.maxLoans}` },
                { label: t("col.overdue"), value: m.overdueLoans, tone: m.overdueLoans > 0 ? "text-destructive" : undefined },
                { label: t("members.unpaid"), value: formatCurrency(m.unpaidFines, currency), tone: m.unpaidFines > 0 ? "text-amber-600" : undefined },
              ].map(x => (
                <div key={x.label} className="rounded-lg border border-border px-3 py-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{x.label}</p>
                  <div className={cn("text-sm font-semibold mt-1 tabular-nums", x.tone)}>{x.value}</div>
                </div>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {([
                [t("members.field.phone"), m.phone], [t("members.field.email"), m.email],
                [t("members.field.idNumber"), m.idNumber], [t("members.field.homeBranch"), m.homeBranchName],
                [t("members.joined"), formatDate(m.joinedOn)],
                [t("members.field.expiresOn"), m.expiresOn ? formatDate(m.expiresOn) : t("members.neverExpires")],
                [t("members.field.address"), m.address], [t("field.notes"), m.notes],
              ] as [string, string | null][]).filter(([, v]) => v).map(([label, v]) => (
                <p key={label} className="flex gap-2 py-0.5"><span className="text-muted-foreground shrink-0">{label}:</span><span className="min-w-0 break-words">{v}</span></p>
              ))}
            </div>

            <PortalAccess member={m} />

            <div className="flex gap-1 border-b border-border">
              {(["loans", "fines"] as const).map(x => (
                <button key={x} onClick={() => setTab(x)}
                  className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px",
                    tab === x ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t(`members.tab.${x}`)}
                </button>
              ))}
            </div>
            {tab === "loans" && canLoans && <LoansPanel deskBranchId={deskBranchId} memberId={m.id} />}
            {tab === "fines" && <FinesTable memberId={m.id} />}
          </>
        )}
      </Modal>

      <AnimatePresence>
        {editing && m && <MemberForm key="edit" editing={m} defaultBranchId={deskBranchId} onClose={() => setEditing(false)} />}
        {reserving && m && <ReserveForm key="reserve" branches={branches} member={m} onClose={() => setReserving(false)}
          defaultBranchId={branches.some(b => b.id === m.homeBranchId) ? m.homeBranchId! : deskBranchId} />}
        {card && m && <CardsModal key="card" members={[m]} onClose={() => setCard(false)} />}
        {fining && m && <AddFineForm key="fine" member={m} onClose={() => setFining(false)} />}
        {confirmDelete && m && (
          <ConfirmDialog key="delete" title={t("members.deleteTitle")} confirmLabel={t("action.delete")}
            body={t("members.deleteBody", { name: m.fullName })} pending={del.isPending}
            onClose={() => setConfirmDelete(false)}
            onConfirm={() => del.mutate(m.id, { onSuccess: onClose, onSettled: () => setConfirmDelete(false) })} />
        )}
      </AnimatePresence>
    </>
  );
}

export function MembersView() {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const canView = useCanAny(["library.members.view", "library.circulation.view"]);
  const { branchId } = useWorkingBranch();

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [cards, setCards] = React.useState(false);

  const term = useDebounced(search.trim());
  React.useEffect(() => { setPage(1); }, [term, status]);

  const { data, isLoading, isError, error } = useMembers({ search: term, status, page, pageSize: PAGE_SIZE }, canView);
  const rows = data?.items ?? [];

  if (!canView) return <div className="p-12 text-center text-sm text-muted-foreground">{t("noAccess")}</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("members.title")} description={t("members.description")}>
        <Button size="sm" variant="outline" className="h-9 gap-1.5 text-sm" onClick={() => setCards(true)} disabled={rows.length === 0}>
          <IdCard className="h-4 w-4" />{t("print.cards.button")}
        </Button>
        <Can permission="library.members.create">
          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-sm" onClick={() => setImporting(true)}>
            <UploadCloud className="h-4 w-4" />{t("import.button")}
          </Button>
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t("members.add")}</Button>
        </Can>
      </PageHeader>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder={t("members.search")} className="flex-1" />
        <select value={status} onChange={e => setStatus(e.target.value)} className={cn(SELECT, "sm:w-48")} aria-label={t("field.status")}>
          <option value="">{t("members.allStatuses")}</option>
          {["active", "expired", "suspended"].map(s => <option key={s} value={s}>{t(`memberStatus.${s}`)}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableState loading={isLoading} error={isError ? (error as Error) : null} empty={rows.length === 0}
            emptyText={term || status ? t("members.noMatch") : t("members.empty")} icon={Users} />
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className={TH}>{t("col.member")}</th>
                    <th className={TH}>{t("members.field.type")}</th>
                    <th className={TH}>{t("members.contact")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("members.onLoan")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("members.unpaid")}</th>
                    <th className={TH}>{t("field.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(m => (
                    <tr key={m.id} onClick={() => setOpenId(m.id)} className="border-t border-border hover:bg-muted/20 cursor-pointer">
                      <td className="px-4 py-3">
                        <p className="font-medium">{m.fullName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{m.memberNumber}</p>
                      </td>
                      <td className="px-4 py-3">{m.membershipTypeName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.phone ?? m.email ?? "—"}</td>
                      <td className="px-4 py-3 text-end tabular-nums">
                        {m.activeLoans}<span className="text-muted-foreground"> / {m.maxLoans}</span>
                        {m.overdueLoans > 0 && <p className="text-[11px] text-destructive">{t("members.overdueCount", { count: m.overdueLoans })}</p>}
                      </td>
                      <td className={cn("px-4 py-3 text-end tabular-nums", m.unpaidFines > 0 && "text-amber-600 font-semibold")}>
                        {m.unpaidFines > 0 ? formatCurrency(m.unpaidFines, currency) : "—"}
                      </td>
                      <td className="px-4 py-3"><Pill meta={statusMeta(shownStatus(m))}>{t(`memberStatus.${shownStatus(m)}`)}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
        </CardContent>
      </Card>

      <AnimatePresence>
        {openId && <MemberDrawer key={openId} id={openId} deskBranchId={branchId} onClose={() => setOpenId(null)} />}
        {creating && <MemberForm key="new" editing={null} defaultBranchId={branchId} onClose={() => setCreating(false)} />}
        {cards && <CardsModal key="cards" members={rows} onClose={() => setCards(false)} />}
        {importing && <ImportModal key="import" kind="members" onClose={() => setImporting(false)} />}
      </AnimatePresence>
    </div>
  );
}
