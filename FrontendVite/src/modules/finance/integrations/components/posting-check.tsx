import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { X, AlertTriangle, CheckCircle2, RefreshCw, Send, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import {
  usePostingCheck, usePostChecked, useAutoReadiness,
} from "@/hooks/finance/use-finance-integrations";
import type { IntegrationDto } from "@/lib/finance/integrations.api";
import { LABEL_CLASS, useIntegrationText } from "./shared";

/**
 * Centred with a flex wrapper rather than left-1/2 + translate: framer-motion writes its own
 * transform on the panel, which would cancel the translate and push the dialog off-centre.
 *
 * Portalled to the body because it is opened from inside drawers, and a drawer's own transform
 * would otherwise become the box that "fixed" is measured against.
 */
function Dialog({ title, subtitle, onClose, children, footer }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { t } = useTranslation("finance");
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-label={title}
        initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label={t("integrations.close")}
            className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">{children}</div>
        <div className="border-t border-border px-6 py-4 shrink-0">{footer}</div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function Tile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className={LABEL_CLASS}>{label}</p>
      <p className={cn("text-lg font-bold tabular-nums mt-1",
        tone === "good" && "text-emerald-600 dark:text-emerald-400",
        tone === "bad" && "text-red-600 dark:text-red-400",
        !tone && "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

/**
 * The step between choosing documents and posting them: what is ready, what is not and why, and
 * what the ready ones add to each ledger account. Posting sends the total shown here back to the
 * server, which posts nothing if the selection no longer comes to it.
 *
 * Rendered by the parent inside AnimatePresence.
 */
export function PostingCheckDialog({ ids, onClose, onPosted }: {
  ids: string[];
  onClose: () => void;
  onPosted?: () => void;
}) {
  const { t } = useTranslation("finance");
  const canPost = useCan("finance.integrations.approve");
  const { data, isFetching, isError, error, refetch } = usePostingCheck(ids, true);
  const post = usePostChecked();
  const [confirmed, setConfirmed] = React.useState(false);

  // A re-run can change the figures, so the tick has to be given again for the new ones.
  React.useEffect(() => { setConfirmed(false); }, [data?.totalDebit, data?.ready]);

  const blocked = data?.results.filter(r => !r.canPost) ?? [];
  const ledger  = (data?.ledgerCurrency ?? "USD") as never;
  const ok      = !!data && data.ready > 0 && data.balanced;

  return (
    <Dialog title={t("integrations.check.title")} subtitle={t("integrations.check.subtitle", { count: ids.length })}
      onClose={onClose}
      footer={
        <div className="space-y-3">
          {ok && canPost && (
            <label className="flex items-start gap-2.5 text-sm text-foreground cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-primary" checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)} />
              <span>{t("integrations.check.confirm", {
                count: data.ready, total: formatCurrency(data.totalDebit, ledger),
              })}</span>
            </label>
          )}
          {!canPost && <p className="text-sm text-muted-foreground">{t("integrations.check.noPermission")}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>{t("integrations.cancel")}</Button>
            <Button size="sm" variant="outline" disabled={isFetching} onClick={() => refetch()}>
              <RefreshCw className={cn("w-3.5 h-3.5 me-1.5", isFetching && "animate-spin")} />
              {t("integrations.check.rerun")}
            </Button>
            {canPost && (
              <Button size="sm" disabled={!ok || !confirmed || post.isPending || isFetching}
                onClick={() => post.mutate(
                  { ids: data!.results.filter(r => r.canPost).map(r => r.itemId), controlTotal: data!.totalDebit },
                  // A refusal (figures changed) keeps the dialog open and re-runs the checks.
                  { onSuccess: () => { onPosted?.(); onClose(); }, onError: () => refetch() },
                )}>
                <Send className="w-3.5 h-3.5 me-1.5" />
                {t("integrations.check.post", { count: data?.ready ?? 0 })}
              </Button>
            )}
          </div>
        </div>
      }>
      {isError && <p className="text-sm text-red-600 dark:text-red-400">{(error as Error)?.message}</p>}
      {!data && isFetching && <p className="text-sm text-muted-foreground">{t("integrations.check.running")}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tile label={t("integrations.check.ready")} value={data.ready} tone={data.ready > 0 ? "good" : undefined} />
            <Tile label={t("integrations.check.blocked")} value={data.blocked} tone={data.blocked > 0 ? "bad" : undefined} />
            <Tile label={t("integrations.check.totalDebit")} value={formatCurrency(data.totalDebit, ledger)} />
            <Tile label={t("integrations.check.totalCredit")} value={formatCurrency(data.totalCredit, ledger)} />
          </div>

          <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium",
            data.ready === 0 ? "border-border text-muted-foreground"
              : data.balanced ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                              : "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400")}>
            {data.ready === 0 ? <AlertTriangle className="w-4 h-4" /> : data.balanced ? <Scale className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {data.ready === 0 ? t("integrations.check.nothingReady")
              : data.balanced ? t("integrations.check.balanced")
                              : t("integrations.check.notBalanced")}
          </div>

          {data.accounts.length > 0 && (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{t("integrations.check.willPost")}</p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-xs text-muted-foreground border-b border-border">
                      <th className="px-3 py-2 text-start font-medium">{t("integrations.preview.account")}</th>
                      <th className="px-3 py-2 text-end font-medium">{t("integrations.side.debit")}</th>
                      <th className="px-3 py-2 text-end font-medium">{t("integrations.side.credit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accounts.map(a => (
                      <tr key={a.accountNumber} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-foreground">{a.accountNumber} — {a.accountName}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{a.debit ? formatCurrency(a.debit, ledger) : ""}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{a.credit ? formatCurrency(a.credit, ledger) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-semibold border-t border-border">
                      <td className="px-3 py-2 text-foreground">{t("integrations.preview.total")}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{formatCurrency(data.totalDebit, ledger)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{formatCurrency(data.totalCredit, ledger)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">{t("integrations.check.oneEntryEach")}</p>
            </section>
          )}

          {blocked.length > 0 && (
            <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                {t("integrations.check.blockedTitle", { count: blocked.length })}
              </p>
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {blocked.map(r => (
                  <li key={r.itemId} className="text-sm">
                    <p className="font-medium text-foreground">
                      {r.sourceNumber}{r.sourceDate && <span className="font-normal text-muted-foreground"> · {formatDate(r.sourceDate)}</span>}
                    </p>
                    {r.problems.map(p => <p key={p} className="text-amber-800 dark:text-amber-400">{p}</p>)}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t("integrations.check.blockedStay")}</p>
            </section>
          )}
        </>
      )}
    </Dialog>
  );
}

/**
 * Shown before automatic posting is switched on. Says, in this workspace's own numbers, what
 * will be posted with nobody reviewing it, and refuses while an account it needs is missing.
 */
export function AutoPostingConfirm({ integration, startDate, busy, onCancel, onConfirm }: {
  integration: IntegrationDto;
  startDate: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("finance");
  const text = useIntegrationText();
  const { data, isLoading, isError, error } = useAutoReadiness(integration.key, startDate, true);
  const [understood, setUnderstood] = React.useState(false);

  // The server refuses automatic posting with no start date: it would post everything the module
  // has ever recorded, including periods already entered in the books by hand.
  const canSwitchOn = !!data?.ready && !!startDate;

  const warnings: string[] = [];
  if (data) {
    warnings.push(t("integrations.auto.warnUnreviewed", { minutes: data.intervalMinutes }));
    if (data.pendingItems > 0)
      warnings.push(t("integrations.auto.warnPending", {
        count: data.pendingItems, amount: formatCurrency(data.pendingAmount, data.documentCurrency as never),
      }));
    if ((data.uncollectedDocuments ?? 0) > 0)
      warnings.push(t("integrations.auto.warnUncollected", { count: data.uncollectedDocuments ?? 0 }));
    if (startDate)
      warnings.push(t("integrations.auto.warnStartDate", { date: formatDate(startDate) }));
    warnings.push(t("integrations.auto.warnHeld"));
    if (data.failedItems > 0)
      warnings.push(t("integrations.auto.warnFailed", { count: data.failedItems }));
    warnings.push(t("integrations.auto.warnReverse"));
  }

  return (
    <Dialog title={t("integrations.auto.title")} subtitle={text.name(integration)} onClose={onCancel}
      footer={
        <div className="space-y-3">
          {canSwitchOn && (
            <label className="flex items-start gap-2.5 text-sm text-foreground cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-primary" checked={understood}
                onChange={e => setUnderstood(e.target.checked)} />
              <span>{t("integrations.auto.understand")}</span>
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onCancel}>{t("integrations.auto.keepManual")}</Button>
            <Button size="sm" variant="destructive" disabled={!canSwitchOn || !understood || busy} onClick={onConfirm}>
              {t("integrations.auto.switchOn")}
            </Button>
          </div>
        </div>
      }>
      {isLoading && <p className="text-sm text-muted-foreground">{t("integrations.check.running")}</p>}
      {isError && <p className="text-sm text-red-600 dark:text-red-400">{(error as Error)?.message}</p>}

      {data && !data.ready && (
        <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">{t("integrations.auto.blockedTitle")}</p>
          {data.blockers.map(b => (
            <p key={b} className="flex gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{b}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">{t("integrations.auto.blockedHint")}</p>
        </section>
      )}

      {data && !startDate && (
        <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
          <p className="flex gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{t("integrations.auto.needStartDate")}
          </p>
          <p className="text-xs text-muted-foreground">{t("integrations.auto.needStartDateHint")}</p>
        </section>
      )}

      {data && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-2.5">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">{t("integrations.auto.warnTitle")}</p>
          {warnings.map(w => (
            <p key={w} className="flex gap-2 text-sm text-foreground">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />{w}
            </p>
          ))}
        </section>
      )}

      {canSwitchOn && (
        <p className="flex gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          {t("integrations.auto.advice")}
        </p>
      )}
    </Dialog>
  );
}
