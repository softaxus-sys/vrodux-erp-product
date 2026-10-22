import * as React from "react";
import { CheckCircle2, AlertTriangle, Loader2, Trash2, Plus, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { useCan } from "@/components/auth/can";
import {
  useWaAutomations, useWaAutoReplies, useWaConnect, useWaConnection, useWaDeleteRule, useWaDisconnect, useWaSetAppSecret,
  useWaRules, useWaSaveAutomation, useWaSaveRule, useWaTemplates,
} from "@/hooks/whatsapp/use-whatsapp";
import type { WaAutoReplies, WaAutomation } from "@/lib/whatsapp/whatsapp.api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div><h2 className="font-semibold">{title}</h2>{desc && <p className="text-sm text-muted-foreground">{desc}</p>}</div>
      {children}
    </section>
  );
}

export function WhatsAppSettings() {
  const canView = useCan("messaging.settings.view");
  const canEdit = useCan("messaging.settings.edit");
  const conn = useWaConnection(canView);

  if (!canView) return <p className="p-6 text-sm text-muted-foreground">You don't have permission to view WhatsApp setup.</p>;
  if (conn.isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (conn.isError) return <p className="p-6 text-sm text-red-600">{(conn.error as Error).message}</p>;
  const c = conn.data!;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">WhatsApp Setup</h1>
        <p className="text-sm text-muted-foreground">Connect your own WhatsApp Business number, then reply automatically and message contacts from any module.</p>
      </div>
      <ConnectionCard canEdit={canEdit} />
      {c.connected && (
        <>
          <AutoRepliesCard initial={c.autoReplies} canEdit={canEdit} />
          <KeywordRulesCard canEdit={canEdit} />
          <AutomationsCard canEdit={canEdit} />
        </>
      )}
    </div>
  );
}

function ConnectionCard({ canEdit }: { canEdit: boolean }) {
  const { data: c } = useWaConnection();
  const connect = useWaConnect();
  const disconnect = useWaDisconnect();
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({ phoneNumberId: "", wabaId: "", accessToken: "" });
  if (!c) return null;

  const showForm = !c.connected || editing;
  const submit = async () => {
    try { await connect.mutateAsync(form); setEditing(false); setForm({ phoneNumberId: "", wabaId: "", accessToken: "" }); } catch { /* toast */ }
  };

  return (
    <Card title="WhatsApp Business number" desc="Uses Meta's WhatsApp Cloud API. Meta bills your business directly for conversations.">
      {c.connected && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            {c.status === "error" ? <AlertTriangle className="size-5 text-amber-500" /> : <CheckCircle2 className="size-5 text-emerald-600" />}
            <div>
              <p className="font-medium">{c.verifiedName ?? "Connected"} {c.displayPhone && <span className="text-muted-foreground">· {c.displayPhone}</span>}</p>
              {c.lastError && <p className="text-xs text-amber-700">{c.lastError}</p>}
            </div>
          </div>
          {canEdit && !editing && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Update token</Button>
              <Button size="sm" variant="outline" onClick={() => disconnect.mutate(undefined)} disabled={disconnect.isPending}><Unplug /> Disconnect</Button>
            </div>
          )}
        </div>
      )}

      {showForm && canEdit && (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
            <li>In Meta Business Suite → WhatsApp Manager, add and verify your business phone number.</li>
            <li>In your Meta app → WhatsApp → API Setup, copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID</b>.</li>
            <li>Create a System User with the <i>whatsapp_business_messaging</i> and <i>whatsapp_business_management</i> permissions and generate a permanent token.</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Phone number ID" value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value.trim() })} />
            <Input placeholder="WhatsApp Business Account ID" value={form.wabaId} onChange={(e) => setForm({ ...form, wabaId: e.target.value.trim() })} />
          </div>
          <Input type="password" autoComplete="off" placeholder="Permanent access token" value={form.accessToken}
            onChange={(e) => setForm({ ...form, accessToken: e.target.value })} />
          <p className="text-xs text-muted-foreground">The token is checked with Meta and stored encrypted. It is never shown again.</p>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={!form.phoneNumberId || !form.wabaId || !form.accessToken || connect.isPending}>
              {connect.isPending && <Loader2 className="animate-spin" />} {c.connected ? "Save" : "Connect"}
            </Button>
            {editing && <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </div>
      )}

      {c.connected && <WebhookSetup canEdit={canEdit} />}
    </Card>
  );
}

