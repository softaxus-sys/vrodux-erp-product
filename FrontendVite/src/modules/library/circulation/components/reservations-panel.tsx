import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { ArrowLeftRight, BookMarked, Loader2, PackageCheck, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { Can, useCan } from "@/components/auth/can";
import {
  useCancelReservation, useInTransit, useIssueLoan, useReceiveCopy, useReservations, useReserve,
} from "@/hooks/library/use-library";
import {
  statusMeta, type BranchDto, type MemberDto, type ReservationDto, type TitleSummaryDto,
} from "@/lib/library/library.api";
import { ConfirmDialog, Field, MemberPicker, Modal, Pill, SELECT, TableState, TH, TitlePicker, useCanAny } from "../../shared/ui";

/** Reserve a title for a member. Usable from the desk, or seeded with a member from their record. */
export function ReserveForm({ branches, defaultBranchId, member: seedMember, onClose }: {
  branches: BranchDto[]; defaultBranchId: string; member?: MemberDto | null; onClose: () => void;
}) {
  const { t } = useTranslation("library");
  const reserve = useReserve();
  const [member, setMember] = React.useState<MemberDto | null>(seedMember ?? null);
  const [title, setTitle] = React.useState<TitleSummaryDto | null>(null);
  const [branchId, setBranchId] = React.useState(defaultBranchId);
  const pickup = branchId || branches[0]?.id || "";
  const valid = !!member && !!title && !!pickup;

  const save = () => valid && reserve.mutate({ titleId: title.id, memberId: member.id, pickupBranchId: pickup }, {
    onSuccess: r => {
      toast.success(r.status === "ready"
        ? t("toast.reservedReady", { title: r.title, barcode: r.barcode ?? "" })
        : t("toast.reserved", { title: r.title }));
      onClose();
    },
  });

  return (
    <Modal title={t("reservations.new")} onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={reserve.isPending}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={!valid || reserve.isPending} onClick={save}>
            {reserve.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("reservations.reserve")}
          </Button>
        </>
      }>
      <Field label={t("desk.member")}><MemberPicker value={member} onChange={setMember} autoFocus={!seedMember} /></Field>
      <Field label={t("field.title")}><TitlePicker value={title} onChange={setTitle} /></Field>
      <Field label={t("reservations.pickup")} hint={t("reservations.pickupHint")}>
        <select value={pickup} onChange={e => setBranchId(e.target.value)} className={SELECT}>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
    </Modal>
  );
}

export function ReservationsPanel({ branches, deskBranchId }: { branches: BranchDto[]; deskBranchId: string }) {
  const { t } = useTranslation("library");
  const canIssue = useCan("library.circulation.create");
  const canEdit = useCan("library.circulation.edit");
  const cancel = useCancelReservation();
  const issue = useIssueLoan();

  const [status, setStatus] = React.useState("open");
  const [branchId, setBranchId] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [pending, setPending] = React.useState<ReservationDto | null>(null);

  const { data: rows = [], isLoading, isError, error } = useReservations({ status, branchId: branchId || undefined });

  // A ready reservation is collected by issuing the held copy to the member who reserved it.
  const collect = (r: ReservationDto) => r.copyId && issue.mutate({ memberId: r.memberId, copyId: r.copyId }, {
    onSuccess: l => toast.success(t("toast.issued", { title: l.title, date: formatDate(l.dueDate) })),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex flex-wrap gap-1 flex-1">
          {["open", "ready", "waiting", "all"].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                status === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
              {t(`reservations.filter.${s}`)}
            </button>
          ))}
        </div>
        <select value={branchId} onChange={e => setBranchId(e.target.value)} className={cn(SELECT, "sm:w-48")} aria-label={t("reservations.pickup")}>
          <option value="">{t("allBranches")}</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <Can permission="library.circulation.create">
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />{t("reservations.new")}</Button>
        </Can>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableState loading={isLoading} error={isError ? (error as Error) : null} empty={rows.length === 0}
            emptyText={t("reservations.empty")} icon={BookMarked} />
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className={TH}>{t("field.title")}</th>
                    <th className={TH}>{t("col.member")}</th>
                    <th className={TH}>{t("reservations.pickup")}</th>
                    <th className={TH}>{t("col.reserved")}</th>
                    <th className={TH}>{t("field.status")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.title}</p>
                        {r.barcode && r.status === "ready" && <p className="text-[11px] text-muted-foreground font-mono">{r.barcode}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p>{r.memberName}</p>
                        <p className="text-[11px] text-muted-foreground">{r.memberNumber}{r.memberPhone && ` · ${r.memberPhone}`}</p>
                      </td>
                      <td className="px-4 py-3">{r.pickupBranchName}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.reservedOn)}</td>
                      <td className="px-4 py-3">
                        <Pill meta={statusMeta(r.status)}>{t(`reservationStatus.${r.status}`, { defaultValue: r.status })}</Pill>
                        {r.status === "ready" && r.holdUntil && (
                          <p className={cn("text-[11px] mt-1", r.holdExpired ? "text-destructive font-medium" : "text-muted-foreground")}>
                            {r.holdExpired ? t("reservations.holdExpired", { date: formatDate(r.holdUntil) }) : t("reservations.holdUntil", { date: formatDate(r.holdUntil) })}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          {canIssue && r.status === "ready" && (
                            <Button size="sm" className="h-7 text-xs" disabled={issue.isPending} onClick={() => collect(r)}>{t("reservations.collect")}</Button>
                          )}
                          {canEdit && (r.status === "ready" || r.status === "waiting") && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPending(r)}>{t("action.cancel")}</Button>
                          )}
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
        {creating && <ReserveForm key="new" branches={branches} defaultBranchId={deskBranchId} onClose={() => setCreating(false)} />}
        {pending && (
          <ConfirmDialog key="cancel" title={t("reservations.cancelTitle")} confirmLabel={t("reservations.cancelConfirm")}
            body={t("reservations.cancelBody", { member: pending.memberName, title: pending.title })} pending={cancel.isPending}
            onClose={() => setPending(null)}
            onConfirm={() => cancel.mutate(pending.id, { onSettled: () => setPending(null) })} />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Copies sent to another branch and not yet received there. */
export function TransfersPanel() {
  const { t } = useTranslation("library");
  const canReceive = useCanAny(["library.catalog.edit", "library.circulation.edit"]);
  const { data: rows = [], isLoading, isError, error } = useInTransit();
  const receive = useReceiveCopy();

  return (
    <Card>
      <CardContent className="p-0">
        <TableState loading={isLoading} error={isError ? (error as Error) : null} empty={rows.length === 0}
          emptyText={t("transfers.empty")} icon={ArrowLeftRight} />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className={TH}>{t("field.title")}</th>
                  <th className={TH}>{t("transfers.from")}</th>
                  <th className={TH}>{t("transfers.to")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{c.barcode}</p>
                    </td>
                    <td className="px-4 py-3">{c.branchName}</td>
                    <td className="px-4 py-3 font-medium">{c.transitToBranchName ?? "—"}</td>
                    <td className="px-4 py-3 text-end">
                      {canReceive && (
                        <Button size="sm" className="h-7 text-xs gap-1" disabled={receive.isPending} onClick={() => receive.mutate(c.id)}>
                          <PackageCheck className="h-3.5 w-3.5" />{t("transfers.receive")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
