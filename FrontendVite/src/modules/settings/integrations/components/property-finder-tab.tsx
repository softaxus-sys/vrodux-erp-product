import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, ShieldCheck, Radio, CheckCircle2, AlertTriangle, Download, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import {
  useSetPropertyFinderCredentials, usePropertyFinderSyncStatus, useSubscribePropertyFinderSync,
} from "@/hooks/crm/use-property-finder";
import type { Integration } from "@/lib/crm/integrations.api";

/**
 * Everything Property Finder-specific, on the integration that owns it.
 *
 * This deliberately lives inside the integration rather than on a page of its own: the API key, the
 * inbound URL, the signing secret and the webhook subscription all belong to <em>this tenant's</em>
 * integration row. Somewhere else would mean a second place holding the same per-tenant state.
 *
 * The historical import is the one part that opens full-screen — it is a multi-step wizard over ~96
 * agents and thousands of enquiries, which a 672px drawer cannot show honestly.
 */
export function PropertyFinderTab({ integration }: { integration: Integration }) {
  const navigate = useNavigate();
  const canImport = useCan("settings.integrations.import");

  const setCredentials = useSetPropertyFinderCredentials();
  const syncStatus     = usePropertyFinderSyncStatus(canImport ? integration.id : null);
  const subscribeSync  = useSubscribePropertyFinderSync();

  const [apiKey, setApiKey]       = React.useState("");
  const [apiSecret, setApiSecret] = React.useState("");

  // "Not configured" from the status call is the reliable signal that no key is stored — the key
  // itself is never returned, so its absence can only be inferred from a failure to use it.
  const statusError = (syncStatus.error as Error | null)?.message ?? null;
  const needsKey = /no property finder api key/i.test(statusError ?? "");

  if (!canImport) {
    return (
      <p className="text-sm text-muted-foreground">
        Connecting Property Finder pulls another system's agents and enquiries into this workspace,
        so it is limited to workspace administrators.
      </p>
    );
  }

  const status = subscribeSync.data ?? syncStatus.data;

  return (
    <div className="space-y-6">
      {/* ── API key ─────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">API key</h3>
          {!needsKey && !syncStatus.isLoading && <Badge tone="good">stored</Badge>}
          {needsKey && <Badge tone="warn">not set</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Each agency uses its own Property Finder key, so it is stored against this workspace only
          and encrypted at rest. It is verified against Property Finder before saving, and never
          shown again afterwards.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="API key (40 characters)" className="h-8 text-xs" />
          <Input value={apiSecret} onChange={e => setApiSecret(e.target.value)} type="password"
            placeholder="API secret (32 characters)" className="h-8 text-xs" />
        </div>
        <Button size="sm" className="gap-2"
          disabled={apiKey.trim().length !== 40 || apiSecret.trim().length !== 32 || setCredentials.isPending}
          onClick={() => setCredentials.mutate(
            { integrationId: integration.id, apiKey: apiKey.trim(), apiSecret: apiSecret.trim() },
            { onSuccess: () => { setApiKey(""); setApiSecret(""); syncStatus.refetch(); } })}>
          {setCredentials.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <ShieldCheck className="h-3.5 w-3.5" />}
          {needsKey ? "Save and verify key" : "Replace key"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Needs the scopes <b>leads:read</b>, <b>users:read</b>, <b>roles:read</b> and
          <b> listings:read</b>. Scopes are fixed when a key is created, so a key missing one has to
          be regenerated in PF Expert.
        </p>
      </section>

      {/* ── Live sync ───────────────────────────────────────────────────── */}
      <section className="space-y-2 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Live sync</h3>
          {status?.live && <Badge tone="good">on</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Registers this integration's inbound URL with Property Finder, so <b>lead.created</b> and
          <b> lead.assigned</b> are delivered as they happen — through the same inbound webhook every
          other source uses. A background poll every 30 minutes covers anything missed while the
          server was restarting.
        </p>

        {integration.inboundUrl && (
          <p className="text-[11px] font-mono text-muted-foreground break-all">{integration.inboundUrl}</p>
        )}

        <Button size="sm" className="gap-2" disabled={needsKey || subscribeSync.isPending}
          onClick={() => subscribeSync.mutate(integration.id)}>
          {subscribeSync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
          {status?.live ? "Re-check" : "Turn on live sync"}
        </Button>

        {status?.live && (
          <p className="text-xs text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> New enquiries arrive on their own.
          </p>
        )}

        {status?.blocker && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2.5">
            <p className="text-[11px] text-foreground flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-px shrink-0" />
              {status.blocker}
            </p>
          </div>
        )}

        {(status?.notes ?? []).map((n, i) => (
          <p key={i} className="text-[11px] text-muted-foreground">{n}</p>
        ))}

        {(status?.subscriptions ?? []).map((w, i) => (
          <p key={i} className="text-[11px] text-muted-foreground">
            <b className="text-foreground">{w.eventId}</b> → {w.url}
            {!w.isOurs && <span className="text-amber-600"> (another destination)</span>}
          </p>
        ))}
      </section>

      {/* ── Historical import ───────────────────────────────────────────── */}
      <section className="space-y-2 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-foreground">Import the history</h3>
        <p className="text-xs text-muted-foreground">
          Live sync only brings in what happens from now on. This is the one-off backfill of every
          past enquiry, with each one assigned to the agent who owns it. It opens full-screen —
          choosing agents, teams and team leads needs more room than a side panel.
        </p>
        <Button size="sm" variant="outline" className="gap-2" disabled={needsKey}
          onClick={() => navigate("/settings/property-finder")}>
          <Download className="h-3.5 w-3.5" /> Open the import
          <ExternalLink className="h-3 w-3" />
        </Button>
        {needsKey && (
          <p className="text-[11px] text-amber-600">Save the API key first.</p>
        )}
      </section>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "good" | "warn" }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold",
      tone === "good"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")}>
      {children}
    </span>
  );
}
