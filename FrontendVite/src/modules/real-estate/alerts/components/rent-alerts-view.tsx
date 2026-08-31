import * as React from "react";
import {
  AlertTriangle, Bell, CalendarClock, CheckCircle2, Clock, Loader2, Mail, Play, Save, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { RentAlertSettingsDto } from "@/lib/real-estate/re.api";
import {
  useAlertLogs, useAlertSettings, useExpiringContracts, useRentDue,
  useRunAlertSweep, useUpdateAlertSettings,
} from "@/hooks/real-estate/use-re";

// Offered zones. A free-text box invites a typo the server then rejects, and the fallback on an
// unresolvable zone is UTC — which silently shifts every due-date decision.
const TIME_ZONES = [
  "Asia/Dubai", "Asia/Riyadh", "Asia/Qatar", "Asia/Kuwait", "Asia/Karachi",
  "Asia/Kolkata", "Europe/London", "America/New_York", "UTC",
];

const KIND_LABEL: Record<string, string> = {
  rent_due: "Rent due", rent_overdue: "Overdue rent", contract_expiry: "Lease expiry",
};

export function RentAlertsView() {
  const currency = useCurrency();
  const { data: settings, isLoading } = useAlertSettings();
  const save   = useUpdateAlertSettings();
  const sweep  = useRunAlertSweep();
  const canEdit = useCan("real-estate.alerts.edit");

  const { data: due = [] }      = useRentDue(30, true);
  const { data: expiring = [] } = useExpiringContracts(90);
  const { data: logs = [] }     = useAlertLogs(undefined, 30);

  const [form, setForm] = React.useState<Omit<RentAlertSettingsDto, "emailConfigured"> | null>(null);

  // Seed the editable copy once the server's values arrive, and re-seed after a save so the form
  // shows the NORMALISED values ("7,30,1" comes back as "30,7,1") rather than what was typed.
  React.useEffect(() => {
    if (!settings) return;
    const { emailConfigured: _ignored, ...rest } = settings;
    setForm(rest);
  }, [settings]);

  const overdue = due.filter(d => d.status === "overdue");
  const upcoming = due.filter(d => d.status !== "overdue");

  if (isLoading || !form || !settings) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading reminder settings…</div>;
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(f => (f ? { ...f, [key]: value } : f));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Rent &amp; Expiry Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Automatic reminders before rent falls due, chasers when it does not arrive, and notice before a lease ends.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Can permission="real-estate.alerts.edit">
            <Button variant="outline" onClick={() => sweep.mutate(true)} disabled={sweep.isPending}>
              {sweep.isPending ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <Play className="w-4 h-4 me-1.5" />}
              Preview
            </Button>
            <Button onClick={() => sweep.mutate(false)} disabled={sweep.isPending}>
              <Bell className="w-4 h-4 me-1.5" /> Run now
            </Button>
          </Can>
        </div>
      </div>

      {!settings.emailConfigured && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">No mail server is configured on this deployment.</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              The schedule below still works and every notice is still recorded, but nothing is actually
              delivered. Set the <code className="font-mono">Email</code> settings on the server to switch sending on.
            </p>
          </div>
        </div>
      )}

      {!form.enabled && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          Reminders are switched off. Nothing is sent, for any lease.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Settings ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 rounded-xl border border-border p-5 space-y-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.enabled} disabled={!canEdit}
              onChange={e => set("enabled", e.target.checked)} className="w-4 h-4 accent-primary" />
            <div>
              <p className="text-sm font-medium">Send reminders automatically</p>
              <p className="text-xs text-muted-foreground">Checked once a day for every active lease.</p>
            </div>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Remind before rent is due (days)</label>
              <Input value={form.dueReminderDaysBefore} disabled={!canEdit}
                onChange={e => set("dueReminderDaysBefore", e.target.value)}
                placeholder="30,7,1" className="h-9 text-sm mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">
                One notice per step. A payment falling due today is always announced, even if the
                list stops at 1.
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Warn before a lease ends (days)</label>
              <Input value={form.expiryReminderDaysBefore} disabled={!canEdit}
                onChange={e => set("expiryReminderDaysBefore", e.target.value)}
                placeholder="90,60,30" className="h-9 text-sm mt-1" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Chase overdue rent every (days)</label>
              <Input type="number" min={1} max={90} value={form.overdueRepeatDays} disabled={!canEdit}
                onChange={e => set("overdueRepeatDays", parseInt(e.target.value) || 1)}
                className="h-9 text-sm mt-1" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Stop after (chasers)</label>
              <Input type="number" min={0} max={50} value={form.overdueMaxReminders} disabled={!canEdit}
                onChange={e => set("overdueMaxReminders", parseInt(e.target.value) || 0)}
                className="h-9 text-sm mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">
                A cap matters: without one a tenant who never pays is emailed indefinitely.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Time zone</label>
            <select value={form.timeZoneId} disabled={!canEdit}
              onChange={e => set("timeZoneId", e.target.value)}
              className="w-full h-9 text-sm rounded-md border border-input bg-card px-3 mt-1">
              {TIME_ZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Decides which day counts as "today" when working out what is due. Rent due today in
              Dubai is still yesterday in UTC for four hours.
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Copy these addresses on every notice</label>
            <Input value={form.ccEmails ?? ""} disabled={!canEdit}
              onChange={e => set("ccEmails", e.target.value || null)}
              placeholder="accounts@example.com, manager@example.com" className="h-9 text-sm mt-1" />
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={form.ccAllRealEstateUsers} disabled={!canEdit}
                onChange={e => set("ccAllRealEstateUsers", e.target.checked)} className="w-4 h-4 accent-primary" />
              <span className="text-xs">
                Also copy everyone with Real Estate access
                <span className="text-muted-foreground"> — not every workspace user; HR-only and
                self-service accounts are excluded.</span>
              </span>
            </label>
          </div>

          <Can permission="real-estate.alerts.edit">
            <div className="flex justify-end">
              <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <Save className="w-4 h-4 me-1.5" />}
                Save settings
              </Button>
            </div>
          </Can>
        </div>

        {/* ── What is outstanding right now ────────────────────────────── */}
        <div className="space-y-4">
          <StatCard icon={AlertTriangle} tone="destructive" label="Overdue now"
            value={formatCurrency(overdue.reduce((s, d) => s + d.balance, 0), currency)}
            sub={`${overdue.length} payment${overdue.length === 1 ? "" : "s"}`} />
          <StatCard icon={Clock} tone="warning" label="Due in 30 days"
            value={formatCurrency(upcoming.reduce((s, d) => s + d.balance, 0), currency)}
            sub={`${upcoming.length} payment${upcoming.length === 1 ? "" : "s"}`} />
          <StatCard icon={CalendarClock} tone="primary" label="Leases ending in 90 days"
            value={String(expiring.length)}
            sub={expiring.length ? `next ${formatDate(expiring[0].endDate)}` : "none"} />
        </div>
      </div>

      {/* ── Queues ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Rent to collect" empty="Nothing due in the next 30 days.">
          {due.slice(0, 12).map(d => (
            <div key={d.installmentId} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{d.tenantName}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {d.propertyName} · {d.unitNumber} · due {formatDate(d.dueDate)}
                </p>
              </div>
              <div className="text-end shrink-0">
                <p className="text-sm font-semibold">{formatCurrency(d.balance, currency)}</p>
                <p className={cn("text-[11px] font-medium",
                  d.status === "overdue" ? "text-destructive" : "text-muted-foreground")}>
                  {d.status === "overdue" ? `${d.daysOverdue}d late` : `in ${d.daysUntilDue}d`}
                </p>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Leases ending" empty="No leases ending in the next 90 days.">
          {expiring.slice(0, 12).map(e => (
            <div key={e.contractId} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{e.tenantName}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {e.propertyName} · {e.unitNumber} · ends {formatDate(e.endDate)}
                </p>
              </div>
              <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                e.daysToExpiry < 0 ? "bg-destructive/10 text-destructive"
                  : e.daysToExpiry <= 30 ? "bg-warning/10 text-warning"
                  : "bg-muted text-muted-foreground")}>
                {e.daysToExpiry < 0 ? "past end date" : `${e.daysToExpiry}d`}
              </span>
            </div>
          ))}
        </Panel>
      </div>

      {/* ── Sweep output ───────────────────────────────────────────────── */}
      {sweep.data && sweep.data.messages.length > 0 && (
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold mb-2">Last run</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {sweep.data.messages.map((m, i) => <li key={i}>· {m}</li>)}
          </ul>
        </div>
      )}

      <Panel title="Recently sent" empty="No notices sent yet.">
        {logs.map(l => (
          <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
            {l.sent
              ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">
                <span className="font-medium">{KIND_LABEL[l.kind] ?? l.kind}</span>
                <span className="text-muted-foreground"> → {l.toEmail}</span>
              </p>
              {/* The reason is the whole point of showing failures: "not sent" alone is unactionable. */}
              {!l.sent && l.failureReason && (
                <p className="text-[11px] text-destructive truncate">{l.failureReason}</p>
              )}
              {l.ccEmails && <p className="text-[11px] text-muted-foreground truncate">cc {l.ccEmails}</p>}
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(l.createdAt)}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function StatCard({ icon: Icon, tone, label, value, sub }: {
  icon: React.ElementType; tone: "destructive" | "warning" | "primary";
  label: string; value: string; sub: string;
}) {
  const tones = {
    destructive: "text-destructive bg-destructive/10",
    warning: "text-warning bg-warning/10",
    primary: "text-primary bg-primary/10",
  } as const;
  const [text, bg] = tones[tone].split(" ");
  return (
    <div className="rounded-xl border border-border p-4">
      <div className={cn("w-8 h-8 rounded-lg grid place-items-center mb-2", bg)}>
        <Icon className={cn("w-4 h-4", text)} />
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const isEmpty = React.Children.count(children) === 0;
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {isEmpty
        ? <p className="px-4 py-8 text-center text-xs text-muted-foreground">{empty}</p>
        : <div className="divide-y divide-border max-h-[340px] overflow-y-auto">{children}</div>}
    </div>
  );
}
