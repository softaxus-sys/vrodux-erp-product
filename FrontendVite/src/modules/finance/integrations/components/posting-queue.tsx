import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, AlertTriangle, RotateCcw, Send, ClipboardCheck, SkipForward, Undo2, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import {
  usePostingQueue, usePostingPreview, usePostItems, useRetryFailed,
  useSkipItem, useRequeueItem, useReverseItem, useSubmitItems,
} from "@/hooks/finance/use-finance-integrations";
import type { IntegrationDto, PostingItemDto } from "@/lib/finance/integrations.api";
import { LABEL_CLASS, SELECT_CLASS, StatusBadge, useIntegrationText } from "./shared";
import { PostingCheckDialog } from "./posting-check";

const STATUS_FILTERS = ["pending", "failed", "posted", "skipped", "reversed", ""] as const;
const PAGE_SIZE = 50;

export function PostingQueue({ integrations, integrationKey, onIntegrationKeyChange, failedCount, module }: {
  integrations: IntegrationDto[];
  integrationKey: string;
  onIntegrationKeyChange: (key: string) => void;
  failedCount: number;
  /** Limits the list to one module's documents (the posting screen's module tiles). */
  module?: string;
}) {
  const { t } = useTranslation("finance");
  const text = useIntegrationText();
  const canPost = useCan("finance.integrations.approve");
  const canSubmit = useCan("finance.integrations.submit") || canPost;
  const submit = useSubmitItems();

  const [status, setStatus]   = React.useState<string>("pending");
  const [search, setSearch]   = React.useState("");
  const [term, setTerm]       = React.useState("");
  const [page, setPage]       = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState<string[] | null>(null);

  // Debounced so typing a document number is one request, not one per keystroke.
  React.useEffect(() => {
    const id = window.setTimeout(() => setTerm(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  React.useEffect(() => { setPage(1); setSelected(new Set()); }, [status, term, integrationKey, module]);

  const { data, isLoading, isError, error, refetch } = usePostingQueue({
    module: module || undefined,
    integrationKey: integrationKey || undefined, status: status || undefined,
    search: term || undefined, page, pageSize: PAGE_SIZE,
  });
  const retry = useRetryFailed();

  const items = data?.items ?? [];
  const total = data?.totalCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const postable = items.filter(i => i.status === "pending" || i.status === "failed");
  const allSelected = postable.length > 0 && postable.every(i => selected.has(i.id));

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const queueIntegrations = integrations.filter(i => i.kind === "queue" && (!module || i.module === module));
  const needsSecond = new Set(queueIntegrations.filter(i => i.requireSeparateApprover).map(i => i.key));
  const chosen = items.filter(i => selected.has(i.id));
  const toSubmit = chosen.filter(i => i.status === "pending" && !i.submittedAt);
  const toWithdraw = chosen.filter(i => i.submittedAt && i.status === "pending");
  const selectable = canPost || canSubmit;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t("integrations.queue.search")} aria-label={t("integrations.queue.search")}
            className="h-9 ps-9 text-sm" />
        </div>
        <select value={integrationKey} onChange={e => onIntegrationKeyChange(e.target.value)}
          aria-label={t("integrations.queue.integration")} className={SELECT_CLASS}>
          <option value="">{t("integrations.queue.allIntegrations")}</option>
          {queueIntegrations.map(i => <option key={i.key} value={i.key}>{text.name(i)}</option>)}
        </select>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {canPost && failedCount > 0 && (
            <Button size="sm" variant="outline" disabled={retry.isPending}
              onClick={() => retry.mutate(integrationKey || undefined)}>
              <RotateCcw className={cn("w-3.5 h-3.5 me-1.5", retry.isPending && "animate-spin")} />
              {t("integrations.queue.retryFailed", { count: failedCount })}
            </Button>
          )}
          {canSubmit && toSubmit.length > 0 && (
            <Button size="sm" variant="outline" disabled={submit.isPending}
              onClick={() => submit.mutate({ ids: toSubmit.map(i => i.id) }, { onSuccess: () => setSelected(new Set()) })}>
              <Send className="w-3.5 h-3.5 me-1.5" />
              {t("integrations.hub.submit", { count: toSubmit.length })}
            </Button>
          )}
          {canSubmit && toWithdraw.length > 0 && (
            <Button size="sm" variant="ghost" disabled={submit.isPending}
              onClick={() => submit.mutate({ ids: toWithdraw.map(i => i.id), withdraw: true }, { onSuccess: () => setSelected(new Set()) })}>
              {t("integrations.hub.withdraw", { count: toWithdraw.length })}
            </Button>
          )}
          {canPost && selected.size > 0 && (
            <Button size="sm" onClick={() => setChecking([...selected])}>
              <ClipboardCheck className="w-3.5 h-3.5 me-1.5" />
              {t("integrations.modulePanel.checkSelected", { count: selected.size })}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("integrations.queue.status")}>
        {STATUS_FILTERS.map(s => (
          <button key={s || "all"} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              status === s ? "bg-primary text-primary-foreground border-primary"
                           : "border-border text-muted-foreground hover:bg-muted/40")}>
            {s ? t(`integrations.status.${s}`) : t("integrations.queue.allStatuses")}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isError ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">{(error as Error)?.message}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>{t("integrations.retry")}</Button>
          </div>
        ) : isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">{t("integrations.loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Inbox className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">{t("integrations.queue.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {status === "pending" ? t("integrations.queue.emptyPending") : t("integrations.queue.emptyOther")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  {selectable && (
                    <th className="w-10 px-3 py-2.5">
                      <input type="checkbox" className="accent-primary" checked={allSelected}
                        disabled={postable.length === 0}
                        aria-label={t("integrations.queue.selectAll")}
                        // Only the rows on screen: selecting rows nobody can see makes the count meaningless.
                        onChange={() => setSelected(allSelected ? new Set() : new Set(postable.map(i => i.id)))} />
                    </th>
                  )}
                  <th className="px-3 py-2.5 text-start font-medium">{t("integrations.queue.col.date")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("integrations.queue.col.document")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("integrations.queue.col.integration")}</th>
                  <th className="px-3 py-2.5 text-end font-medium">{t("integrations.queue.col.amount")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("integrations.queue.col.status")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("integrations.hub.approvalCol")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("integrations.queue.col.journal")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} onClick={() => setPreviewId(item.id)}
                    className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer">
                    {selectable && (
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        {(item.status === "pending" || item.status === "failed") && (
                          <input type="checkbox" className="accent-primary" checked={selected.has(item.id)}
                            aria-label={t("integrations.queue.selectRow", { number: item.sourceNumber })}
                            onChange={() => toggle(item.id)} />
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(item.sourceDate)}</td>
                    <td className="px-3 py-2.5 min-w-[180px]">
                      <p className="font-medium text-foreground">{item.sourceNumber}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[260px]">{item.description}</p>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{text.nameOf(item.integrationKey, item.integrationName)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums whitespace-nowrap text-foreground">
                      {formatCurrency(item.totalAmount, item.currencyCode as never)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={item.status} />
                      {(item.status === "failed" || item.status === "posted") && item.lastError && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-[280px] line-clamp-2">{item.lastError}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {item.status !== "pending" ? <span className="text-muted-foreground">—</span>
                        : item.submittedAt ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {t("integrations.hub.submittedBy", { name: item.submittedByName ?? "—" })}
                          </span>
                        ) : needsSecond.has(item.integrationKey) ? (
                          <span className="text-amber-700 dark:text-amber-400">{t("integrations.hub.needsSubmit")}</span>
                        ) : <span className="text-muted-foreground">{t("integrations.hub.notSubmitted")}</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{item.journalEntryNumber ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
            <span>{t("integrations.queue.pageOf", { page, pages, total })}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label={t("integrations.queue.prev")}>
                <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              </Button>
              <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label={t("integrations.queue.next")}>
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {previewId && <PreviewDrawer key={previewId} id={previewId} onClose={() => setPreviewId(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {checking && (
          <PostingCheckDialog ids={checking} onClose={() => setChecking(null)} onPosted={() => setSelected(new Set())} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Preview ───────────────────────────────────────────────────────────────────

function PreviewDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation("finance");
  const text = useIntegrationText();
  const canPost = useCan("finance.integrations.approve");
  const canEdit = useCan("finance.integrations.edit");

  const { data, isLoading, isError, error } = usePostingPreview(id);
  const post    = usePostItems();
  const skip    = useSkipItem();
  const requeue = useRequeueItem();
  const reverse = useReverseItem();

  // Inline confirmations — the two actions here that cannot simply be undone by pressing again.
  const [asking, setAsking] = React.useState<"skip" | "reverse" | null>(null);
  const [reason, setReason] = React.useState("");

  const item: PostingItemDto | undefined = data?.item;
  const busy = post.isPending || skip.isPending || requeue.isPending || reverse.isPending;
  const open = item?.status === "pending" || item?.status === "failed";

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed end-0 top-0 h-full w-full max-w-xl bg-card border-s border-border z-50 flex flex-col shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {item ? text.nameOf(item.integrationKey, item.integrationName) : t("integrations.preview.title")}
            </p>
            <h2 className="text-base font-bold text-foreground truncate">{item?.sourceNumber ?? "…"}</h2>
            {item && <div className="mt-2"><StatusBadge status={item.status} /></div>}
          </div>
          <button onClick={onClose} aria-label={t("integrations.close")}
            className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading && <p className="text-sm text-muted-foreground">{t("integrations.loading")}</p>}
          {isError && <p className="text-sm text-red-600 dark:text-red-400">{(error as Error)?.message}</p>}

          {data && item && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><dt className={LABEL_CLASS}>{t("integrations.queue.col.date")}</dt><dd className="mt-0.5 text-foreground">{formatDate(item.sourceDate)}</dd></div>
                <div><dt className={LABEL_CLASS}>{t("integrations.queue.col.amount")}</dt><dd className="mt-0.5 text-foreground tabular-nums">{formatCurrency(item.totalAmount, item.currencyCode as never)}</dd></div>
                <div className="col-span-2"><dt className={LABEL_CLASS}>{t("integrations.preview.description")}</dt><dd className="mt-0.5 text-foreground">{item.description}</dd></div>
              </dl>

              {item.status === "posted" && item.lastError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <p className={cn(LABEL_CLASS, "text-red-700 dark:text-red-400")}>{t("integrations.preview.needsReversal")}</p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">{item.lastError}</p>
                </div>
              )}

              {item.status === "failed" && item.lastError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <p className={cn(LABEL_CLASS, "text-red-700 dark:text-red-400")}>
                    {t("integrations.preview.lastFailure", { count: item.attempts })}
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">{item.lastError}</p>
                </div>
              )}

              {item.status === "skipped" && item.lastError && (
                <p className="text-sm text-muted-foreground">{t("integrations.preview.skipReason", { reason: item.lastError })}</p>
              )}

              <section className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  {item.status === "posted" || item.status === "reversed"
                    ? t("integrations.preview.entryNow") : t("integrations.preview.entryWillBe")}
                </p>
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
                      {data.lines.map(l => (
                        <tr key={l.role} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">
                            <p className={cn("text-foreground", !l.accountId && "text-red-600 dark:text-red-400")}>
                              {l.accountId ? `${l.accountNumber} — ${l.accountName}` : t("integrations.preview.noAccount")}
                            </p>
                            <p className="text-xs text-muted-foreground">{text.role(l.role, l.roleLabel)}</p>
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">{l.debit ? formatCurrency(l.debit, data.ledgerCurrency as never) : ""}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{l.credit ? formatCurrency(l.credit, data.ledgerCurrency as never) : ""}</td>
                        </tr>
                      ))}
                      {data.lines.length === 0 && (
                        <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">{t("integrations.preview.noLines")}</td></tr>
                      )}
                    </tbody>
                    {data.lines.length > 0 && (
                      <tfoot>
                        <tr className="bg-muted/30 font-semibold border-t border-border">
                          <td className="px-3 py-2 text-foreground">{t("integrations.preview.total")}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{formatCurrency(data.totalDebit, data.ledgerCurrency as never)}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{formatCurrency(data.totalCredit, data.ledgerCurrency as never)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {data.rate !== 1 && (
                  <p className="text-xs text-muted-foreground">
                    {t("integrations.preview.converted", { from: item.currencyCode, to: data.ledgerCurrency, rate: data.rate.toFixed(4) })}
                  </p>
                )}
              </section>

              {open && data.problems.length > 0 && (
                <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">{t("integrations.preview.cannotPost")}</p>
                  {data.problems.map(p => (
                    <p key={p} className="flex gap-2 text-sm text-amber-800 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{p}
                    </p>
                  ))}
                </section>
              )}

              {item.journalEntryNumber && (
                <section className="rounded-xl border border-border p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className={LABEL_CLASS}>{t("integrations.preview.journalEntry")}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{item.journalEntryNumber}</p>
                    {item.postedAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("integrations.preview.postedBy", { when: formatDate(item.postedAt), who: item.postedByName ?? "—" })}
                      </p>
                    )}
                  </div>
                  <Link to="/finance/journals" className="text-sm font-medium text-primary hover:underline whitespace-nowrap">
                    {t("integrations.preview.openJournals")}
                  </Link>
                </section>
              )}
            </>
          )}
        </div>

        {data && item && (
          <div className="border-t border-border px-6 py-4 shrink-0 space-y-3">
            {asking && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-sm text-foreground">
                  {asking === "skip" ? t("integrations.preview.skipAsk") : t("integrations.preview.reverseAsk", { number: item.journalEntryNumber })}
                </p>
                {(asking === "skip" || asking === "reverse") && (
                  <Input value={reason} onChange={e => setReason(e.target.value)} maxLength={500}
                    placeholder={asking === "reverse" ? t("integrations.preview.reverseReasonPh") : t("integrations.preview.skipReasonPh")}
                    aria-label={asking === "reverse" ? t("integrations.preview.reverseReasonPh") : t("integrations.preview.skipReasonPh")}
                    className="h-9 text-sm" />
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={busy || (asking === "reverse" && reason.trim().length < 3)}
                    onClick={() => asking === "skip"
                      ? skip.mutate({ id, reason: reason.trim() || undefined }, { onSuccess: onClose })
                      : reverse.mutate({ id, reason: reason.trim() }, { onSuccess: () => { setAsking(null); setReason(""); } })}>
                    {asking === "skip" ? t("integrations.preview.skipConfirm") : t("integrations.preview.reverseConfirm")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>{t("integrations.cancel")}</Button>
                </div>
              </div>
            )}

            {!asking && (
              <div className="flex flex-wrap gap-2">
                {open && canPost && (
                  <Button size="sm" disabled={busy || !data.canPost} onClick={() => post.mutate([id])}>
                    <Send className="w-3.5 h-3.5 me-1.5" />
                    {item.status === "failed" ? t("integrations.preview.retry") : t("integrations.preview.post")}
                  </Button>
                )}
                {open && canEdit && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setAsking("skip")}>
                    <SkipForward className="w-3.5 h-3.5 me-1.5" />{t("integrations.preview.skip")}
                  </Button>
                )}
                {(item.status === "skipped" || item.status === "reversed") && (canEdit || canPost) && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => requeue.mutate(id)}>
                    <Undo2 className="w-3.5 h-3.5 me-1.5" />{item.status === "reversed" ? t("integrations.preview.postAgain") : t("integrations.preview.requeue")}
                  </Button>
                )}
                {item.status === "posted" && canPost && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setAsking("reverse")}>
                    <Undo2 className="w-3.5 h-3.5 me-1.5" />{t("integrations.preview.reverse")}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </>
  );
}
