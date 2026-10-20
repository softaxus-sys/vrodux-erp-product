import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, Mail, Pause, Play, Plus, RefreshCw, Send, Settings2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import type { MailboxDto } from "@/lib/leadgen/leadgen.api";
import {
  useConnectImap, useDisconnectMailbox, useMailboxProviders, useMailboxes, usePauseMailbox, useResumeMailbox,
  useStartMailboxOAuth, useSyncMailbox, useTestMailbox, useUpdateMailbox,
} from "@/hooks/leadgen/use-leadgen";
import { Banner, ConfirmDialog, EmptyState, ErrorBlock, Field, LeadGenFrame, LoadingBlock, Modal, NoAccess, SELECT, StatusPill, TEXTAREA, formatDateTime, useCanAny } from "../shared/ui";

/** Common providers, so nobody has to know their own server names. Anything else is "Other". */
const PRESETS: { key: string; label: string; smtpHost: string; smtpPort: number; imapHost: string; imapPort: number; note?: string }[] = [
  { key: "zoho", label: "Zoho Mail", smtpHost: "smtp.zoho.com", smtpPort: 465, imapHost: "imap.zoho.com", imapPort: 993, note: "zoho" },
  { key: "zoho-eu", label: "Zoho Mail (EU)", smtpHost: "smtp.zoho.eu", smtpPort: 465, imapHost: "imap.zoho.eu", imapPort: 993, note: "zoho" },
  { key: "zoho-in", label: "Zoho Mail (India)", smtpHost: "smtp.zoho.in", smtpPort: 465, imapHost: "imap.zoho.in", imapPort: 993, note: "zoho" },
  { key: "yahoo", label: "Yahoo Mail", smtpHost: "smtp.mail.yahoo.com", smtpPort: 465, imapHost: "imap.mail.yahoo.com", imapPort: 993, note: "app" },
  { key: "icloud", label: "iCloud Mail", smtpHost: "smtp.mail.me.com", smtpPort: 587, imapHost: "imap.mail.me.com", imapPort: 993, note: "app" },
  { key: "fastmail", label: "Fastmail", smtpHost: "smtp.fastmail.com", smtpPort: 465, imapHost: "imap.fastmail.com", imapPort: 993, note: "app" },
  { key: "other", label: "Other (cPanel, your own server…)", smtpHost: "", smtpPort: 465, imapHost: "", imapPort: 993 },
];