function AutoRepliesCard({ initial, canEdit }: { initial: WaAutoReplies; canEdit: boolean }) {
  const save = useWaAutoReplies();
  const [f, setF] = React.useState<WaAutoReplies>(initial);
  React.useEffect(() => setF(initial), [initial]);
  const set = <K extends keyof WaAutoReplies>(k: K, v: WaAutoReplies[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Card title="Automatic replies" desc="Sent when someone writes to your WhatsApp number. Use {name} for the contact's WhatsApp name.">
      <fieldset disabled={!canEdit} className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={f.welcomeEnabled} onChange={(e) => set("welcomeEnabled", e.target.checked)} /> Welcome message for a first-time contact
        </label>
        {f.welcomeEnabled && (
          <textarea rows={3} className="w-full rounded-md border bg-card p-2 text-sm" value={f.welcomeMessage ?? ""}
            onChange={(e) => set("welcomeMessage", e.target.value)} placeholder="Hi {name}, thanks for contacting us! Our team will reply shortly." />
        )}

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={f.awayEnabled} onChange={(e) => set("awayEnabled", e.target.checked)} /> Away message outside business hours
        </label>
        {f.awayEnabled && (
          <textarea rows={3} className="w-full rounded-md border bg-card p-2 text-sm" value={f.awayMessage ?? ""}
            onChange={(e) => set("awayMessage", e.target.value)} placeholder="We're closed right now. We'll get back to you during business hours." />
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm"><span className="mb-1 block">Opens</span><Input type="time" value={f.opensAt} onChange={(e) => set("opensAt", e.target.value)} /></label>
          <label className="text-sm"><span className="mb-1 block">Closes</span><Input type="time" value={f.closesAt} onChange={(e) => set("closesAt", e.target.value)} /></label>
          <label className="text-sm"><span className="mb-1 block">Time zone</span><Input value={f.timeZoneId} onChange={(e) => set("timeZoneId", e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap gap-1">
          {DAYS.map((d, i) => (
            <button key={d} type="button" onClick={() => set("workDays", f.workDays.includes(i) ? f.workDays.filter((x) => x !== i) : [...f.workDays, i])}
              className={`rounded-md border px-3 py-1 text-sm ${f.workDays.includes(i) ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : ""}`}>{d}</button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.createLeads} onChange={(e) => set("createLeads", e.target.checked)} /> Create a CRM lead when an unknown number writes in
          </label>
          <label className="text-sm"><span className="mb-1 block">Default country code (for numbers starting with 0)</span>
            <Input value={f.defaultCountryCode} onChange={(e) => set("defaultCountryCode", e.target.value.replace(/\D/g, ""))} /></label>
        </div>
        {canEdit && <Button onClick={() => save.mutate(f)} disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} Save</Button>}
      </fieldset>
    </Card>
  );
}

function KeywordRulesCard({ canEdit }: { canEdit: boolean }) {
  const rules = useWaRules();
  const save = useWaSaveRule();
  const del = useWaDeleteRule();
  const [draft, setDraft] = React.useState({ keyword: "", matchType: "contains" as "contains" | "exact", reply: "" });

  return (
    <Card title="Keyword replies" desc="When a message matches a keyword, this reply is sent instead of the welcome or away message. Contacts who send STOP are opted out automatically.">
      <div className="space-y-2">
        {rules.data?.length === 0 && <p className="text-sm text-muted-foreground">No keyword replies yet. Example: “price” → your price list, “location” → your address.</p>}
        {rules.data?.map((r) => (
          <div key={r.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <input type="checkbox" disabled={!canEdit} checked={r.isActive} onChange={(e) => save.mutate({ ...r, isActive: e.target.checked })} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.matchType === "exact" ? "Is exactly" : "Contains"} “{r.keyword}”</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{r.reply}</p>
            </div>
            {canEdit && <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 /></Button>}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="space-y-2 rounded-lg bg-muted/40 p-3">
          <div className="flex gap-2">
            <select value={draft.matchType} onChange={(e) => setDraft({ ...draft, matchType: e.target.value as "contains" | "exact" })} className="h-10 rounded-md border bg-card px-2 text-sm">
              <option value="contains">Contains</option><option value="exact">Is exactly</option>
            </select>
            <Input placeholder="Keyword" value={draft.keyword} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} />
          </div>
          <textarea rows={2} className="w-full rounded-md border bg-card p-2 text-sm" placeholder="Reply" value={draft.reply} onChange={(e) => setDraft({ ...draft, reply: e.target.value })} />
          <Button size="sm" disabled={!draft.keyword.trim() || !draft.reply.trim() || save.isPending}
            onClick={async () => { try { await save.mutateAsync({ ...draft, isActive: true }); setDraft({ keyword: "", matchType: "contains", reply: "" }); } catch { /* toast */ } }}>
            <Plus /> Add rule
          </Button>
        </div>
      )}
    </Card>
  );
}

function AutomationsCard({ canEdit }: { canEdit: boolean }) {
  const list = useWaAutomations();
  return (
    <Card title="Automatic messages from modules" desc="Send an approved template automatically when something happens. Only records created after you switch it on are messaged.">
      {list.data?.map((a) => <AutomationRow key={a.eventKey} a={a} canEdit={canEdit} />)}
    </Card>
  );
}

function AutomationRow({ a, canEdit }: { a: WaAutomation; canEdit: boolean }) {
  const templates = useWaTemplates(true);
  const save = useWaSaveAutomation();
  const [enabled, setEnabled] = React.useState(a.enabled);
  const [key, setKey] = React.useState(a.templateName ? `${a.templateName}|${a.language}` : "");
  const [fields, setFields] = React.useState<string[]>(a.variableFields);
  const tpl = templates.data?.find((t) => `${t.name}|${t.language}` === key);

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" disabled={!canEdit} checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> {a.label}
      </label>
      <p className="text-xs text-muted-foreground">{a.description}</p>
      {enabled && (
        <div className="space-y-2">
          <select disabled={!canEdit} value={key} onChange={(e) => setKey(e.target.value)} className="h-10 w-full rounded-md border bg-card px-2 text-sm">
            <option value="">Choose an approved template</option>
            {templates.data?.map((t) => <option key={t.id} value={`${t.name}|${t.language}`}>{t.name} ({t.language})</option>)}
          </select>
          {tpl && Array.from({ length: tpl.variableCount }, (_, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-12 text-xs text-muted-foreground">{`{{${i + 1}}}`}</span>
              <select disabled={!canEdit} value={fields[i] ?? ""} className="h-9 flex-1 rounded-md border bg-card px-2"
                onChange={(e) => setFields((p) => { const n = [...p]; n[i] = e.target.value; return n; })}>
                <option value="">Choose a field</option>
                {a.availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <Button size="sm" disabled={save.isPending || (enabled && !tpl)}
          onClick={() => save.mutate({ eventKey: a.eventKey, enabled, templateName: tpl?.name ?? null, language: tpl?.language ?? null,
            variableFields: tpl ? fields.slice(0, tpl.variableCount) : [] })}>
          {save.isPending && <Loader2 className="animate-spin" />} Save
        </Button>
      )}
    </div>
  );
}

/**
 * Incoming messages (replies, delivery ticks, auto-replies) for THIS workspace. A workspace on its own
 * Meta app pastes the callback URL + its own verify token into that app, and saves that app's secret
 * here so each delivery can be verified. Without an own secret, deliveries are checked against the
 * shared Vrodux app (when the server has one).
 */
function WebhookSetup({ canEdit }: { canEdit: boolean }) {
  const { data: c } = useWaConnection();
  const save = useWaSetAppSecret();
  const [secret, setSecret] = React.useState("");
  if (!c) return null;

  const valid = /^[a-fA-F0-9]{32}$/.test(secret.trim());
  const submit = async (value: string | null) => {
    try { await save.mutateAsync(value); setSecret(""); } catch { /* toast */ }
  };

  return (
    <div className="space-y-3 rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Incoming messages (replies, delivery ticks, auto-replies)</p>
        {c.incomingReady
          ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Ready</span>
          : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Needs app secret</span>}
      </div>

      <ol className="list-decimal space-y-1 ps-5 text-xs text-muted-foreground">
        <li>In your Meta app open <b>WhatsApp → Configuration → Webhook → Edit</b>.</li>
        <li>Paste the <b>Callback URL</b> and <b>Verify token</b> below, then <b>Verify and save</b>.</li>
        <li>Under <b>Webhook fields</b>, subscribe to <b>messages</b>.</li>
        <li>Copy the <b>App secret</b> from <b>App settings → Basic</b> and save it below.</li>
      </ol>

      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-xs text-muted-foreground">Callback URL</span>
          <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{c.webhookUrl}</code>
          <CopyButton value={c.webhookUrl} label="Copy callback URL" />
        </div>
        {c.verifyToken && (
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs text-muted-foreground">Verify token</span>
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{c.verifyToken}</code>
            <CopyButton value={c.verifyToken} label="Copy verify token" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs">
          App secret:{" "}
          {c.appSecretSet
            ? <b className="text-emerald-700 dark:text-emerald-400">saved (hidden)</b>
            : c.sharedAppAvailable
              ? <span className="text-muted-foreground">not set — using the shared Vrodux app</span>
              : <span className="text-amber-700">not set — incoming messages are refused until it is</span>}
        </p>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Input type="password" autoComplete="off" className="min-w-0 flex-1" placeholder="32-character app secret"
              value={secret} onChange={(e) => setSecret(e.target.value)} />
            <Button size="sm" onClick={() => submit(secret.trim())} disabled={!valid || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} {c.appSecretSet ? "Replace" : "Save"}
            </Button>
            {c.appSecretSet && (
              <Button size="sm" variant="outline" onClick={() => submit(null)} disabled={save.isPending}>Remove</Button>
            )}
          </div>
        )}
        {secret && !valid && <p className="text-xs text-amber-700">The app secret is 32 letters and numbers (0-9, a-f).</p>}
      </div>
    </div>
  );
}
