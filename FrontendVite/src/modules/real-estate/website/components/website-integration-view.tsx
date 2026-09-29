import * as React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Check, Copy, ExternalLink, Globe, ImageOff, KeyRound, Loader2, Power,
  RefreshCw, Save, ShieldCheck, Sparkles, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import type { QasroIntegrationDto, WebsiteIntegrationDto } from "@/lib/real-estate/re.api";
import {
  useCreateWebsiteIntegration, useRegenerateWebsiteKey, useSetPropertyWebsiteListing,
  useSetWebsiteIntegrationActive, useUpdateWebsiteIntegration, useWebsiteIntegration,
  useWebsitePublished, useWithdrawAllWebsiteListings,
  useConnectQasro, useDisconnectQasro, useQasroIntegration, useQasroPublished,
  useSetPropertyQasroListing, useWithdrawAllQasroListings,
} from "@/hooks/real-estate/use-re";

const API_ROOT = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

type Confirm = "regenerate" | "disable" | "withdraw-all" | null;

export function WebsiteIntegrationView() {
  const { data: integration, isLoading } = useWebsiteIntegration();
  const canEdit = useCan("real-estate.website.edit");
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null);

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading website settings…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Globe className="h-6 w-6" /> Website</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Connect your company website so it shows your published properties. The website uses a private API key that
          only works for your workspace and only from the website address you set here.
        </p>
      </div>

      {integration
        ? <ConnectedPanel integration={integration} canEdit={canEdit} onKey={setRevealedKey} />
        : canEdit
          ? <ConnectForm onKey={setRevealedKey} />
          : <p className="rounded-lg border p-6 text-sm text-muted-foreground">No website is connected yet.</p>}

      {integration && <PublishedList />}
      {integration && <IntegrationGuide />}

      <QasroSection />

      {revealedKey && <KeyModal apiKey={revealedKey} onClose={() => setRevealedKey(null)} />}
    </div>
  );
}

// ── Qasro ────────────────────────────────────────────────────────────────────
//
// Deliberately not a form like the website connection above — both products are Softaxis's own,
// so there is no address to type and no key to copy. One click either connects or disconnects.

function QasroSection() {
  const { data: integration, isLoading } = useQasroIntegration();
  const canEdit = useCan("real-estate.website.edit");

  if (isLoading) return null;

  return (
    <div className="space-y-5 border-t pt-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold"><Sparkles className="h-5 w-5" /> Qasro</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Qasro is Softaxis's own property portal. Connect once, then choose which properties to list from
          Properties &amp; Units — no address or key to manage, since it's the same company on both sides.
        </p>
      </div>

      {integration
        ? <QasroConnectedPanel integration={integration} canEdit={canEdit} />
        : <QasroConnectCard canEdit={canEdit} />}

      {integration?.status === "connected" && <QasroPublishedList />}
    </div>
  );
}

