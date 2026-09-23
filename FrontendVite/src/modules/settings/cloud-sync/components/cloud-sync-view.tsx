import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  CloudUpload, CheckCircle2, AlertTriangle, Clock, RefreshCw, Play, Database, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import { SYNC_TIME_ZONES, type CloudSyncRun, type CloudSyncSettings } from "@/lib/sync/cloud-sync.api";
import {
  useCloudSyncRuns, useCloudSyncSettings, useReseedCloudSync, useRunCloudSyncNow, useUpdateCloudSync,
} from "@/hooks/sync/use-cloud-sync";

/**
 * Settings → Cloud Sync, on an ON-PREMISES installation.
 *
 * The shop's own server is the system of record; this screen is about the read-only copy kept in the
 * cloud. Its job is to answer three questions without anyone opening a terminal: is it working, when
 * did it stop, and can I make it run now.
 */
export function CloudSyncView() {
  const { t } = useTranslation("settings");
  const { data, isLoading, isError, error, refetch } = useCloudSyncSettings();
  const { data: runs } = useCloudSyncRuns(20);
  const save   = useUpdateCloudSync();
  const run    = useRunCloudSyncNow();
  const reseed = useReseedCloudSync();
  const canEdit = useCan("settings.integrations.edit");

  const [form, setForm] = React.useState<CloudSyncSettings | null>(null);
  const [confirmReseed, setConfirmReseed] = React.useState(false);

  // Take the server's values as the starting point, and re-sync whenever it reports something new
  // that the user is not in the middle of editing.
  React.useEffect(() => { if (data && !save.isPending) setForm(data); }, [data, save.isPending]);

  if (isLoading) return <Shell><p className="text-sm text-muted-foreground">{t("cloudSync.loading")}</p></Shell>;

  if (isError)
    return (
      <Shell>
        <Panel tone="danger">
          <p className="text-sm font-medium text-foreground">{t("cloudSync.loadFailed")}</p>
          <p className="text-xs text-muted-foreground mt-1">{(error as Error)?.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>{t("cloudSync.tryAgain")}</Button>
        </Panel>
      </Shell>
    );

  if (!data || !form) return null;

  // No licence means this is not an on-premises installation. Saying so plainly beats showing a
  // form that would save happily and then never push anything.
  if (!data.licenceConfigured && !data.enabled)
    return (
      <Shell>
        <Panel>
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{t("cloudSync.notApplicable")}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {t("cloudSync.notApplicableHint")}
              </p>
            </div>
          </div>
        </Panel>
      </Shell>
    );

  const healthy   = data.consecutiveFailures === 0 && !!data.lastSuccessAt;
  const neverRan  = !data.lastAttemptAt;
  const dirty     = JSON.stringify(form) !== JSON.stringify(data);

  return (
    <Shell>
      {/* ── Status ─────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Panel tone={data.consecutiveFailures > 0 ? "danger" : healthy ? "success" : "default"}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              {data.consecutiveFailures > 0
                ? <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                : healthy
                  ? <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  : <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {data.consecutiveFailures > 0
                    ? t("cloudSync.statusFailing", { count: data.consecutiveFailures })
                    : healthy   ? t("cloudSync.statusWorking")
                    : neverRan  ? t("cloudSync.statusNever")
                                : t("cloudSync.statusPending")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.lastSuccessAt
                    ? t("cloudSync.lastSuccess", { when: formatDate(data.lastSuccessAt) })
                    : t("cloudSync.noSuccess")}
                  {" · "}
                  {data.enabled
                    ? t("cloudSync.nextScheduled", { time: form.runAtLocalTime, zone: form.timeZoneId })
                    : t("cloudSync.schedulingOff")}
                </p>

                {/* Trading is never affected — say that first, or "sync failed" reads as "the shop is broken". */}
                {data.consecutiveFailures > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {t("cloudSync.tradingUnaffected")}
                  </p>
                )}
                {data.lastError && (
                  <p className="mt-2 text-[11px] font-mono bg-destructive/5 text-destructive rounded-md px-2 py-1.5 break-all">
                    {data.lastError}
                  </p>
                )}
              </div>
            </div>

            <Can permission="settings.integrations.edit">
              <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
                {run.isPending
                  ? <><RefreshCw className="h-3.5 w-3.5 me-1.5 animate-spin" />{t("cloudSync.running")}</>
                  : <><Play className="h-3.5 w-3.5 me-1.5" />{t("cloudSync.syncNow")}</>}
              </Button>
            </Can>
          </div>
        </Panel>
      </motion.div>

      {/* ── Settings ───────────────────────────────────────────────────── */}
      <Panel title={t("cloudSync.schedule")} icon={CloudUpload}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("cloudSync.cloudAddress")} hint={t("cloudSync.cloudAddressHint")}>
            <Input
              value={form.cloudBaseUrl} disabled={!canEdit}
              placeholder="https://erp.vrodux.com"
              onChange={e => setForm({ ...form, cloudBaseUrl: e.target.value })}
            />
          </Field>

          <Field label={t("cloudSync.runAt")} hint={t("cloudSync.runAtHint")}>
            <Input
              type="time" value={form.runAtLocalTime} disabled={!canEdit}
              onChange={e => setForm({ ...form, runAtLocalTime: e.target.value })}
            />
          </Field>

          <Field label={t("cloudSync.timeZone")} hint={t("cloudSync.timeZoneHint")}>
            <select
              value={form.timeZoneId} disabled={!canEdit}
              onChange={e => setForm({ ...form, timeZoneId: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            >
              {[...new Set([form.timeZoneId, ...SYNC_TIME_ZONES])].filter(Boolean).map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </Field>

          <Field label={t("cloudSync.scheduledRuns")} hint={t("cloudSync.scheduledRunsHint")}>
            <label className="flex items-center gap-2.5 h-10">
              <input
                type="checkbox" checked={form.enabled} disabled={!canEdit}
                onChange={e => setForm({ ...form, enabled: e.target.checked })}
                className="accent-primary"
              />
              <span className="text-sm text-foreground">
                {form.enabled ? t("cloudSync.enabled") : t("cloudSync.disabled")}
              </span>
            </label>
          </Field>
        </div>

        <Can permission="settings.integrations.edit">
          <div className="flex items-center gap-2 mt-4">
            <Button
              size="sm"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate({
                enabled:        form.enabled,
                cloudBaseUrl:   form.cloudBaseUrl,
                runAtLocalTime: form.runAtLocalTime,
                timeZoneId:     form.timeZoneId,
              })}
            >
              {save.isPending ? t("cloudSync.saving") : t("cloudSync.save")}
            </Button>
            {dirty && (
              <Button size="sm" variant="ghost" onClick={() => setForm(data)}>{t("cloudSync.discard")}</Button>
            )}
          </div>
        </Can>
      </Panel>

      {/* ── History ────────────────────────────────────────────────────── */}
      <Panel title={t("cloudSync.recentRuns")} icon={Clock}>
        {!runs?.length ? (
          <p className="text-sm text-muted-foreground">{t("cloudSync.noRuns")}</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-start font-medium py-2 px-1">{t("cloudSync.colStarted")}</th>
                  <th className="text-start font-medium py-2 px-1">{t("cloudSync.colTrigger")}</th>
                  <th className="text-start font-medium py-2 px-1">{t("cloudSync.colResult")}</th>
                  <th className="text-end   font-medium py-2 px-1">{t("cloudSync.colRows")}</th>
                  <th className="text-start font-medium py-2 px-1">{t("cloudSync.colDetail")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => <RunRow key={r.id} run={r} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Reseed ─────────────────────────────────────────────────────── */}
      <Can permission="settings.integrations.edit">
        <Panel title={t("cloudSync.reseed")} icon={Database}>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("cloudSync.reseedHint")}
            {data.tables.length > 0 && <> {t("cloudSync.reseedTracking", { count: data.tables.length })}</>}
          </p>

          {!confirmReseed ? (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setConfirmReseed(true)}>
              {t("cloudSync.reseedOpen")}
            </Button>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-foreground">{t("cloudSync.reseedConfirm")}</span>
              <Button size="sm" variant="destructive" disabled={reseed.isPending}
                onClick={() => { reseed.mutate(); setConfirmReseed(false); }}>
                {reseed.isPending ? t("cloudSync.reseedClearing") : t("cloudSync.reseedYes")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReseed(false)}>{t("cloudSync.cancel")}</Button>
            </div>
          )}
        </Panel>
      </Can>
    </Shell>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function RunRow({ run }: { run: CloudSyncRun }) {
  const { t } = useTranslation("settings");
  const state = !run.finishedAt ? "running" : !run.ran ? "skipped" : run.succeeded ? "ok" : "failed";
  const label = {
    running: t("cloudSync.runInProgress"), skipped: t("cloudSync.runSkipped"),
    ok:      t("cloudSync.runSucceeded"),  failed:  t("cloudSync.runFailed"),
  }[state];
  const tone  = {
    running: "text-muted-foreground bg-muted",
    skipped: "text-muted-foreground bg-muted",
    ok:      "text-success bg-success/10",
    failed:  "text-destructive bg-destructive/10",
  }[state];

  return (
    <tr className="border-t border-border/60">
      <td className="py-2 px-1 whitespace-nowrap">{formatDate(run.startedAt)}</td>
      <td className="py-2 px-1 text-muted-foreground capitalize">{run.trigger}</td>
      <td className="py-2 px-1">
        <span className={cn("inline-block px-2 py-0.5 rounded-md text-[11px] font-medium", tone)}>{label}</span>
      </td>
      <td className="py-2 px-1 text-end tabular-nums">{run.rowsSent.toLocaleString()}</td>
      <td className="py-2 px-1 text-xs text-muted-foreground max-w-[420px] truncate" title={run.message ?? ""}>
        {run.message ?? (state === "ok" ? t("cloudSync.tableCount", { count: run.tablesProcessed }) : "—")}
      </td>
    </tr>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("settings");
  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("cloudSync.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("cloudSync.subtitle")}
        </p>
      </div>
      {children}
    </div>
  );
}

function Panel({
  children, title, icon: Icon, tone = "default",
}: {
  children: React.ReactNode;
  title?: string;
  icon?: React.ElementType;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <section className={cn(
      "rounded-xl border p-4",
      tone === "danger"  ? "border-destructive/30 bg-destructive/5"
      : tone === "success" ? "border-success/30 bg-success/5"
      : "border-border bg-card",
    )}>
      {title && (
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}{title}
        </h2>
      )}
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
