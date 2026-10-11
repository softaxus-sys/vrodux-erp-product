import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Eye, Loader2, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  useReminderLog, useReminderSettings, useRunReminders, useUpdateReminderSettings,
} from "@/hooks/library/use-library";
import { statusMeta, type ReminderRunDto } from "@/lib/library/library.api";
import { ConfirmDialog, Field, Pill, SELECT, TH, num } from "../../shared/ui";

const FALLBACK_ZONES = ["Asia/Dubai", "Asia/Riyadh", "Asia/Karachi", "Asia/Kolkata", "Europe/London", "UTC"];
const KIND_TONE: Record<string, { color: string; bg: string }> = {
  due_soon: { color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
  overdue:  { color: "text-destructive", bg: "bg-destructive/10" },
  ready:    { color: "text-success", bg: "bg-success/10" },
};

function timeZones(current: string): string[] {
  let zones: string[] = [];
  try { zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []; }
  catch { /* older browser — the short list below is enough */ }
  if (zones.length === 0) zones = FALLBACK_ZONES;
  return zones.includes(current) ? zones : [current, ...zones];
}

/** Email notices to members: due soon, overdue, and reserved copy ready. */
export function RemindersCard({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation("library");
  const { data: settings, isLoading } = useReminderSettings();
  const { data: log = [] } = useReminderLog();
  const save = useUpdateReminderSettings();
  const run = useRunReminders();

  const [f, setF] = React.useState({
    enabled: false, libraryName: "", dueSoonDays: "2", overdueEveryDays: "7", overdueMaxReminders: "3",
    notifyReady: true, timeZoneId: "Asia/Dubai",
  });
  const [preview, setPreview] = React.useState<ReminderRunDto | null>(null);
  const [confirmSend, setConfirmSend] = React.useState(false);
  const [showAllLog, setShowAllLog] = React.useState(false);

  // The form follows the server's copy whenever that changes (first load, or after a save).
  React.useEffect(() => {
    if (!settings) return;
    setF({
      enabled: settings.enabled, libraryName: settings.libraryName ?? "",
      dueSoonDays: String(settings.dueSoonDays), overdueEveryDays: String(settings.overdueEveryDays),
      overdueMaxReminders: String(settings.overdueMaxReminders), notifyReady: settings.notifyReady,
      timeZoneId: settings.timeZoneId,
    });
  }, [settings]);

  if (isLoading || !settings) return null;

  const dirty =
    f.enabled !== settings.enabled || f.libraryName !== (settings.libraryName ?? "")
    || num(f.dueSoonDays) !== settings.dueSoonDays || num(f.overdueEveryDays) !== settings.overdueEveryDays
    || num(f.overdueMaxReminders) !== settings.overdueMaxReminders || f.notifyReady !== settings.notifyReady
    || f.timeZoneId !== settings.timeZoneId;

  const submit = () => save.mutate({
    enabled: f.enabled, libraryName: f.libraryName.trim() || null,
    dueSoonDays: Math.floor(num(f.dueSoonDays)), overdueEveryDays: Math.floor(num(f.overdueEveryDays)),
    overdueMaxReminders: Math.floor(num(f.overdueMaxReminders)), notifyReady: f.notifyReady, timeZoneId: f.timeZoneId,
  });

  const doPreview = () => run.mutate(true, { onSuccess: setPreview });
  const doSend = () => run.mutate(false, {
    onSuccess: r => {
      setPreview(null);
      const sent = r.dueSoon + r.overdue + r.ready;
      if (sent === 0 && r.failed === 0) toast.info(t("reminders.nothingToSend"));
      else if (r.failed > 0) toast.warning(t("reminders.sentWithFailures", { sent, failed: r.failed }));
      else toast.success(t("reminders.sent", { count: sent }));
    },
    onSettled: () => setConfirmSend(false),
  });

  const shownLog = showAllLog ? log : log.slice(0, 8);
  const number = (key: "dueSoonDays" | "overdueEveryDays" | "overdueMaxReminders", hint: string) => (
    <Field label={t(`reminders.${key}`)} hint={hint}>
      <Input type="number" min={0} value={f[key]} disabled={!canEdit} className="h-9 text-sm"
        onChange={e => setF(prev => ({ ...prev, [key]: e.target.value }))} />
    </Field>
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-bold">{t("reminders.heading")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("reminders.description")}</p>
          </div>
          <Pill meta={settings.enabled ? { color: "text-success", bg: "bg-success/10" } : { color: "text-muted-foreground", bg: "bg-muted" }}>
            {settings.enabled ? t("reminders.on") : t("reminders.off")}
          </Pill>
        </div>

        <div className="p-4 space-y-4">
          {!settings.emailConfigured && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm px-3 py-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{t("reminders.noEmailServer")}
            </p>
          )}

          <label className={cn("flex items-start gap-2 text-sm", canEdit && "cursor-pointer")}>
            <input type="checkbox" className="mt-0.5" checked={f.enabled} disabled={!canEdit}
              onChange={e => setF(prev => ({ ...prev, enabled: e.target.checked }))} />
            <span>
              <span className="font-medium">{t("reminders.enable")}</span>
              <span className="block text-xs text-muted-foreground">{t("reminders.enableHint")}</span>
            </span>
          </label>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {number("dueSoonDays", t("reminders.dueSoonHint"))}
            {number("overdueEveryDays", t("reminders.overdueEveryHint"))}
            {number("overdueMaxReminders", t("reminders.overdueMaxHint"))}
            <Field label={t("reminders.libraryName")} hint={t("reminders.libraryNameHint")}>
              <Input value={f.libraryName} disabled={!canEdit} className="h-9 text-sm"
                onChange={e => setF(prev => ({ ...prev, libraryName: e.target.value }))} />
            </Field>
            <Field label={t("reminders.timeZone")} hint={t("reminders.timeZoneHint")}>
              <select value={f.timeZoneId} disabled={!canEdit} className={SELECT}
                onChange={e => setF(prev => ({ ...prev, timeZoneId: e.target.value }))}>
                {timeZones(f.timeZoneId).map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </Field>
            <label className={cn("flex items-start gap-2 text-sm sm:pt-6", canEdit && "cursor-pointer")}>
              <input type="checkbox" className="mt-0.5" checked={f.notifyReady} disabled={!canEdit}
                onChange={e => setF(prev => ({ ...prev, notifyReady: e.target.checked }))} />
              <span>{t("reminders.notifyReady")}</span>
            </label>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={submit} disabled={!dirty || save.isPending}>
                {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("action.save")}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={doPreview} disabled={run.isPending}>
                {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}{t("reminders.preview")}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConfirmSend(true)}
                disabled={run.isPending || !settings.emailConfigured}>
                <Send className="h-3.5 w-3.5" />{t("reminders.sendNow")}
              </Button>
              {settings.lastDailyRunOn && (
                <span className="text-xs text-muted-foreground ms-auto">{t("reminders.lastRun", { date: formatDate(settings.lastDailyRunOn) })}</span>
              )}
            </div>
          )}

          {preview && (
            <div className="rounded-lg border border-border">
              <p className="px-3 py-2 text-sm font-semibold border-b border-border">
                {t("reminders.previewHeading", { count: preview.emails.length })}
                {preview.noEmail > 0 && <span className="font-normal text-muted-foreground"> · {t("reminders.noAddress", { count: preview.noEmail })}</span>}
              </p>
              {preview.emails.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">{t("reminders.nothingToSend")}</p>
              ) : (
                <ul className="divide-y divide-border max-h-64 overflow-y-auto">
                  {preview.emails.map((e, i) => (
                    <li key={i} className="px-3 py-2 text-sm flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{e.memberName} <span className="font-normal text-muted-foreground">· {e.toEmail}</span></p>
                        <p className="text-[11px] text-muted-foreground truncate">{e.titles.join(", ")}</p>
                      </div>
                      <Pill meta={KIND_TONE[e.kind] ?? statusMeta("")}>{t(`reminders.kind.${e.kind}`, { defaultValue: e.kind })}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {log.length > 0 && (
          <div className="border-t border-border overflow-x-auto">
            <p className="px-4 pt-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("reminders.logHeading")}</p>
            <table className="w-full text-sm mt-2">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className={TH}>{t("reminders.col.when")}</th>
                  <th className={TH}>{t("col.member")}</th>
                  <th className={TH}>{t("field.title")}</th>
                  <th className={TH}>{t("reminders.col.notice")}</th>
                  <th className={TH}>{t("field.status")}</th>
                </tr>
              </thead>
              <tbody>
                {shownLog.map(l => (
                  <tr key={l.id} className="border-t border-border align-top">
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{formatDate(l.createdAt)}</td>
                    <td className="px-4 py-2">
                      <p>{l.memberName}</p>
                      <p className="text-[11px] text-muted-foreground">{l.toEmail}</p>
                    </td>
                    <td className="px-4 py-2">{l.title}</td>
                    <td className="px-4 py-2"><Pill meta={KIND_TONE[l.kind] ?? statusMeta("")}>{t(`reminders.kind.${l.kind}`, { defaultValue: l.kind })}</Pill></td>
                    <td className="px-4 py-2">
                      <Pill meta={statusMeta(l.status === "sent" ? "paid" : l.status === "failed" ? "unpaid" : "waiting")}>
                        {t(`reminders.status.${l.status}`, { defaultValue: l.status })}
                      </Pill>
                      {l.error && <p className="text-[11px] text-destructive mt-1">{l.error}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {log.length > 8 && (
              <button onClick={() => setShowAllLog(v => !v)} className="w-full py-2 text-xs font-medium text-primary hover:underline border-t border-border">
                {showAllLog ? t("reminders.showLess") : t("reminders.showAll", { count: log.length })}
              </button>
            )}
          </div>
        )}
      </CardContent>

      <AnimatePresence>
        {confirmSend && (
          <ConfirmDialog title={t("reminders.sendTitle")} body={t("reminders.sendBody")} confirmLabel={t("reminders.sendNow")}
            destructive={false} pending={run.isPending} onClose={() => setConfirmSend(false)} onConfirm={doSend} />
        )}
      </AnimatePresence>
    </Card>
  );
}