function QasroConnectCard({ canEdit }: { canEdit: boolean }) {
  const connect = useConnectQasro();
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3 max-w-2xl">
      <h3 className="font-semibold">Not connected</h3>
      <p className="text-sm text-muted-foreground">
        Connecting takes a second — no forms, nothing to configure. Once connected, a "List on Qasro" checkbox
        appears on your properties, so you choose exactly what gets published.
      </p>
      {canEdit ? (
        <Button disabled={connect.isPending} onClick={() => connect.mutate()}>
          {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {connect.isPending ? "Connecting…" : "Activate Qasro"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Ask a workspace admin to connect Qasro.</p>
      )}
    </div>
  );
}

function QasroConnectedPanel({ integration: q, canEdit }: { integration: QasroIntegrationDto; canEdit: boolean }) {
  const disconnect = useDisconnectQasro();
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);

  const statusMeta: Record<QasroIntegrationDto["status"], { label: string; tone: string }> = {
    connected:    { label: "Connected",    tone: "bg-emerald-500/10 text-emerald-600" },
    connecting:   { label: "Connecting…",  tone: "bg-amber-500/10 text-amber-600" },
    error:        { label: "Connection failed", tone: "bg-destructive/10 text-destructive" },
    disconnected: { label: "Disconnected", tone: "bg-muted text-muted-foreground" },
  };
  const meta = statusMeta[q.status];

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", meta.tone)}>
            <span className={cn("h-2 w-2 rounded-full", q.status === "connected" ? "bg-emerald-500" : "bg-current")} />
            {meta.label}
          </span>
          <span className="text-sm text-muted-foreground">
            {q.publishedPropertyCount} {q.publishedPropertyCount === 1 ? "property" : "properties"} on Qasro
          </span>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmDisconnect(true)}>
            <Power className="h-4 w-4" /> Disconnect
          </Button>
        )}
      </div>

      {q.status === "error" && q.lastError && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {q.lastError}
          {canEdit && <RetryConnect />}
        </div>
      )}

      <a
        href="https://qasro.com" target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        View on Qasro <ExternalLink className="h-3.5 w-3.5" />
      </a>

      <ConfirmDialog
        open={confirmDisconnect}
        title="Disconnect Qasro?"
        body="Every property currently listed on Qasro is taken down immediately. You can connect again at any time — nothing about your properties is deleted."
        confirmLabel="Disconnect"
        busy={disconnect.isPending}
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={async () => {
          try { await disconnect.mutateAsync(); setConfirmDisconnect(false); } catch { /* hook toasts */ }
        }}
      />
    </div>
  );
}

/** Connecting again after a failure reuses the same "Connect" call — it rotates the key and
 * retries the link, rather than needing a separate "retry" endpoint. */
function RetryConnect() {
  const connect = useConnectQasro();
  return (
    <Button variant="outline" size="sm" className="ms-2 h-6 px-2 text-xs" disabled={connect.isPending} onClick={() => connect.mutate()}>
      {connect.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Retry"}
    </Button>
  );
}

function QasroPublishedList() {
  const { data: rows = [], isLoading } = useQasroPublished();
  const setListing = useSetPropertyQasroListing();
  const withdrawAll = useWithdrawAllQasroListings();
  const [confirmAll, setConfirmAll] = React.useState(false);

  return (
    <div className="rounded-lg border bg-card max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 className="font-semibold">On Qasro ({rows.length})</h3>
          <p className="text-xs text-muted-foreground">
            List a property from Properties &amp; Units. Removing it here takes it off Qasro on its next refresh.
          </p>
        </div>
        {rows.length > 0 && (
          <Can permission="real-estate.properties.edit">
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmAll(true)}>
              <Trash2 className="h-4 w-4" /> Remove all
            </Button>
          </Can>
        )}
      </div>

      {isLoading ? (
        <p className="p-6 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          Nothing is listed yet. Open <Link to="/real-estate/properties" className="underline">Properties &amp; Units</Link> and
          check "List on Qasro" on the ones you want published.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-5 py-2">Property</th><th className="px-5 py-2">City</th><th className="px-5 py-2">Photos</th><th className="px-5 py-2">Listed</th><th /></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-5 py-2.5"><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.propertyNumber}</p></td>
                  <td className="px-5 py-2.5">{r.city}</td>
                  <td className="px-5 py-2.5">
                    {r.imageCount > 0 ? r.imageCount : <span className="inline-flex items-center gap-1 text-amber-600"><ImageOff className="h-3.5 w-3.5" /> none</span>}
                  </td>
                  <td className="px-5 py-2.5">{formatDate(r.publishedAt)}</td>
                  <td className="px-5 py-2.5 text-right">
                    <Can permission="real-estate.properties.edit">
                      <Button
                        variant="ghost" size="sm" className="text-destructive"
                        disabled={setListing.isPending}
                        onClick={() => setListing.mutate({ propertyId: r.id, listOnQasro: false })}
                      >
                        <X className="h-4 w-4" /> Remove
                      </Button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmAll}
        title="Remove every property from Qasro?"
        body="All properties are taken off Qasro. They stay in Properties and can be listed again one by one, or in bulk from Properties &amp; Units."
        confirmLabel="Remove all"
        busy={withdrawAll.isPending}
        onCancel={() => setConfirmAll(false)}
        onConfirm={async () => {
          try { await withdrawAll.mutateAsync(); setConfirmAll(false); } catch { /* hook toasts */ }
        }}
      />
    </div>
  );
}

