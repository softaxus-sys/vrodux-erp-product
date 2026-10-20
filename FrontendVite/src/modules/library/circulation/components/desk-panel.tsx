import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Loader2, ScanLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { Can } from "@/components/auth/can";
import { useIssueLoan, useMember, useReturnLoan } from "@/hooks/library/use-library";
import { libraryApi, type LoanDto, type MemberDto, type ReturnResultDto } from "@/lib/library/library.api";
import { Field, MemberPicker } from "../../shared/ui";

/** A barcode box that fires on Enter — which is what a handheld scanner sends after the code. */
function ScanBox({ onScan, busy, placeholder, disabled }: {
  onScan: (barcode: string) => void; busy: boolean; placeholder: string; disabled?: boolean;
}) {
  const { t } = useTranslation("library");
  const [value, setValue] = React.useState("");
  const submit = () => { const b = value.trim(); if (b && !busy) { onScan(b); setValue(""); } };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <ScanLine className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input value={value} onChange={e => setValue(e.target.value)} disabled={disabled}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholder} className="h-10 ps-9 text-sm font-mono" />
      </div>
      <Button className="h-10 gap-1.5" onClick={submit} disabled={disabled || busy || !value.trim()}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t("desk.go")}
      </Button>
    </div>
  );
}

function MemberNotice({ member }: { member: MemberDto }) {
  const { t } = useTranslation("library");
  const currency = useCurrency();

  const problems = [
    member.status === "suspended" && t("desk.memberSuspended"),
    member.isExpired && t("desk.memberExpired", { date: formatDate(member.expiresOn) }),
    member.activeLoans >= member.maxLoans && t("desk.memberAtLimit", { max: member.maxLoans }),
    member.overdueLoans > 0 && t("desk.memberOverdue", { count: member.overdueLoans }),
    member.unpaidFines > 0 && t("desk.memberFines", { amount: formatCurrency(member.unpaidFines, currency) }),
  ].filter(Boolean) as string[];

  if (problems.length === 0) return null;
  return (
    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm px-3 py-2 space-y-0.5">
      {problems.map(p => (
        <p key={p} className="flex items-start gap-2"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{p}</p>
      ))}
    </div>
  );
}

function IssueCard() {
  const { t } = useTranslation("library");
  const issue = useIssueLoan();

  const [picked, setPicked] = React.useState<MemberDto | null>(null);
  const [dueDate, setDueDate] = React.useState("");
  const [looking, setLooking] = React.useState(false);
  const [issued, setIssued] = React.useState<LoanDto[]>([]);

  // The picked member is re-read after each issue, so the loan count and warnings stay true.
  const { data: fresh } = useMember(picked?.id ?? null);
  const member = fresh ?? picked;

  const scan = async (barcode: string) => {
    if (!member) return;
    setLooking(true);
    // The mutation reports its own failure; only a barcode that finds nothing is reported here.
    let lookedUp = false;
    try {
      const copy = await libraryApi.getCopyByBarcode(barcode);
      lookedUp = true;
      const loan = await issue.mutateAsync({ memberId: member.id, copyId: copy.id, dueDate: dueDate || null });
      setIssued(prev => [loan, ...prev]);
      toast.success(t("toast.issued", { title: loan.title, date: formatDate(loan.dueDate) }));
    } catch (e) {
      if (!lookedUp) toast.error((e as Error).message);
    } finally {
      setLooking(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-base font-bold"><ArrowUpFromLine className="h-4 w-4 text-primary" />{t("desk.issue")}</h2>

        <Field label={t("desk.member")}>
          <MemberPicker value={member} onChange={m => { setPicked(m); setIssued([]); }} autoFocus />
        </Field>
        {member && <MemberNotice member={member} />}

        <Field label={t("desk.scanToIssue")} hint={member ? t("desk.scanHint") : t("desk.pickMemberFirst")}>
          <ScanBox onScan={scan} busy={looking || issue.isPending} placeholder={t("desk.barcode")} disabled={!member} />
        </Field>

        <Field label={t("desk.dueOverride")} hint={t("desk.dueOverrideHint")} className="max-w-[14rem]">
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm" />
        </Field>

        {issued.length > 0 && (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {issued.map(l => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{l.title}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{l.barcode}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{t("desk.dueOn", { date: formatDate(l.dueDate) })}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ReturnCard({ branchId, branchName }: { branchId: string; branchName: string }) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const giveBack = useReturnLoan();

  const [damaged, setDamaged] = React.useState(false);
  const [looking, setLooking] = React.useState(false);
  const [returned, setReturned] = React.useState<ReturnResultDto[]>([]);

  const scan = async (barcode: string) => {
    setLooking(true);
    let lookedUp = false;
    try {
      const copy = await libraryApi.getCopyByBarcode(barcode);
      lookedUp = true;
      if (!copy.loanId) {
        toast.error(t("desk.notOnLoan", { barcode: copy.barcode, status: t(`copyStatus.${copy.status}`, { defaultValue: copy.status }) }));
        return;
      }
      const result = await giveBack.mutateAsync({ id: copy.loanId, returnBranchId: branchId || null, damaged });
      setReturned(prev => [result, ...prev]);
      setDamaged(false);
      toast.success(t("toast.returned", { title: result.loan.title }));
    } catch (e) {
      if (!lookedUp) toast.error((e as Error).message);
    } finally {
      setLooking(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-base font-bold"><ArrowDownToLine className="h-4 w-4 text-success" />{t("desk.return")}</h2>

        <Field label={t("desk.scanToReturn")} hint={branchName ? t("desk.returnHint", { branch: branchName }) : undefined}>
          <ScanBox onScan={scan} busy={looking || giveBack.isPending} placeholder={t("desk.barcode")} />
        </Field>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={damaged} onChange={e => setDamaged(e.target.checked)} />
          {t("desk.damaged")}
        </label>

        {returned.length > 0 && (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {returned.map(r => (
              <li key={r.loan.id} className="px-3 py-2 text-sm space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium truncate">{r.loan.title}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{r.loan.memberName}</span>
                </div>
                {r.daysOverdue > 0 && (
                  <p className="text-xs text-destructive">
                    {r.fineAmount > 0
                      ? t("desk.lateWithFine", { days: r.daysOverdue, amount: formatCurrency(r.fineAmount, currency) })
                      : t("desk.late", { days: r.daysOverdue })}
                  </p>
                )}
                {r.heldForMemberName && (
                  <p className="text-xs text-violet-600 dark:text-violet-300 font-medium">
                    {t("desk.holdFor", { member: r.heldForMemberName, branch: r.heldAtBranchName ?? "" })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function DeskPanel({ branchId, branchName }: { branchId: string; branchName: string }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <Can permission="library.circulation.create"><IssueCard /></Can>
      <Can permission="library.circulation.edit"><ReturnCard branchId={branchId} branchName={branchName} /></Can>
    </div>
  );
}
