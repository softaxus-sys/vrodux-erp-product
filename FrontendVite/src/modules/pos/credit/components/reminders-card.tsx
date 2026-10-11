import * as React from "react";
import { Mail, Loader2, Eye, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useCreditReminderLog, useCreditReminderSettings, useRunCreditReminders, useSaveCreditReminderSettings } from "@/hooks/pos/use-credit";
import type { CreditReminderRunDto, CreditReminderSettingsDto } from "@/lib/pos/credit.api";

const KIND: Record<string, string> = { due_soon: "Due soon", overdue: "Overdue", manual: "Sent by hand" };

function Num({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground block">
      {label}
      <Input type="number" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="h-9 text-sm text-foreground" aria-label={label} />
      {hint && <span className="block text-[10px]">{hint}</span>}
    </label>
  );
}

/** Switches customer credit reminders on, sets how often they go, and shows what has been sent. */
export function RemindersCard() {
  const { data: saved } = useCreditReminderSettings();
  const { data: log = [] } = useCreditReminderLog();
  const save = useSaveCreditReminderSettings();
  const run = useRunCreditReminders();
  const company = useAuthStore(s => s.tenant?.branding?.companyName ?? s.tenant?.name ?? "");
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState<CreditReminderSettingsDto | null>(null);
  const [result, setResult] = React.useState<CreditReminderRunDto | null>(null);

  React.useEffect(() => {
    if (!saved) return;
    // First visit: start from the shop's own name and the browser's time zone instead of blanks.
    setF({ ...saved, senderName: saved.senderName || company, timeZoneId: saved.timeZoneId || Intl.DateTimeFormat().resolvedOptions().timeZone });
  }, [saved, company]);

  if (!f) return null;
  const set = <K extends keyof CreditReminderSettingsDto>(k: K, v: CreditReminderSettingsDto[K]) => setF({ ...f, [k]: v });
  const dirty = !!saved && JSON.stringify({ ...saved, mailConfigured: 0 }) !== JSON.stringify({ ...f, mailConfigured: 0 });

  return (
    <section className="rounded-xl border border-border bg-card">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center gap-3 px-4 py-3 text-start">
        <Mail className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Customer reminders</p>
          <p className="text-xs text-muted-foreground">
            {saved?.enabled ? `On: emailed ${saved.daysBeforeDue > 0 ? `${saved.daysBeforeDue} days before the due date and ` : ""}when overdue` : "Off: customers are not emailed automatically"}
          </p>
        </div>
        <span className={cn("text-[11px] font-semibold rounded-full px-2 py-0.5", saved?.enabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{saved?.enabled ? "On" : "Off"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {!f.mailConfigured && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs flex gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p>No mail account is set up on the server, so nothing can be sent yet. Ask whoever runs the server to set the Email settings.</p>
            </div>
          )}
          <Can permission="pos.customers.edit" fallback={<p className="text-xs text-muted-foreground">You can see these settings but not change them.</p>}>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={f.enabled} onChange={e => set("enabled", e.target.checked)} className="h-4 w-4 accent-primary" />
              Email customers about credit that is due or overdue
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Num label="Before the due date (days)" value={f.daysBeforeDue} min={0} max={30} onChange={n => set("daysBeforeDue", n)} hint="0 = don't remind early" />
              <Num label="First overdue reminder after (days)" value={f.overdueAfterDays} min={0} max={60} onChange={n => set("overdueAfterDays", n)} />
              <Num label="Then repeat every (days)" value={f.repeatEveryDays} min={1} max={90} onChange={n => set("repeatEveryDays", n)} />
              <Num label="At most (overdue reminders)" value={f.maxOverdueReminders} min={1} max={12} onChange={n => set("maxOverdueReminders", n)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-muted-foreground block">Emails come from (your shop name)
                <Input value={f.senderName} maxLength={100} onChange={e => set("senderName", e.target.value)} className="h-9 text-sm text-foreground" aria-label="Sender name" />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground block">Send me a copy at (optional)
                <Input type="email" value={f.ccEmail ?? ""} onChange={e => set("ccEmail", e.target.value)} className="h-9 text-sm text-foreground" aria-label="Copy address" />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">Customers without an email address are skipped. Each reminder is sent once per due date, and overdue ones follow the schedule above. Runs each morning ({f.timeZoneId}).</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!dirty || save.isPending || !f.senderName.trim()}
                onClick={() => save.mutate({ enabled: f.enabled, daysBeforeDue: f.daysBeforeDue, overdueAfterDays: f.overdueAfterDays, repeatEveryDays: f.repeatEveryDays,
                  maxOverdueReminders: f.maxOverdueReminders, senderName: f.senderName, ccEmail: f.ccEmail || null, timeZoneId: f.timeZoneId })}>
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button size="sm" variant="outline" className="gap-2" disabled={dirty || run.isPending} onClick={() => run.mutate(true, { onSuccess: setResult })}>
                <Eye className="h-4 w-4" />Preview who would be emailed
              </Button>
              <Button size="sm" variant="outline" className="gap-2" disabled={dirty || run.isPending || !f.enabled || !f.mailConfigured}
                onClick={() => run.mutate(false, { onSuccess: setResult })}>
                <Send className="h-4 w-4" />Send now
              </Button>
            </div>
            {dirty && <p className="text-[11px] text-muted-foreground">Save your changes before previewing or sending.</p>}
          </Can>

          {result && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1.5">
              <p className="font-semibold">
                {result.dryRun ? `Would email ${result.recipients.length} customer${result.recipients.length === 1 ? "" : "s"}` : `Sent ${result.dueSoon + result.overdue}${result.failed ? `, ${result.failed} failed` : ""}`}
                {result.noEmail > 0 && <span className="font-normal text-muted-foreground"> · {result.noEmail} have no email address</span>}
              </p>
              {result.recipients.slice(0, 8).map(r => (
                <p key={r.customerId} className="flex justify-between gap-2"><span className="truncate">{r.name} · {r.email}</span><span className="text-muted-foreground shrink-0">{KIND[r.kind]}</span></p>
              ))}
              {result.recipients.length > 8 && <p className="text-muted-foreground">+ {result.recipients.length - 8} more</p>}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recently sent</p>
            {log.length === 0 ? <p className="text-xs text-muted-foreground">Nothing sent yet.</p> : (
              <ul className="divide-y divide-border rounded-lg border border-border text-xs max-h-56 overflow-y-auto">
                {log.slice(0, 20).map(l => (
                  <li key={l.id} className="px-3 py-2 flex items-center gap-2">
                    <span className="flex-1 min-w-0 truncate">{l.customerName} <span className="text-muted-foreground">· {KIND[l.kind] ?? l.kind}</span></span>
                    <span className={cn("font-medium", l.status === "sent" ? "text-success" : l.status === "failed" ? "text-destructive" : "text-muted-foreground")} title={l.error ?? undefined}>{l.status}</span>
                    <span className="text-muted-foreground w-24 text-end">{formatDate(l.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
