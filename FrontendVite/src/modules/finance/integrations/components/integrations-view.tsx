import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { RefreshCw, ChevronRight, CheckCircle2, AlertTriangle, CircleDashed, Unplug, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Can } from "@/components/auth/can";
import { useAuthStore } from "@/store/auth.store";
import { useIntegrationOverview, useSyncIntegrations } from "@/hooks/finance/use-finance-integrations";
import type { IntegrationDto } from "@/lib/finance/integrations.api";
import { HealthBadge, useIntegrationText } from "./shared";
import { IntegrationDrawer } from "./integration-drawer";
import { PostingQueue } from "./posting-queue";

type Tab = "connectivity" | "queue";

export function IntegrationsView() {
  const { t } = useTranslation("finance");
  const text = useIntegrationText();
  const { data, isLoading, isError, error, refetch } = useIntegrationOverview();
  const sync = useSyncIntegrations();
  const enabledModules = useAuthStore(s => s.tenant?.enabledModules) as string[] | undefined;

  const [tab, setTab]             = React.useState<Tab>("connectivity");
  const [openKey, setOpenKey]     = React.useState<string | null>(null);
  const [queueKey, setQueueKey]   = React.useState("");

  // Only modules this workspace has. A module it does not own has no documents to connect, and
  // listing it would read as a gap in a product the customer never bought.
  const integrations = React.useMemo(() => {
    const all = data?.integrations ?? [];
    if (!enabledModules || enabledModules.length === 0) return all;
    return all.filter(i => i.module === "finance" || enabledModules.includes(i.module));
  }, [data, enabledModules]);

  const groups = React.useMemo(() => {
    const map = new Map<string, IntegrationDto[]>();
    for (const i of integrations) map.set(i.module, [...(map.get(i.module) ?? []), i]);
    return [...map.entries()];
  }, [integrations]);

  const count = (...h: string[]) => integrations.filter(i => h.includes(i.health)).length;
  const pending = integrations.reduce((n, i) => n + (i.queue?.pending ?? 0), 0);
  const failed  = integrations.reduce((n, i) => n + (i.queue?.failed ?? 0), 0);
  const anyOn   = integrations.some(i => i.kind === "queue" && i.mode && i.mode !== "off");
  const opened  = integrations.find(i => i.key === openKey) ?? null;

  const tiles = [
    { label: t("integrations.tiles.connected"),    value: count("connected"),            icon: CheckCircle2,  tone: "text-emerald-600 dark:text-emerald-400" },
    { label: t("integrations.tiles.attention"),    value: count("attention"),            icon: AlertTriangle, tone: "text-red-600 dark:text-red-400" },
    { label: t("integrations.tiles.partial"),      value: count("partial"),              icon: CircleDashed,  tone: "text-amber-600 dark:text-amber-400" },
    { label: t("integrations.tiles.notConnected"), value: count("off", "not_connected"), icon: Unplug,        tone: "text-muted-foreground" },
    { label: t("integrations.tiles.pending"),      value: pending,                       icon: Clock,         tone: "text-amber-600 dark:text-amber-400" },
    { label: t("integrations.tiles.failed"),       value: failed,                        icon: XCircle,       tone: failed > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("integrations.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("integrations.subtitle")}</p>
        </div>
        <Can permission="finance.integrations.approve">
          <Button variant="outline" disabled={sync.isPending || !anyOn} onClick={() => sync.mutate(undefined)}
            title={anyOn ? undefined : t("integrations.collectNowDisabled")}>
            <RefreshCw className={cn("w-4 h-4 me-2", sync.isPending && "animate-spin")} />
            {t("integrations.collectNow")}
          </Button>
        </Can>
      </div>

      {isError ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">{t("integrations.loadFailed")}</p>
          <p className="text-sm text-red-600 dark:text-red-400">{(error as Error)?.message}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>{t("integrations.retry")}</Button>
        </div>
      ) : isLoading || !data ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t("integrations.loading")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {tiles.map(tile => (
              <div key={tile.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <tile.icon className={cn("w-4 h-4", tile.tone)} />{tile.label}
                </div>
                <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">{tile.value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-1 border-b border-border" role="tablist">
            {(["connectivity", "queue"] as Tab[]).map(k => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t(`integrations.tabs.${k}`)}
                {k === "queue" && pending + failed > 0 && (
                  <span className={cn("ms-2 rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                    failed > 0 ? "bg-red-500/10 text-red-700 dark:text-red-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400")}>
                    {pending + failed}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "connectivity" && (
            <div className="space-y-6">
              {groups.map(([module, rows]) => (
                <section key={module} className="space-y-2">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{text.module(module)}</h2>
                  <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                    {rows.map(i => (
                      <button key={i.key} onClick={() => setOpenKey(i.key)}
                        className="w-full text-start px-4 py-3.5 hover:bg-muted/20 transition-colors flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-sm font-semibold text-foreground">{text.name(i)}</p>
                            <span className="text-xs text-muted-foreground">{t(`integrations.kind.${i.kind}`)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{text.trigger(i)}</p>
                          {i.issues.length > 0 && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2">{i.issues[0]}</p>
                          )}
                        </div>
                        <Coverage integration={i} />
                        <HealthBadge health={i.health} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 rtl:rotate-180" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tab === "queue" && (
            <PostingQueue integrations={integrations} integrationKey={queueKey}
              onIntegrationKeyChange={setQueueKey} failedCount={failed} />
          )}
        </>
      )}

      <AnimatePresence>
        {opened && (
          <IntegrationDrawer key={opened.key} integration={opened} onClose={() => setOpenKey(null)}
            onOpenQueue={key => { setQueueKey(key); setTab("queue"); setOpenKey(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/** How much of the owning module's activity is tied to the ledger. Hidden on narrow screens. */
function Coverage({ integration: i }: { integration: IntegrationDto }) {
  const { t } = useTranslation("finance");

  if (i.sourceError) {
    return <p className="hidden md:block text-xs text-red-600 dark:text-red-400 w-44 text-end">{t("integrations.coverage.unreadable")}</p>;
  }
  if (i.sourceDocuments === null) return <span className="hidden md:block w-44" />;

  let line: string;
  if (i.kind === "queue") {
    line = i.mode === "off" || !i.mode
      ? t("integrations.coverage.waiting", { count: i.sourceDocuments })
      : t("integrations.coverage.queue", { posted: i.queue?.posted ?? 0, total: i.sourceDocuments });
  } else if (i.kind === "none") {
    line = t("integrations.coverage.unposted", { count: i.sourceDocuments });
  } else {
    line = t("integrations.coverage.linked", { linked: i.linkedDocuments ?? 0, total: i.sourceDocuments });
  }

  return <p className="hidden md:block text-xs text-muted-foreground w-44 text-end tabular-nums">{line}</p>;
}