export function MailboxesView() {
  const { t } = useTranslation("leadgen");
  const canView = useCanAny(["leadgen.mailboxes.view"]);
  const [params, setParams] = useSearchParams();
  const list = useMailboxes(canView);
  const providers = useMailboxProviders(canView);
  const pause = usePauseMailbox();
  const resume = useResumeMailbox();
  const sync = useSyncMailbox();

  const [connecting, setConnecting] = React.useState(false);
  const [editing, setEditing] = React.useState<MailboxDto | null>(null);
  const [testing, setTesting] = React.useState<MailboxDto | null>(null);
  const [disconnecting, setDisconnecting] = React.useState<MailboxDto | null>(null);
  const disconnect = useDisconnectMailbox();

  // The return trip from Google / Microsoft lands here with the outcome in the address.
  React.useEffect(() => {
    const outcome = params.get("mailbox");
    if (!outcome) return;
    if (outcome === "connected") toast.success(t("toast.mailboxConnected"));
    else toast.error(params.get("message") ?? t("mailboxes.connectFailed"));
    const p = new URLSearchParams(params); p.delete("mailbox"); p.delete("message"); setParams(p, { replace: true });
  }, [params, setParams, t]);

  if (!canView) return <LeadGenFrame title={t("mailboxes.title")}><NoAccess permission="leadgen.mailboxes.view" /></LeadGenFrame>;
  const rows = list.data ?? [];

  return (
    <LeadGenFrame title={t("mailboxes.title")} description={t("mailboxes.description")}
      actions={<Can permission="leadgen.mailboxes.create"><Button className="gap-2" onClick={() => setConnecting(true)}><Plus className="h-4 w-4" />{t("mailboxes.connect")}</Button></Can>}>
      <Banner tone="info">{t("mailboxes.why")}</Banner>

      {list.isLoading ? <LoadingBlock />
        : list.error ? <ErrorBlock error={list.error as Error} onRetry={() => list.refetch()} />
        : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState icon={Mail} title={t("mailboxes.emptyTitle")} body={t("mailboxes.emptyBody")}
              action={<Can permission="leadgen.mailboxes.create"><Button onClick={() => setConnecting(true)}>{t("mailboxes.connect")}</Button></Can>} />
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {rows.map(m => {
              const usedPct = m.todayLimit === 0 ? 0 : Math.min(100, (m.sentToday / m.todayLimit) * 100);
              return (
                <article key={m.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{m.address}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t(`mailboxes.provider.${m.provider}`)}{m.displayName ? ` · ${m.displayName}` : ""}</p>
                    </div>
                    <StatusPill status={m.status} />
                  </div>

                  {(m.status === "error" || m.status === "paused") && (m.lastError || m.statusReason) && (
                    <p className="text-xs rounded-lg bg-amber-50 dark:bg-amber-900/10 text-amber-900 dark:text-amber-200 p-3 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{m.status === "error" ? m.lastError : m.statusReason}</p>
                  )}

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">{t("mailboxes.today")}</span>
                      <span className="font-semibold tabular-nums">{m.sentToday} / {m.todayLimit}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full", usedPct > 90 ? "bg-amber-500" : "bg-primary")} style={{ width: `${usedPct}%` }} /></div>
                    {m.warmupDay > 0 && m.warmupDay <= 28 && <p className="text-[11px] text-muted-foreground mt-1.5">{t("mailboxes.warmup", { day: m.warmupDay, limit: m.todayLimit })}</p>}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-lg font-bold tabular-nums">{m.totalSent}</p><p className="text-[10px] text-muted-foreground">{t("mailboxes.sent")}</p></div>
                    <div><p className="text-lg font-bold tabular-nums">{m.totalReplies}</p><p className="text-[10px] text-muted-foreground">{t("mailboxes.replies")}</p></div>
                    <div><p className={cn("text-lg font-bold tabular-nums", m.bounceRatePercent > 3 && "text-destructive")}>{m.bounceRatePercent}%</p><p className="text-[10px] text-muted-foreground">{t("mailboxes.bounced")}</p></div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t("mailboxes.lastSync", { when: formatDateTime(m.lastSyncAt) })}</p>

                  <Can permission="leadgen.mailboxes.edit">
                    <div className="flex flex-wrap gap-2 pt-1">
                      {m.status === "connected" && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTesting(m)}><Send className="h-3.5 w-3.5" />{t("mailboxes.test")}</Button>}
                      {m.status === "connected" && <Button size="sm" variant="outline" className="gap-1.5" disabled={sync.isPending} onClick={() => sync.mutate(m.id, { onSuccess: r => toast.success(t("toast.synced", { received: r.received, replies: r.replies })) })}><RefreshCw className={cn("h-3.5 w-3.5", sync.isPending && "animate-spin")} />{t("mailboxes.sync")}</Button>}
                      {m.status === "connected" && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => pause.mutate(m.id)}><Pause className="h-3.5 w-3.5" />{t("mailboxes.pause")}</Button>}
                      {m.status === "paused" && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => resume.mutate(m.id)}><Play className="h-3.5 w-3.5" />{t("mailboxes.resume")}</Button>}
                      {m.status === "error" && <Can permission="leadgen.mailboxes.create"><Button size="sm" className="gap-1.5" onClick={() => setConnecting(true)}>{t("mailboxes.reconnect")}</Button></Can>}
                      <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditing(m)}><Settings2 className="h-3.5 w-3.5" />{t("mailboxes.limits")}</Button>
                      <Can permission="leadgen.mailboxes.delete"><Button size="sm" variant="ghost" className="gap-1.5 text-destructive ms-auto" onClick={() => setDisconnecting(m)}><Unplug className="h-3.5 w-3.5" />{t("mailboxes.disconnect")}</Button></Can>
                    </div>
                  </Can>
                </article>
              );
            })}
          </div>
        )}

      <AnimatePresence>
        {connecting && <ConnectModal providers={providers.data} onClose={() => setConnecting(false)} />}
        {editing && <EditModal mailbox={editing} onClose={() => setEditing(null)} />}
        {testing && <TestModal mailbox={testing} onClose={() => setTesting(null)} />}
        {disconnecting && (
          <ConfirmDialog title={t("mailboxes.disconnectTitle", { address: disconnecting.address })} body={t("mailboxes.disconnectBody")} confirmLabel={t("mailboxes.disconnect")} pending={disconnect.isPending}
            onClose={() => setDisconnecting(null)} onConfirm={() => disconnect.mutate(disconnecting.id, { onSuccess: () => setDisconnecting(null) })} />
        )}
      </AnimatePresence>
    </LeadGenFrame>
  );
}