// ── Connect ──────────────────────────────────────────────────────────────────

function ConnectForm({ onKey }: { onKey: (k: string) => void }) {
  const create = useCreateWebsiteIntegration();
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("https://");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await create.mutateAsync({ name: name.trim(), websiteUrl: url.trim() });
      onKey(res.apiKey);
    } catch { /* hook toasts */ }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border bg-card p-5 space-y-4 max-w-2xl">
      <h2 className="font-semibold">Connect your website</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Website name</span>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Leading Properties website" required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Website address</span>
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.example.com" required />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Only this address may use the key. Include https:// — www.example.com and example.com count as different addresses.
      </p>
      <Button type="submit" disabled={create.isPending || !name.trim()}>
        {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Connect and generate API key
      </Button>
    </form>
  );
}

// ── Connected ────────────────────────────────────────────────────────────────

function ConnectedPanel({
  integration: w, canEdit, onKey,
}: { integration: WebsiteIntegrationDto; canEdit: boolean; onKey: (k: string) => void }) {
  const update = useUpdateWebsiteIntegration();
  const regenerate = useRegenerateWebsiteKey();
  const setActive = useSetWebsiteIntegrationActive();
  const [name, setName] = React.useState(w.name);
  const [url, setUrl] = React.useState(w.websiteOrigin);
  const [confirm, setConfirm] = React.useState<Confirm>(null);

  React.useEffect(() => { setName(w.name); setUrl(w.websiteOrigin); }, [w.name, w.websiteOrigin]);
  const dirty = name.trim() !== w.name || url.trim() !== w.websiteOrigin;

  return (
    <div className="rounded-lg border bg-card p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            w.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground",
          )}>
            <span className={cn("h-2 w-2 rounded-full", w.isActive ? "bg-emerald-500" : "bg-muted-foreground")} />
            {w.isActive ? "Connected" : "Turned off"}
          </span>
          <span className="text-sm text-muted-foreground">
            {w.lastUsedAt ? `Last request ${formatDate(w.lastUsedAt)}` : "The website has not called the API yet"}
          </span>
        </div>
        <Can permission="real-estate.website.edit">
          <Button
            variant="outline"
            size="sm"
            disabled={setActive.isPending}
            onClick={() => (w.isActive ? setConfirm("disable") : setActive.mutate(true))}
          >
            <Power className="h-4 w-4" /> {w.isActive ? "Turn off" : "Turn on"}
          </Button>
        </Can>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Website name</span>
          <Input value={name} onChange={e => setName(e.target.value)} disabled={!canEdit} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Allowed website address</span>
          <Input value={url} onChange={e => setUrl(e.target.value)} disabled={!canEdit} />
        </label>
      </div>
      {canEdit && dirty && (
        <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ name: name.trim(), websiteUrl: url.trim() })}>
          <Save className="h-4 w-4" /> Save
        </Button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">API key</p>
          <p className="font-mono text-sm">{w.keyHint}••••••••••••••••</p>
          <p className="text-xs text-muted-foreground">Generated {formatDate(w.keyGeneratedAt)}</p>
        </div>
        <Can permission="real-estate.website.edit">
          <Button variant="outline" size="sm" onClick={() => setConfirm("regenerate")} disabled={regenerate.isPending}>
            <RefreshCw className="h-4 w-4" /> Regenerate key
          </Button>
        </Can>
      </div>

      <ConfirmDialog
        open={confirm === "regenerate"}
        title="Regenerate the API key?"
        body="The current key stops working immediately. The website shows no listings until its settings are updated with the new key."
        confirmLabel="Regenerate"
        busy={regenerate.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          try { const r = await regenerate.mutateAsync(); setConfirm(null); onKey(r.apiKey); } catch { /* hook toasts */ }
        }}
      />
      <ConfirmDialog
        open={confirm === "disable"}
        title="Turn off the website connection?"
        body="The website immediately stops receiving listings and photos. Your settings, key and published properties are kept, so you can turn it back on."
        confirmLabel="Turn off"
        busy={setActive.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          try { await setActive.mutateAsync(false); setConfirm(null); } catch { /* hook toasts */ }
        }}
      />
    </div>
  );
}

