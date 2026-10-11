import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { BookCopy, CornerDownLeft, RefreshCw, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useCan } from "@/components/auth/can";
import { useLoans, useMarkLoanLost, useRenewLoan, useReturnLoan } from "@/hooks/library/use-library";
import { statusMeta, type BranchDto, type LoanDto } from "@/lib/library/library.api";
import { ConfirmDialog, Pager, Pill, SearchBox, SELECT, TableState, TH, useDebounced } from "../../shared/ui";

const PAGE_SIZE = 50;
const STATUSES = ["active", "overdue", "returned", "lost", "all"] as const;

/**
 * Loans as a table with return / renew / report-lost. Used for the whole library on the
 * circulation page, and for one member (pass `memberId`) on their record.
 */
export function LoansPanel({ deskBranchId, branches = [], memberId, initialStatus = "active" }: {
  deskBranchId: string; branches?: BranchDto[]; memberId?: string; initialStatus?: string;
}) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const canEdit = useCan("library.circulation.edit");
  const giveBack = useReturnLoan();
  const renew = useRenewLoan();
  const lost = useMarkLoanLost();

  const [status, setStatus] = React.useState(initialStatus);
  const [branchId, setBranchId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pendingLost, setPendingLost] = React.useState<LoanDto | null>(null);

  const term = useDebounced(search.trim());
  React.useEffect(() => { setPage(1); }, [term, status, branchId]);

  const { data, isLoading, isError, error } = useLoans({
    status: status === "all" ? undefined : status, branchId: branchId || undefined, memberId,
    search: term || undefined, page, pageSize: PAGE_SIZE,
  });
  const rows = data?.items ?? [];

  const doReturn = (l: LoanDto) => giveBack.mutate({ id: l.id, returnBranchId: deskBranchId || null }, {
    onSuccess: r => {
      toast.success(r.fineAmount > 0
        ? t("toast.returnedFine", { title: r.loan.title, amount: formatCurrency(r.fineAmount, currency) })
        : t("toast.returned", { title: r.loan.title }));
      if (r.heldForMemberName)
        toast.info(t("desk.holdFor", { member: r.heldForMemberName, branch: r.heldAtBranchName ?? "" }));
    },
  });

  const actionBtn = "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:bg-muted disabled:opacity-40";

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                status === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
              {t(`loans.filter.${s}`)}
            </button>
          ))}
        </div>
        {!memberId && (
          <>
            <SearchBox value={search} onChange={setSearch} placeholder={t("loans.search")} className="flex-1" />
            <select value={branchId} onChange={e => setBranchId(e.target.value)} className={cn(SELECT, "lg:w-48")} aria-label={t("field.branch")}>
              <option value="">{t("allBranches")}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <TableState loading={isLoading} error={isError ? (error as Error) : null} empty={rows.length === 0}
            emptyText={t("loans.empty")} icon={BookCopy} />
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className={TH}>{t("field.title")}</th>
                    {!memberId && <th className={TH}>{t("col.member")}</th>}
                    <th className={TH}>{t("col.issued")}</th>
                    <th className={TH}>{t("col.due")}</th>
                    <th className={TH}>{t("field.status")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(l => {
                    const shown = l.isOverdue ? "overdue" : l.status;
                    return (
                      <tr key={l.id} className="border-t border-border align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium">{l.title}</p>
                          <p className="text-[11px] text-muted-foreground"><span className="font-mono">{l.barcode}</span> · {l.branchName}</p>
                        </td>
                        {!memberId && (
                          <td className="px-4 py-3">
                            <p>{l.memberName}</p>
                            <p className="text-[11px] text-muted-foreground">{l.memberNumber}{l.memberPhone && ` · ${l.memberPhone}`}</p>
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDate(l.issuedOn)}
                          {l.issuedByName && <p className="text-[11px] text-muted-foreground">{l.issuedByName}</p>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDate(l.dueDate)}
                          {l.returnedOn && <p className="text-[11px] text-muted-foreground">{t("loans.returnedOn", { date: formatDate(l.returnedOn) })}</p>}
                          {l.renewalCount > 0 && <p className="text-[11px] text-muted-foreground">{t("loans.renewed", { count: l.renewalCount })}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Pill meta={statusMeta(shown)}>{t(`loanStatus.${shown}`, { defaultValue: shown })}</Pill>
                          {l.daysOverdue > 0 && <p className="text-[11px] text-destructive mt-1">{t("loans.daysLate", { days: l.daysOverdue })}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {canEdit && l.status === "active" && (
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              <button className={cn(actionBtn, "text-primary")} disabled={giveBack.isPending} onClick={() => doReturn(l)}>
                                <CornerDownLeft className="h-3.5 w-3.5" />{t("loans.return")}
                              </button>
                              <button className={actionBtn} disabled={renew.isPending} onClick={() => renew.mutate(l.id)}>
                                <RefreshCw className="h-3.5 w-3.5" />{t("loans.renew")}
                              </button>
                              <button className={cn(actionBtn, "text-destructive")} onClick={() => setPendingLost(l)}>
                                <TriangleAlert className="h-3.5 w-3.5" />{t("loans.lost")}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
        </CardContent>
      </Card>

      <AnimatePresence>
        {pendingLost && (
          <ConfirmDialog title={t("loans.lostTitle")} confirmLabel={t("loans.lostConfirm")} pending={lost.isPending}
            body={t("loans.lostBody", { title: pendingLost.title, member: pendingLost.memberName })}
            onClose={() => setPendingLost(null)}
            onConfirm={() => lost.mutate(pendingLost.id, { onSettled: () => setPendingLost(null) })} />
        )}
      </AnimatePresence>
    </div>
  );
}