function ConnectModal({ providers, onClose }: { providers?: { google: boolean; microsoft: boolean; imap: boolean }; onClose: () => void }) {
  const { t } = useTranslation("leadgen");
  const oauth = useStartMailboxOAuth();
  const connect = useConnectImap();
  const [tab, setTab] = React.useState<"google" | "microsoft" | "imap">("imap");
  const [preset, setPreset] = React.useState(PRESETS[0].key);
  const p = PRESETS.find(x => x.key === preset) ?? PRESETS[0];
  const [f, setF] = React.useState({ address: "", displayName: "", username: "", password: "", smtpHost: p.smtpHost, smtpPort: p.smtpPort, imapHost: p.imapHost, imapPort: p.imapPort });

  React.useEffect(() => { setF(s => ({ ...s, smtpHost: p.smtpHost, smtpPort: p.smtpPort, imapHost: p.imapHost, imapPort: p.imapPort })); }, [p.key]);  // eslint-disable-line react-hooks/exhaustive-deps

  const go = (provider: "google" | "microsoft") =>
    oauth.mutate({ provider, returnPath: "/lead-generation/mailboxes" }, { onSuccess: r => { window.location.href = r.url; } });

  const tabs = [
    { key: "imap" as const, label: t("mailboxes.tab.imap"), enabled: providers?.imap !== false },
    { key: "google" as const, label: "Google", enabled: !!providers?.google },
    { key: "microsoft" as const, label: "Microsoft", enabled: !!providers?.microsoft },
  ];

  return (
    <Modal onClose={onClose} size="md" title={t("mailboxes.connectTitle")} subtitle={t("mailboxes.connectSubtitle")}
      footer={tab === "imap" ? (
        <>
          <Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
          <Button className="gap-2" disabled={!f.address || !f.password || !f.smtpHost || !f.imapHost || connect.isPending}
            onClick={() => connect.mutate({ address: f.address, displayName: f.displayName || null, username: f.username || f.address, password: f.password, smtpHost: f.smtpHost, smtpPort: f.smtpPort, imapHost: f.imapHost, imapPort: f.imapPort }, { onSuccess: onClose })}>
            {connect.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{connect.isPending ? t("mailboxes.testing") : t("mailboxes.connectAndTest")}
          </Button>
        </>
      ) : <Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>}>
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
        {tabs.map(x => (
          <button key={x.key} onClick={() => setTab(x.key)} className={cn("flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", tab === x.key ? "bg-card shadow-sm" : "text-muted-foreground")}>{x.label}</button>
        ))}
      </div>

      {tab !== "imap" ? (
        providers && !providers[tab] ? <Banner tone="warn">{t("mailboxes.oauthMissing", { provider: tab === "google" ? "Google" : "Microsoft" })}</Banner> : (
          <div className="text-center py-6 space-y-4">
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t(`mailboxes.oauthBody.${tab}`)}</p>
            <Button size="lg" className="gap-2" disabled={oauth.isPending} onClick={() => go(tab)}>
              {oauth.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{t("mailboxes.signInWith", { provider: tab === "google" ? "Google" : "Microsoft" })}
            </Button>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">{t("mailboxes.oauthPermissions")}</p>
          </div>
        )
      ) : (
        <div className="space-y-3">
          <Field label={t("mailboxes.providerLabel")}>
            <select className={SELECT} value={preset} onChange={e => setPreset(e.target.value)}>{PRESETS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
          </Field>
          {p.note === "zoho" && <Banner tone="info">{t("mailboxes.zohoNote")}</Banner>}
          {p.note === "app" && <Banner tone="info">{t("mailboxes.appPasswordNote")}</Banner>}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t("mailboxes.address")}><Input type="email" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} autoFocus placeholder="sales@yourcompany.com" /></Field>
            <Field label={t("mailboxes.displayName")} hint={t("mailboxes.displayNameHint")}><Input value={f.displayName} maxLength={120} onChange={e => setF({ ...f, displayName: e.target.value })} placeholder="Sara, Acme Dental Supplies" /></Field>
            <Field label={t("mailboxes.username")} hint={t("mailboxes.usernameHint")}><Input value={f.username} onChange={e => setF({ ...f, username: e.target.value })} placeholder={f.address} /></Field>
            <Field label={t("mailboxes.password")} hint={t("mailboxes.passwordHint")}><Input type="password" autoComplete="new-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></Field>
          </div>
          {(preset === "other") && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("mailboxes.smtpHost")}><Input value={f.smtpHost} onChange={e => setF({ ...f, smtpHost: e.target.value })} placeholder="smtp.example.com" /></Field>
              <Field label={t("mailboxes.smtpPort")}><Input type="number" value={f.smtpPort} onChange={e => setF({ ...f, smtpPort: Number(e.target.value) })} /></Field>
              <Field label={t("mailboxes.imapHost")}><Input value={f.imapHost} onChange={e => setF({ ...f, imapHost: e.target.value })} placeholder="imap.example.com" /></Field>
              <Field label={t("mailboxes.imapPort")}><Input type="number" value={f.imapPort} onChange={e => setF({ ...f, imapPort: Number(e.target.value) })} /></Field>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">{t("mailboxes.stored")}</p>
        </div>
      )}
    </Modal>
  );
}

