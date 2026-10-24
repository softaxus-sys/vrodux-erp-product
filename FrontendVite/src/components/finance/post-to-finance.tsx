import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, RefreshCw, Landmark, ClipboardCheck, Inbox, Zap, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { useAuthStore } from "@/store/auth.store";
import {
  useModuleIntegrations, usePostingQueue, useSyncIntegrations, useUpdateIntegrationSetting,
} from "@/hooks/finance/use-finance-integrations";
import type { IntegrationDto } from "@/lib/finance/integrations.api";
import { StatusBadge, useIntegrationText } from "@/modules/finance/integrations/components/shared";
import { PostingCheckDialog } from "@/modules/finance/integrations/components/posting-check";

/** Modules whose documents can be posted to the ledger from the posting queue. */
export type PostingModule = "pos" | "restaurant" | "real-estate" | "library" | "hr" | "hospitality";

const TABS = ["pending", "failed", "posted"] as const;
type Tab = (typeof TABS)[number];

/**
 * "Post to Finance" for a module's own screen.
 *
 * Renders nothing for a workspace without Finance, or a user who cannot see the Integration
 * Center — the module works without Finance, and posting stays Finance's permission, not the
 * module's: a restaurant manager does not gain the ledger by having this button on their page.
 */
export function PostToFinanceButton({ module, className }: { module: PostingModule; className?: string }) {
  const { t } = useTranslation("finance");
  const hasFinance = useAuthStore(s => s.hasModuleAccess)("finance");
  const canView = useCan("finance.integrations.view");
  const enabled = hasFinance && canView;

  const { data } = useModuleIntegrations(module, enabled);
  const [open, setOpen] = React.useState(false);

  if (!enabled) return null;

  const queues  = (data?.integrations ?? []).filter(i => i.kind === "queue");
  const waiting = queues.reduce((n, i) => n + (i.queue?.pending ?? 0) + (i.queue?.failed ?? 0), 0);
  const failed  = queues.some(i => (i.queue?.failed ?? 0) > 0);

  return (
    <>
      <Button size="sm" variant="outline" className={cn("h-9 gap-1.5 text-sm", className)} onClick={() => setOpen(true)}>
        <Landmark className="h-3.5 w-3.5" />
        {t("integrations.modulePanel.button")}
        {waiting > 0 && (
          <span className={cn("rounded-full px-1.5 text-xs font-semibold tabular-nums",
            failed ? "bg-red-500/15 text-red-700 dark:text-red-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>
            {waiting}
          </span>
        )}
      </Button>
      <AnimatePresence>
        {open && <ModulePostingDrawer module={module} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

function ModulePostingDrawer({ module, onClose }: { module: PostingModule; onClose: () => void }) {
  const { t } = useTranslation("finance");
  const text = useIntegrationText();
  const { data, isLoading, isError, error } = useModuleIntegrations(module, true);

  const queues = React.useMemo(() => (data?.integrations ?? []).filter(i => i.kind === "queue"), [data]);
  const [key, setKey] = React.useState<string | null>(null);
  const active = queues.find(i => i.key === key) ?? queues[0];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed end-0 top-0 h-full w-full max-w-2xl bg-card border-s border-border z-50 flex flex-col shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{text.module(module)}</p>
            <h2 className="text-base font-bold text-foreground">{t("integrations.modulePanel.title")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t("integrations.modulePanel.subtitle")}</p>
          </div>
          <button onClick={onClose} aria-label={t("integrations.close")}
            className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {queues.length > 1 && (
          <div className="flex gap-1.5 px-6 pt-4 overflow-x-auto shrink-0" role="tablist">
            {queues.map(i => {
              const n = (i.queue?.pending ?? 0) + (i.queue?.failed ?? 0);
              return (
                <button key={i.key} role="tab" aria-selected={active?.key === i.key} onClick={() => setKey(i.key)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors",
                    active?.key === i.key ? "bg-primary text-primary-foreground border-primary"
                                          : "border-border text-muted-foreground hover:bg-muted/40")}>
                  {text.name(i)}{n > 0 && ` (${n})`}
                </button>
              );
            })}
          </div>
        )}

        {isLoading && <p className="p-6 text-sm text-muted-foreground">{t("integrations.loading")}</p>}
        {isError && <p className="p-6 text-sm text-red-600 dark:text-red-400">{(error as Error)?.message}</p>}
        {data && queues.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">{t("integrations.modulePanel.none")}</p>
        )}

        {/* Keyed so selection and tab do not carry over from one document type to another. */}
        {active && <IntegrationPosting key={active.key} integration={active} onClose={onClose} />}
      </motion.div>
    </>
  );
}

function IntegrationPosting({ integration, onClose }: { integration: IntegrationDto; onClose: () => void }) {
  const { t } = useTranslation("finance");
  const text = useIntegrationText();
  const canEdit = useCan("finance.integrations.edit");
  const canPost = useCan("finance.integrations.approve");

  const mode = integration.mode ?? "off";
  const [tab, setTab] = React.useState<Tab>("pending");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [checking, setChecking] = React.useState<string[] | null>(null);

  const sync = useSyncIntegrations();
  const updateSetting = useUpdateIntegrationSetting();
  const { data, isLoading } = usePostingQueue({ integrationKey: integration.key, status: tab, page: 1, pageSize: 200 });

  React.useEffect(() => { setSelected(new Set()); }, [tab]);

  const items = data?.items ?? [];
  const postable = tab === "posted" ? [] : items.filter(i => i.status === "pending" || i.status === "failed");
  const allSelected = postable.length > 0 && postable.every(i => selected.has(i.id));
  const selectedTotal = postable.filter(i => selected.has(i.id)).reduce((n, i) => n + i.totalAmount, 0);
  const count = (s: Tab) => integration.queue?.[s] ?? 0;

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <p className="text-sm text-muted-foreground">{text.trigger(integration)} — {text.notes(integration)}</p>

        {mode === "off" && (
          <section className="rounded-xl border border-border p-4 space-y-3">
            <p className="flex gap-2 text-sm font-semibold text-foreground">
              <PowerOff className="w-4 h-4 mt-0.5 text-muted-foreground" />{t("integrations.modulePanel.offTitle")}
            </p>
            <p className="text-sm text-muted-foreground">{t("integrations.modulePanel.offBody")}</p>
            {canEdit ? (
              <Button size="sm" disabled={updateSetting.isPending}
                onClick={() => updateSetting.mutate({ key: integration.key, mode: "review", startDate: integration.startDate })}>
                {t("integrations.modulePanel.switchOnManual")}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t("integrations.modulePanel.askFinance")}</p>
            )}
          </section>
        )}

        {mode === "auto" && (
          <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            <p className="flex gap-2 text-sm text-amber-800 dark:text-amber-400">
              <Zap className="w-4 h-4 shrink-0 mt-0.5" />{t("integrations.modulePanel.autoOn")}
            </p>
          </section>
        )}

        {integration.issues.length > 0 && mode !== "off" && (
          <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
            {integration.issues.map(issue => (
              <p key={issue} className="flex gap-2 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{issue}
              </p>
            ))}
          </section>
        )}

        {mode !== "off" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1.5" role="tablist">
                {TABS.map(s => (
                  <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      tab === s ? "bg-primary text-primary-foreground border-primary"
                                : "border-border text-muted-foreground hover:bg-muted/40")}>
                    {t(`integrations.status.${s}`)} ({count(s)})
                  </button>
                ))}
              </div>
              {canPost && (
                <Button size="sm" variant="outline" className="ms-auto" disabled={sync.isPending}
                  onClick={() => sync.mutate(integration.key)}>
                  <RefreshCw className={cn("w-3.5 h-3.5 me-1.5", sync.isPending && "animate-spin")} />
                  {t("integrations.modulePanel.collect")}
                </Button>
              )}
            </div>
            {integration.lastSyncAt && (
              <p className="text-xs text-muted-foreground">
                {t("integrations.drawer.lastCollected", { when: formatDate(integration.lastSyncAt) })}
              </p>
            )}

            <div className="rounded-xl border border-border overflow-hidden">
              {isLoading ? (
                <p className="p-8 text-center text-sm text-muted-foreground">{t("integrations.loading")}</p>
              ) : items.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Inbox className="w-7 h-7 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {tab === "pending" ? t("integrations.modulePanel.emptyPending") : t("integrations.queue.emptyOther")}
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                      {canPost && tab !== "posted" && (
                        <th className="w-10 px-3 py-2.5">
                          <input type="checkbox" className="accent-primary" checked={allSelected}
                            aria-label={t("integrations.queue.selectAll")}
                            onChange={() => setSelected(allSelected ? new Set() : new Set(postable.map(i => i.id)))} />
                        </th>
                      )}
                      <th className="px-3 py-2.5 text-start font-medium">{t("integrations.queue.col.date")}</th>
                      <th className="px-3 py-2.5 text-start font-medium">{t("integrations.queue.col.document")}</th>
                      <th className="px-3 py-2.5 text-end font-medium">{t("integrations.queue.col.amount")}</th>
                      <th className="px-3 py-2.5 text-start font-medium">
                        {tab === "posted" ? t("integrations.queue.col.journal") : t("integrations.queue.col.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        {canPost && tab !== "posted" && (
                          <td className="px-3 py-2.5">
                            <input type="checkbox" className="accent-primary" checked={selected.has(item.id)}
                              aria-label={t("integrations.queue.selectRow", { number: item.sourceNumber })}
                              onChange={() => toggle(item.id)} />
                          </td>
                        )}
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(item.sourceDate)}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-foreground">{item.sourceNumber}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[240px]">{item.description}</p>
                        </td>
                        <td className="px-3 py-2.5 text-end tabular-nums whitespace-nowrap">
                          {formatCurrency(item.totalAmount, item.currencyCode as never)}
                        </td>
                        <td className="px-3 py-2.5">
                          {tab === "posted" ? (
                            <span className="text-muted-foreground whitespace-nowrap">{item.journalEntryNumber ?? "—"}</span>
                          ) : (
                            <>
                              <StatusBadge status={item.status} />
                              {item.lastError && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-[220px] line-clamp-2">{item.lastError}</p>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {(data?.totalCount ?? 0) > items.length && (
              <p className="text-xs text-muted-foreground">
                {t("integrations.modulePanel.more", { shown: items.length, total: data?.totalCount ?? 0 })}
              </p>
            )}
          </>
        )}
      </div>

      <div className="border-t border-border px-6 py-4 shrink-0 flex flex-wrap items-center gap-3">
        <Link to="/finance/integrations" onClick={onClose} className="text-sm font-medium text-primary hover:underline">
          {t("integrations.modulePanel.openCenter")}
        </Link>
        {mode !== "off" && tab !== "posted" && (
          <div className="ms-auto flex items-center gap-3">
            {selected.size > 0 && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {t("integrations.modulePanel.selected", {
                  count: selected.size,
                  amount: formatCurrency(selectedTotal, (items[0]?.currencyCode ?? "USD") as never),
                })}
              </span>
            )}
            {/* Checking needs only "view"; the check dialog itself withholds Post without "approve". */}
            <Button size="sm" disabled={selected.size === 0 && postable.length === 0}
              onClick={() => setChecking(selected.size > 0 ? [...selected] : postable.map(i => i.id))}>
              <ClipboardCheck className="w-3.5 h-3.5 me-1.5" />
              {selected.size > 0
                ? t("integrations.modulePanel.checkSelected", { count: selected.size })
                : t("integrations.modulePanel.checkAll", { count: postable.length })}
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {checking && (
          <PostingCheckDialog ids={checking} onClose={() => setChecking(null)} onPosted={() => setSelected(new Set())} />
        )}
      </AnimatePresence>
    </>
  );
}