// ── Published listings ───────────────────────────────────────────────────────

function PublishedList() {
  const { data: rows = [], isLoading } = useWebsitePublished();
  const setListing = useSetPropertyWebsiteListing();
  const withdrawAll = useWithdrawAllWebsiteListings();
  const [confirmAll, setConfirmAll] = React.useState(false);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-semibold">On the website ({rows.length})</h2>
          <p className="text-xs text-muted-foreground">
            Publish a property from its edit form. Removing it here takes it off the website on the site's next refresh.
          </p>
        </div>
        {rows.length > 0 && (
          <Can permission="real-estate.properties.edit">
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmAll(true)}>
              <Trash2 className="h-4 w-4" /> Remove all
            </Button>
          </Can>
        )}
      </div>

      {isLoading ? (
        <p className="p-6 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          Nothing is published. Open a property in <Link to="/real-estate/properties" className="underline">Properties</Link> and
          turn on “List on website”.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-5 py-2">Property</th><th className="px-5 py-2">City</th><th className="px-5 py-2">Photos</th><th className="px-5 py-2">Published</th><th /></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-5 py-2.5"><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.propertyNumber}</p></td>
                  <td className="px-5 py-2.5">{r.city}</td>
                  <td className="px-5 py-2.5">
                    {r.imageCount > 0 ? r.imageCount : <span className="inline-flex items-center gap-1 text-amber-600"><ImageOff className="h-3.5 w-3.5" /> none</span>}
                  </td>
                  <td className="px-5 py-2.5">{formatDate(r.publishedAt)}</td>
                  <td className="px-5 py-2.5 text-right">
                    <Can permission="real-estate.properties.edit">
                      <Button
                        variant="ghost" size="sm" className="text-destructive"
                        disabled={setListing.isPending}
                        onClick={() => setListing.mutate({ propertyId: r.id, listOnWebsite: false })}
                      >
                        <X className="h-4 w-4" /> Remove
                      </Button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmAll}
        title="Remove every property from the website?"
        body="All properties are taken off the website. They stay in Properties and can be published again one by one."
        confirmLabel="Remove all"
        busy={withdrawAll.isPending}
        onCancel={() => setConfirmAll(false)}
        onConfirm={async () => {
          try { await withdrawAll.mutateAsync(); setConfirmAll(false); } catch { /* hook toasts */ }
        }}
      />
    </div>
  );
}

// ── Developer guide ──────────────────────────────────────────────────────────

function IntegrationGuide() {
  const env = `LISTINGS_SOURCE=vrodux
VRODUX_API_URL=${API_ROOT}
VRODUX_API_KEY=<your API key>`;
  const curl = `curl -H "X-Api-Key: <your API key>" \\
  ${API_ROOT}/api/real-estate/website/properties`;

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Setting up the website</h2>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>Put the API key in the website's <b>server</b> environment settings — never in browser code or a public repository.</li>
        <li>The website's server calls the API with the key in the <code className="font-mono">X-Api-Key</code> header.</li>
        <li>Photo links in the response are signed and expire; use them as returned.</li>
        <li>If the key is ever exposed, regenerate it here and update the website.</li>
      </ol>
      <CodeBlock code={env} />
      <CodeBlock code={curl} />
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function KeyModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(apiKey); setCopied(true); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="h-5 w-5" /> Your website API key</h2>
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          This is the only time the key is shown. Copy it now and store it in the website's server settings.
        </div>
        <div className="flex gap-2">
          <code className="flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">{apiKey}</code>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>I've saved the key</Button>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 pr-20 font-mono text-xs">{code}</pre>
      <Button
        variant="ghost" size="sm" className="absolute right-1 top-1"
        onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* ignore */ } }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function ConfirmDialog({
  open, title, body, confirmLabel, busy, onCancel, onConfirm,
}: {
  open: boolean; title: string; body: string; confirmLabel: string; busy: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl space-y-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