function EditModal({ mailbox, onClose }: { mailbox: MailboxDto; onClose: () => void }) {
  const { t } = useTranslation("leadgen");
  const update = useUpdateMailbox();
  const [limit, setLimit] = React.useState(mailbox.dailyLimit);
  const [name, setName] = React.useState(mailbox.displayName ?? "");
  const [sig, setSig] = React.useState(mailbox.signatureText ?? "");
  return (
    <Modal onClose={onClose} size="md" title={t("mailboxes.limitsTitle")} subtitle={mailbox.address}
      footer={<><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
        <Button disabled={update.isPending} className="gap-2" onClick={() => update.mutate({ id: mailbox.id, dailyLimit: limit, displayName: name || null, signatureText: sig || null }, { onSuccess: onClose })}>
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("action.save")}</Button></>}>
      <Field label={t("mailboxes.dailyLimit")} hint={t("mailboxes.dailyLimitHint")}><Input type="number" min={1} max={500} value={limit} onChange={e => setLimit(Math.max(1, Math.min(500, parseInt(e.target.value || "1", 10) || 1)))} /></Field>
      <Field label={t("mailboxes.displayName")} hint={t("mailboxes.displayNameHint")}><Input value={name} maxLength={120} onChange={e => setName(e.target.value)} /></Field>
      <Field label={t("mailboxes.signature")}><textarea className={TEXTAREA} value={sig} maxLength={1000} onChange={e => setSig(e.target.value)} /></Field>
    </Modal>
  );
}

function TestModal({ mailbox, onClose }: { mailbox: MailboxDto; onClose: () => void }) {
  const { t } = useTranslation("leadgen");
  const test = useTestMailbox();
  const [to, setTo] = React.useState("");
  return (
    <Modal onClose={onClose} size="sm" title={t("mailboxes.testTitle")} subtitle={mailbox.address}
      footer={<><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
        <Button disabled={!to.includes("@") || test.isPending} className="gap-2" onClick={() => test.mutate({ id: mailbox.id, to }, { onSuccess: onClose })}>
          {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{t("mailboxes.sendTest")}</Button></>}>
      <Field label={t("mailboxes.testTo")} hint={t("mailboxes.testHint")}><Input type="email" autoFocus value={to} onChange={e => setTo(e.target.value)} placeholder="you@company.com" /></Field>
    </Modal>
  );
}
