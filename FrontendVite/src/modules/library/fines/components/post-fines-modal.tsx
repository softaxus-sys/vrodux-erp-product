import * as React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Landmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { financeApi } from "@/lib/finance/finance.api";
import { localToday } from "@/lib/library/library.api";
import {
  buildFinesJournal, defaultFinePostingAccounts, useFinePostingHistory, usePostFinesToFinance, useUnpostedFinePayments,
  type FinePostingAccounts,
} from "@/hooks/library/use-library-finance";
import { Field, Modal, SELECT } from "../../shared/ui";

/**
 * Puts collected fines into the ledger as one draft journal entry. The accounts are always shown
 * and chosen by a person: a chart of accounts is the workspace's own, so a silent guess would
 * put real money on the wrong line.
 */
export function PostFinesModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const today = localToday();

  const [through, setThrough] = React.useState(today);
  const [picked, setPicked] = React.useState<FinePostingAccounts>({ receivedInId: "", incomeId: "" });

  const { data: accounts = [], isLoading: loadingAccounts, isError: accountsFailed, error: accountsError } = useQuery({
    queryKey: ["finance", "accounts", "active-for-library-fines"],
    queryFn: () => financeApi.getAccounts({ isActive: true }),
    staleTime: 60 * 1000,
  });
  const { data: preview, isLoading: loadingPreview, isError: previewFailed, error: previewError } =
    useUnpostedFinePayments(through && through <= today ? through : today);
  const { data: history = [] } = useFinePostingHistory();
  const post = usePostFinesToFinance();

  React.useEffect(() => { if (accounts.length > 0) setPicked(defaultFinePostingAccounts(accounts)); }, [accounts]);

  const sameAccount = !!picked.receivedInId && picked.receivedInId === picked.incomeId;
  const journal = preview ? buildFinesJournal(preview, accounts, picked, today) : null;
  const nothing = !!preview && preview.count === 0;

  const select = (key: keyof FinePostingAccounts) => (
    <select className={SELECT} value={picked[key]} onChange={e => setPicked(prev => ({ ...prev, [key]: e.target.value }))}>
      <option value="">{t("finance.chooseAccount")}</option>
      {accounts.map(a => <option key={a.id} value={a.id}>{a.accountNumber} — {a.name}</option>)}
    </select>
  );

  return (
    <Modal size="lg" title={t("finance.title")} subtitle={t("finance.subtitle")} onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={post.isPending}>{t("action.close")}</Button>
          <Button size="sm" className="gap-1.5" disabled={!journal || !preview || post.isPending}
            onClick={() => preview && post.mutate({ preview, accounts, picked, date: today }, { onSuccess: onClose })}>
            {post.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Landmark className="h-3.5 w-3.5" />}
            {t("finance.post")}
          </Button>
        </>
      }>
      <Field label={t("finance.through")} hint={t("finance.throughHint")}>
        <Input type="date" max={today} value={through} onChange={e => setThrough(e.target.value)} className="h-9 text-sm w-48" />
      </Field>

      {loadingPreview || loadingAccounts ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("loading")}</p>
      ) : previewFailed || accountsFailed ? (
        <p className="text-sm text-destructive">{((previewError ?? accountsError) as Error)?.message ?? t("loadFailed")}</p>
      ) : nothing ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("finance.nothing")}</p>
      ) : preview && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border px-3 py-2.5 col-span-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("finance.toPost")}</p>
              <p className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(preview.total, currency)}</p>
              <p className="text-[11px] text-muted-foreground">{t("finance.payments", { count: preview.count })}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2.5 col-span-2 text-sm space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("finance.breakdown")}</p>
              {preview.from && preview.to && (
                <p className="text-xs text-muted-foreground">{formatDate(preview.from)}{preview.from !== preview.to ? ` – ${formatDate(preview.to)}` : ""}</p>
              )}
              <p className="text-xs">
                {preview.byMethod.map(m => `${t(`paymentMethod.${m.key}`, { defaultValue: m.key })}: ${formatCurrency(m.amount, currency)}`).join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground">
                {preview.byType.map(x => `${t(`fineType.${x.key}`, { defaultValue: x.key })}: ${formatCurrency(x.amount, currency)}`).join(" · ")}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t("finance.receivedIn")} hint={t("finance.receivedInHint")}>{select("receivedInId")}</Field>
            <Field label={t("finance.income")} hint={t("finance.incomeHint")}>{select("incomeId")}</Field>
          </div>

          {accounts.length === 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm px-3 py-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{t("finance.noAccounts")}
            </p>
          )}
          {sameAccount && <p className="text-xs text-destructive">{t("finance.sameAccount")}</p>}

          {journal && (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-start font-semibold px-3 py-2">{t("finance.account")}</th>
                    <th className="text-end font-semibold px-3 py-2">{t("finance.debit")}</th>
                    <th className="text-end font-semibold px-3 py-2">{t("finance.credit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.lines.map(l => (
                    <tr key={l.accountId} className="border-t border-border">
                      <td className="px-3 py-2">{l.accountName}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{l.debitAmount ? formatCurrency(l.debitAmount, currency) : ""}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{l.creditAmount ? formatCurrency(l.creditAmount, currency) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("finance.draftNote")}</p>
        </>
      )}

      {history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("finance.history")}</p>
          <ul className="rounded-lg border border-border divide-y divide-border text-sm">
            {history.slice(0, 6).map(h => (
              <li key={h.journalEntryId} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{h.journalEntryNumber ?? "—"}</span>
                  <span className="text-xs text-muted-foreground"> · {formatDate(h.from)}{h.from !== h.to ? ` – ${formatDate(h.to)}` : ""} · {t("finance.payments", { count: h.payments })}</span>
                </span>
                <span className="tabular-nums font-semibold shrink-0">{formatCurrency(h.amount, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
