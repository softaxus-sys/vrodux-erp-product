import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { RefreshCw, Settings2, ShieldCheck, CircleDashed, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency } from "@/lib/utils";
import { useIntegrationOverview, useSyncIntegrations } from "@/hooks/finance/use-finance-integrations";
import type { IntegrationDto } from "@/lib/finance/integrations.api";
import { PostingQueue } from "@/modules/finance/integrations/components/posting-queue";
import { useIntegrationText } from "@/modules/finance/integrations/components/shared";

/**
 * One screen for every module's documents waiting to reach the ledger.
 *
 * <p>Only the modules the workspace has are listed — the server filters by the licence in the
 * user's token, so a module that is not licensed never appears here, in the tiles or the queue.
 * What each person can do on a document depends on their approval level (prepare, approve,
 * high-value), enforced by the server; this screen only shows what applies.</p>
 */
export function PostingHubView() {
  const { t } = useTranslation("finance");
  const text = useIntegrationText();
  const { data, isLoading, isError, error, refetch } = useIntegrationOverview();
  const sync = useSyncIntegrations();

  const [module, setModule] = React.useState("");
  const [queueKey, setQueueKey] = React.useState("");

  const integrations = React.useMemo(() => data?.integrations ?? [], [data]);
  const queue = integrations.filter(i => i.kind === "queue");
  // Everything the workspace has that still does not reach the ledger from here — including
  // Finance's own bank transactions, which are deliberately not posted (see their note).
  const notPosted = integrations.filter(i => i.kind !== "queue" && i.kind !== "native");

  const modules = React.useMemo(() => {
    const map = new Map<string, IntegrationDto[]>();
    for (const i of queue) map.set(i.module, [...(map.get(i.module) ?? []), i]);
    return [...map.entries()].map(([key, list]) => ({
      key, list,
      waiting: list.reduce((n, i) => n + (i.queue?.pending ?? 0), 0),
      held: list.reduce((n, i) => n + (i.queue?.failed ?? 0), 0),
      modes: new Set(list.map(i => i.mode ?? "off")),
      limited: list.some(i => i.approvalLimit != null),
      second: list.some(i => i.requireSeparateApprover),
      manualOnly: list.some(i => !i.autoAllowed),
    }));
  }, [queue]);

  const totalWaiting = modules.reduce((n, m) => n + m.waiting, 0);
  const totalHeld = modules.reduce((n, m) => n + m.held, 0);
  const anyOn = queue.some(i => i.mode && i.mode !== "off");
  const queueFor = module ? queue.filter(i => i.module === module) : queue;

  const modeLabel = (modes: Set<string>) =>
    modes.size > 1 ? t("integrations.hub.mixed")
      : modes.has("auto") ? t("integrations.hub.modeAuto")
      : modes.has("review") ? t("integrations.hub.modeManual")
      : t("integrations.hub.modeOff");

  const pick = (key: string) => { setModule(prev => (prev === key ? "" : key)); setQueueKey(""); };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("integrations.hub.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("integrations.hub.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can anyOf={["finance.integrations.edit", "finance.integrations.approve"]}>
            <Button variant="ghost" asChild>
              <Link to="/finance/integrations"><Settings2 className="w-4 h-4 me-2" />{t("integrations.hub.settings")}</Link>
            </Button>
          </Can>
          <Can permission="finance.integrations.approve">
            <Button variant="outline" disabled={sync.isPending || !anyOn} onClick={() => sync.mutate(undefined)}
              title={anyOn ? undefined : t("integrations.collectNowDisabled")}>
              <RefreshCw className={cn("w-4 h-4 me-2", sync.isPending && "animate-spin")} />
              {t("integrations.hub.collect")}
            </Button>
          </Can>
        </div>
      </div>

      {isError ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
          <p className="text-sm text-red-600 dark:text-red-400">{(error as Error)?.message}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>{t("integrations.retry")}</Button>
        </div>
      ) : isLoading || !data ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t("integrations.loading")}
        </div>
      ) : (
        <>
          {modules.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              {t("integrations.hub.noModules")}
            </div>
          )}

          {modules.length > 0 && (<>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label={t("integrations.hub.allModules")}>
            <ModuleTile active={module === ""} onClick={() => setModule("")} icon={<Layers className="w-4 h-4" />}
              title={t("integrations.hub.allModules")} waiting={totalWaiting} held={totalHeld} />
            {modules.map(m => (
              <ModuleTile key={m.key} active={module === m.key} onClick={() => pick(m.key)}
                title={t(`integrations.module.${m.key}`, { defaultValue: m.key })}
                waiting={m.waiting} held={m.held}
                chips={[
                  modeLabel(m.modes),
                  ...(m.limited ? [t("integrations.hub.limit", {
                    amount: formatCurrency(Math.min(...m.list.filter(i => i.approvalLimit != null).map(i => i.approvalLimit as number)),
                      data.ledgerCurrency as never),
                  })] : []),
                  ...(m.second ? [t("integrations.hub.secondApprover")] : []),
                  ...(m.manualOnly ? [t("integrations.hub.manualOnly")] : []),
                ]} />
            ))}
          </div>

          <section className="rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="w-4 h-4 text-primary" />{t("integrations.hub.levelsTitle")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t("integrations.hub.levelsHint")}</p>
            <ul className="mt-2 grid gap-1 text-xs text-foreground sm:grid-cols-3">
              <li>{t("integrations.hub.levelPrepare")}</li>
              <li>{t("integrations.hub.levelApprove")}</li>
              <li>{t("integrations.hub.levelHigh")}</li>
            </ul>
          </section>

          <PostingQueue integrations={queueFor} integrationKey={queueKey} onIntegrationKeyChange={setQueueKey}
            failedCount={queueFor.reduce((n, i) => n + (i.queue?.failed ?? 0), 0)} module={module || undefined} />
          </>)}

          {notPosted.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CircleDashed className="w-4 h-4 text-muted-foreground" />{t("integrations.hub.notPostedTitle")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{t("integrations.hub.notPostedHint")}</p>
              </div>
              <ul className="divide-y divide-border">
                {notPosted.map(i => (
                  <li key={i.key} className="py-2.5">
                    <p className="text-sm font-medium text-foreground">
                      {text.name(i)}
                      <span className="ms-2 text-xs font-normal text-muted-foreground">
                        {t(`integrations.module.${i.module}`, { defaultValue: i.module })}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">{text.notes(i)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ModuleTile({ title, waiting, held, chips, active, onClick, icon }: {
  title: string; waiting: number; held: number; chips?: string[]; active: boolean; onClick: () => void; icon?: React.ReactNode;
}) {
  const { t } = useTranslation("finance");
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("rounded-xl border p-4 text-start transition-colors",
        active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/30")}>
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">{icon}{title}</p>
      <div className="mt-3 flex items-end gap-5">
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">{waiting}</p>
          <p className="text-xs text-muted-foreground">{t("integrations.hub.waiting")}</p>
        </div>
        <div>
          <p className={cn("text-2xl font-bold tabular-nums", held > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{held}</p>
          <p className="text-xs text-muted-foreground">{t("integrations.hub.held")}</p>
        </div>
      </div>
      {chips && chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map(c => (
            <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{c}</span>
          ))}
        </div>
      )}
    </button>
  );
}
