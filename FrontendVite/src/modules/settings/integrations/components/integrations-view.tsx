import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Link2, Link2Off, AlertCircle, RefreshCw, Search, X, Loader2, Copy, Check,
  KeyRound, Trash2, ShieldCheck, History, FileWarning, SlidersHorizontal, Plug,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  useProviderCatalog, useIntegration, useIntegrationSyncLogs, useIntegrationInbox,
  useCreateIntegration, useUpdateIntegrationConfig, useDisconnectIntegration,
  useDeleteIntegration, useRotateInboundKey, useStartMetaOAuth, useMetaPages,
  useSelectMetaTargets,
} from "@/hooks/crm/use-integrations";
import { integrationsApi, type ProviderCatalogItem, type MetaForm } from "@/lib/crm/integrations.api";

// ── Provider visuals ─────────────────────────────────────────────────────────

const LOGO: Record<string, { label: string; color: string }> = {
  meta:               { label: "f",  color: "bg-blue-600" },
  "google-ads":       { label: "G",  color: "bg-amber-500" },
  "google-forms":     { label: "GF", color: "bg-violet-500" },
  "google-sheets":    { label: "GS", color: "bg-green-600" },
  tiktok:             { label: "TT", color: "bg-black" },
  linkedin:           { label: "in", color: "bg-sky-700" },
  whatsapp:           { label: "WA", color: "bg-emerald-500" },
  webhook:            { label: "{}", color: "bg-slate-600" },
  zapier:             { label: "Z",  color: "bg-orange-600" },
  make:               { label: "M",  color: "bg-violet-600" },
  "custom-api":       { label: "</>",color: "bg-indigo-600" },
  website:            { label: "🌐", color: "bg-cyan-600" },
  csv:                { label: "CSV",color: "bg-teal-600" },
  "microsoft-forms":  { label: "MS", color: "bg-rose-600" },
  calendly:           { label: "C",  color: "bg-blue-500" },
  jotform:            { label: "J",  color: "bg-orange-500" },
  typeform:           { label: "T",  color: "bg-gray-800" },
};
const logoFor = (key: string) => LOGO[key] ?? { label: key.slice(0, 2).toUpperCase(), color: "bg-primary" };

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  connected:    { label: "Connected",    color: "text-success",          bg: "bg-success/10",     icon: Link2 },
  disconnected: { label: "Not Connected", color: "text-muted-foreground", bg: "bg-muted",          icon: Link2Off },
  error:        { label: "Error",        color: "text-destructive",      bg: "bg-destructive/10", icon: AlertCircle },
};

const HEALTH_DOT: Record<string, string> = {
  healthy: "bg-success", degraded: "bg-amber-500", down: "bg-destructive", unknown: "bg-muted-foreground",
};

// ── Main view ────────────────────────────────────────────────────────────────

export function IntegrationsView() {
  const { hasRawPermission } = useAuthStore();
  const canEdit = hasRawPermission("settings.integrations.edit");

  const { data: catalog = [], isLoading } = useProviderCatalog();
  const createIntegration = useCreateIntegration();
  const startOAuth = useStartMetaOAuth();

  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [configureId, setConfigureId] = React.useState<string | null>(null);
  const [metaSelectId, setMetaSelectId] = React.useState<string | null>(null);
  const [connecting, setConnecting] = React.useState<string | null>(null);

  // Handle the Meta OAuth return (?provider=meta&status=connected&integration=ID)
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("provider") !== "meta") return;
    const status = p.get("status");
    const id = p.get("integration");
    if (status === "connected" && id) { toast.success("Facebook authorized — choose your pages."); setMetaSelectId(id); }
    else if (status === "error") toast.error("Facebook connection failed. Please try again.");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const categories = React.useMemo(
    () => Array.from(new Set(catalog.map((c) => c.category))).sort(),
    [catalog],
  );

  const filtered = React.useMemo(() => catalog.filter((c) => {
    const s = search.toLowerCase();
    const matchSearch = !s || c.displayName.toLowerCase().includes(s) || c.description.toLowerCase().includes(s);
    const matchCat = categoryFilter === "all" || c.category === categoryFilter;
    return matchSearch && matchCat;
  }), [catalog, search, categoryFilter]);

  const stats = React.useMemo(() => ({
    total: catalog.length,
    connected: catalog.filter((c) => c.connected).length,
    available: catalog.filter((c) => !c.comingSoon).length,
    errors: catalog.filter((c) => c.status === "error").length,
  }), [catalog]);

  async function handleConnect(item: ProviderCatalogItem) {
    if (!canEdit) return;
    setConnecting(item.key);
    try {
      const integration = item.integrationId
        ? await integrationsApi.getById(item.integrationId)
        : await createIntegration.mutateAsync({ providerKey: item.key });

      if (item.capabilities.includes("oAuth")) {
        // OAuth already completed (token stored) — resume at page/form selection
        // instead of bouncing through the provider consent again.
        if (integration.hasCredentials) {
          setMetaSelectId(integration.id);
        } else {
          const { url } = await startOAuth.mutateAsync(integration.id);
          window.location.href = url;          // redirect to provider consent
        }
        return;
      }
      // Inbound providers are live immediately — open the configure drawer.
      setConfigureId(integration.id);
    } catch {
      /* hook toasts the error */
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect external lead sources. New leads flow automatically into your CRM pipeline.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Available", value: stats.available, cls: "text-primary" },
          { label: "Connected", value: stats.connected, cls: "text-success" },
          { label: "Total Providers", value: stats.total, cls: "text-foreground" },
          { label: "Errors", value: stats.errors, cls: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className={cn("text-2xl font-bold", s.cls)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search integrations…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>All</FilterChip>
          {categories.map((cat) => (
            <FilterChip key={cat} active={categoryFilter === cat} onClick={() => setCategoryFilter(cat)}>{cat}</FilterChip>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading integrations…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item, i) => (
            <ProviderCard
              key={item.key} item={item} index={i} canEdit={canEdit}
              connecting={connecting === item.key}
              onConnect={() => handleConnect(item)}
              onConfigure={() => item.integrationId && setConfigureId(item.integrationId)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {configureId && (
          <ConfigureDrawer
            key="cfg" integrationId={configureId} canEdit={canEdit}
            onClose={() => setConfigureId(null)}
            onManageMeta={(id) => { setConfigureId(null); setMetaSelectId(id); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {metaSelectId && (
          <MetaSelectModal key="meta" integrationId={metaSelectId} onClose={() => setMetaSelectId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
    >
      {children}
    </button>
  );
}

// ── Provider card ────────────────────────────────────────────────────────────

function ProviderCard({ item, index, canEdit, connecting, onConnect, onConfigure }: {
  item: ProviderCatalogItem; index: number; canEdit: boolean; connecting: boolean;
  onConnect: () => void; onConfigure: () => void;
}) {
  const logo = logoFor(item.key);
  const statusKey = item.connected ? "connected" : item.status === "error" ? "error" : "disconnected";
  const cfg = STATUS_CFG[statusKey];
  const StatusIcon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
      className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-sm", logo.color)}>
            {logo.label}
          </div>
          <div>
            <h3 className="font-semibold leading-tight">{item.displayName}</h3>
            <span className="text-xs text-muted-foreground">{item.category}</span>
          </div>
        </div>
        {item.comingSoon ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
            Coming soon
          </span>
        ) : (
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", cfg.color, cfg.bg)}>
            {item.connected && <span className={cn("h-1.5 w-1.5 rounded-full", HEALTH_DOT[item.health ?? "unknown"])} />}
            <StatusIcon className="h-3 w-3" /> {cfg.label}
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>

      {item.connected && (
        <div className="bg-muted/30 rounded-lg p-3 text-xs flex items-center justify-between">
          <span className="text-muted-foreground">Last sync</span>
          <span>{formatDate(item.lastSyncAt, "relative")}</span>
        </div>
      )}

      <div className="flex gap-2 pt-1 mt-auto">
        {item.comingSoon ? (
          <Button size="sm" variant="outline" className="flex-1" disabled>Coming soon</Button>
        ) : item.connected ? (
          <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={onConfigure}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Configure
          </Button>
        ) : (
          <Button size="sm" className="flex-1 gap-1.5" disabled={!canEdit || connecting} onClick={onConnect}>
            {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
            Connect
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ── Configure drawer ─────────────────────────────────────────────────────────

type Tab = "overview" | "inbound" | "mapping" | "dedupe" | "routing" | "history" | "errors";

function ConfigureDrawer({ integrationId, canEdit, onClose, onManageMeta }: {
  integrationId: string; canEdit: boolean; onClose: () => void; onManageMeta: (id: string) => void;
}) {
  const { data: integration, isLoading } = useIntegration(integrationId);
  const [tab, setTab] = React.useState<Tab>("overview");
  const disconnect = useDisconnectIntegration();
  const remove = useDeleteIntegration();

  const isMeta = integration?.providerKey === "meta";
  const isInbound = !!integration?.inboundUrl &&
    (integration?.providerKey !== "meta");

  const tabs: { id: Tab; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: "overview", label: "Overview",     icon: ShieldCheck,       show: true },
    { id: "inbound",  label: "Inbound URL",  icon: KeyRound,          show: isInbound },
    { id: "mapping",  label: "Field Mapping",icon: SlidersHorizontal, show: true },
    { id: "dedupe",   label: "Duplicates",   icon: ShieldCheck,       show: true },
    { id: "routing",  label: "Routing",      icon: SlidersHorizontal, show: true },
    { id: "history",  label: "Sync History", icon: History,           show: true },
    { id: "errors",   label: "Error Log",    icon: FileWarning,       show: true },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50" onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-background border-l border-border z-50 flex flex-col"
      >
        {isLoading || !integration ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm", logoFor(integration.providerKey).color)}>
                  {logoFor(integration.providerKey).label}
                </div>
                <div>
                  <h2 className="font-semibold">{integration.name}</h2>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", HEALTH_DOT[integration.health])} />
                    {STATUS_CFG[integration.status].label} · {integration.health}
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex gap-1 px-3 pt-3 border-b border-border overflow-x-auto">
              {tabs.filter((t) => t.show).map((t) => (
                <button
                  key={t.id} onClick={() => setTab(t.id)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap border-b-2 -mb-px transition-colors",
                    tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === "overview" && <OverviewTab integration={integration} isMeta={isMeta} onManageMeta={() => onManageMeta(integration.id)} />}
              {tab === "inbound"  && <InboundTab integration={integration} canEdit={canEdit} />}
              {tab === "mapping"  && <MappingTab integration={integration} canEdit={canEdit} />}
              {tab === "dedupe"   && <DedupeTab integration={integration} canEdit={canEdit} />}
              {tab === "routing"  && <RoutingTab integration={integration} canEdit={canEdit} />}
              {tab === "history"  && <HistoryTab integrationId={integration.id} />}
              {tab === "errors"   && <ErrorsTab integrationId={integration.id} />}
            </div>

            {canEdit && (
              <div className="p-4 border-t border-border flex justify-between">
                <Button variant="ghost" size="sm" className="text-destructive gap-1.5"
                  onClick={async () => { await remove.mutateAsync(integration.id).catch(() => {}); onClose(); }}>
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
                {integration.status === "connected" && (
                  <Button variant="outline" size="sm" className="gap-1.5"
                    onClick={() => disconnect.mutate(integration.id)}>
                    <Link2Off className="h-4 w-4" /> Disconnect
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </motion.div>
    </>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function OverviewTab({ integration, isMeta, onManageMeta }: { integration: any; isMeta: boolean; onManageMeta: () => void }) {
  return (
    <div className="space-y-1">
      <Row label="Provider" value={integration.providerKey} />
      <Row label="Status" value={STATUS_CFG[integration.status].label} />
      <Row label="Health" value={integration.health} />
      <Row label="Last sync" value={formatDate(integration.lastSyncAt, "relative")} />
      <Row label="Last success" value={formatDate(integration.lastSuccessAt, "relative")} />
      <Row label="Last failure" value={formatDate(integration.lastFailureAt, "relative")} />
      <Row label="Retry count" value={integration.retryCount} />
      {integration.lastError && (
        <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">{integration.lastError}</div>
      )}
      {isMeta && (
        <Button className="mt-4 w-full gap-1.5" variant="outline" onClick={onManageMeta}>
          <SlidersHorizontal className="h-4 w-4" /> Manage Pages & Forms
        </Button>
      )}
    </div>
  );
}

function InboundTab({ integration, canEdit }: { integration: any; canEdit: boolean }) {
  const [secret, setSecret] = React.useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = React.useState(false);
  const rotate = useRotateInboundKey();

  async function reveal() {
    setLoadingSecret(true);
    try { setSecret((await integrationsApi.getSecret(integration.id)).signingSecret); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoadingSecret(false); }
  }

  const snippetUrl = integration.inboundUrl ? `${integration.inboundUrl}/snippet.js` : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Send leads here from any service that can POST JSON. Possession of this URL is the secret — keep it private.
      </p>
      <CopyField label="Inbound URL" value={integration.inboundUrl ?? "—"} />

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">HMAC Signing Secret (optional)</label>
        {secret ? <CopyField label="" value={secret} mono /> : (
          <Button variant="outline" size="sm" onClick={reveal} disabled={loadingSecret}>
            {loadingSecret ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reveal secret"}
          </Button>
        )}
      </div>

      {integration.providerKey === "website" && snippetUrl && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Website snippet</label>
          <CopyField label="" value={`<script src="${snippetUrl}"></script>`} mono />
          <p className="text-xs text-muted-foreground">
            Add <code className="text-foreground">data-vrodux-lead</code> to any form to auto-capture its submissions.
          </p>
        </div>
      )}

      {canEdit && (
        <Button variant="ghost" size="sm" className="gap-1.5 text-amber-600" onClick={() => rotate.mutate(integration.id)}>
          <RefreshCw className="h-4 w-4" /> Rotate inbound key
        </Button>
      )}
    </div>
  );
}

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div>
      {label && <label className="text-xs font-medium text-muted-foreground">{label}</label>}
      <div className="flex items-center gap-2 mt-1">
        <code className={cn("flex-1 px-3 py-2 rounded-lg bg-muted text-xs overflow-x-auto whitespace-nowrap", mono && "font-mono")}>
          {value}
        </code>
        <Button size="sm" variant="outline" className="px-2.5" onClick={() => {
          navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500);
        }}>
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function MappingTab({ integration, canEdit }: { integration: any; canEdit: boolean }) {
  const TARGETS = ["firstName","lastName","fullName","email","phone","company","title","industry","address","city","country","notes"];
  const [rows, setRows] = React.useState<{ sourceField: string; targetField: string }[]>(
    integration.fieldMappings.map((m: any) => ({ sourceField: m.sourceField, targetField: m.targetField })),
  );
  const update = useUpdateIntegrationConfig();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Map incoming source fields to CRM lead fields. Unmapped fields are auto-detected by name.
      </p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input placeholder="source_field" value={r.sourceField} disabled={!canEdit}
            onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, sourceField: e.target.value } : x))} />
          <span className="text-muted-foreground">→</span>
          <select
            className="bg-card border border-border rounded-md px-2 py-2 text-sm flex-1" value={r.targetField} disabled={!canEdit}
            onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, targetField: e.target.value } : x))}
          >
            <option value="">— field —</option>
            {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {canEdit && (
            <button className="text-muted-foreground hover:text-destructive" onClick={() => setRows((p) => p.filter((_, j) => j !== i))}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setRows((p) => [...p, { sourceField: "", targetField: "" }])}>
            Add mapping
          </Button>
          <Button size="sm" onClick={() => update.mutate({ id: integration.id, req: { fieldMappings: rows.filter((r) => r.sourceField && r.targetField) } })}>
            Save mappings
          </Button>
        </div>
      )}
    </div>
  );
}

function DedupeTab({ integration, canEdit }: { integration: any; canEdit: boolean }) {
  const parsed = safeParse(integration.dedupeConfig, { byEmail: true, byPhone: true, byExternalId: true });
  const [rules, setRules] = React.useState(parsed);
  const update = useUpdateIntegrationConfig();
  const items: { key: keyof typeof rules; label: string }[] = [
    { key: "byEmail", label: "Match by email" },
    { key: "byPhone", label: "Match by phone" },
    { key: "byExternalId", label: "Match by external lead id" },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Skip creating a lead when an existing one matches any enabled rule.</p>
      {items.map((it) => (
        <label key={it.key} className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!rules[it.key]} disabled={!canEdit}
            onChange={(e) => setRules((p: any) => ({ ...p, [it.key]: e.target.checked }))} />
          {it.label}
        </label>
      ))}
      {canEdit && (
        <Button size="sm" onClick={() => update.mutate({ id: integration.id, req: { dedupeConfig: JSON.stringify(rules) } })}>
          Save rules
        </Button>
      )}
    </div>
  );
}

function RoutingTab({ integration, canEdit }: { integration: any; canEdit: boolean }) {
  const parsed = safeParse(integration.routingConfig, { mode: "fixed", assignTo: "", pool: [] as string[] });
  const [routing, setRouting] = React.useState(parsed);
  const update = useUpdateIntegrationConfig();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Decide who new leads from this source are assigned to.</p>
      <select className="bg-card border border-border rounded-md px-2 py-2 text-sm w-full" value={routing.mode} disabled={!canEdit}
        onChange={(e) => setRouting((p: any) => ({ ...p, mode: e.target.value }))}>
        <option value="fixed">Assign to a specific user</option>
        <option value="round_robin">Round-robin across a team</option>
        <option value="unassigned">Leave unassigned</option>
      </select>
      {routing.mode === "fixed" && (
        <Input placeholder="user@example.com or name" value={routing.assignTo ?? ""} disabled={!canEdit}
          onChange={(e) => setRouting((p: any) => ({ ...p, assignTo: e.target.value }))} />
      )}
      {routing.mode === "round_robin" && (
        <Input placeholder="comma,separated,users" value={(routing.pool ?? []).join(",")} disabled={!canEdit}
          onChange={(e) => setRouting((p: any) => ({ ...p, pool: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))} />
      )}
      {canEdit && (
        <Button size="sm" onClick={() => update.mutate({ id: integration.id, req: { routingConfig: JSON.stringify(routing) } })}>
          Save routing
        </Button>
      )}
    </div>
  );
}

function HistoryTab({ integrationId }: { integrationId: string }) {
  const { data: logs = [], isLoading } = useIntegrationSyncLogs(integrationId);
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (!logs.length) return <Empty text="No sync activity yet." />;
  return (
    <div className="space-y-2">
      {logs.map((l) => (
        <div key={l.id} className="bg-card border border-border rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium capitalize">{l.trigger}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full",
              l.status === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>{l.status}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {l.created} created · {l.duplicates} dup · {l.failed} failed · {formatDate(l.startedAt, "relative")}
          </div>
          {l.message && <div className="text-xs text-destructive mt-1">{l.message}</div>}
        </div>
      ))}
    </div>
  );
}

function ErrorsTab({ integrationId }: { integrationId: string }) {
  const { data: rows = [], isLoading } = useIntegrationInbox(integrationId);
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (!rows.length) return <Empty text="No inbound payloads recorded yet." />;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="bg-card border border-border rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs">{r.externalId ?? r.id.slice(0, 8)}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full",
              r.status === "processed" ? "bg-success/10 text-success"
              : r.status === "duplicate" ? "bg-muted text-muted-foreground"
              : r.status === "failed" ? "bg-destructive/10 text-destructive"
              : "bg-amber-500/10 text-amber-600")}>{r.status}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {r.attempts} attempt(s) · {formatDate(r.receivedAt, "relative")}
          </div>
          {r.lastError && <div className="text-xs text-destructive mt-1">{r.lastError}</div>}
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-muted-foreground text-sm py-12">{text}</div>;
}

// ── Meta page/form selection ─────────────────────────────────────────────────

function MetaSelectModal({ integrationId, onClose }: { integrationId: string; onClose: () => void }) {
  const { data: pages = [], isLoading } = useMetaPages(integrationId, true);
  const select = useSelectMetaTargets();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [forms, setForms] = React.useState<Record<string, MetaForm[]>>({});
  const [picked, setPicked] = React.useState<Record<string, Set<string>>>({});

  async function toggleExpand(pageId: string) {
    setExpanded((p) => (p === pageId ? null : pageId));
    if (!forms[pageId]) {
      try {
        const list = await integrationsApi.meta.forms(integrationId, pageId);
        setForms((p) => ({ ...p, [pageId]: list }));
      } catch (e) { toast.error((e as Error).message); }
    }
  }

  function toggleForm(pageId: string, formId: string) {
    setPicked((p) => {
      const set = new Set(p[pageId] ?? []);
      set.has(formId) ? set.delete(formId) : set.add(formId);
      return { ...p, [pageId]: set };
    });
  }

  async function save() {
    const selections = Object.entries(picked)
      .filter(([, set]) => set.size > 0)
      .map(([pageId, set]) => ({
        pageId,
        forms: (forms[pageId] ?? []).filter((f) => set.has(f.formId)).map((f) => ({ formId: f.formId, name: f.name })),
      }));
    if (!selections.length) { toast.error("Select at least one form."); return; }
    try { await select.mutateAsync({ id: integrationId, pages: selections }); onClose(); } catch { /* toasted */ }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background border border-border rounded-xl z-50 flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold">Select Facebook Pages & Forms</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Choose which Lead Ad forms sync into your CRM.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto my-8" />
            : pages.length === 0 ? <Empty text="No Facebook pages found for this account." />
            : pages.map((page) => (
              <div key={page.pageId} className="border border-border rounded-lg">
                <button className="w-full flex items-center justify-between p-3 text-sm font-medium" onClick={() => toggleExpand(page.pageId)}>
                  <span>{page.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(picked[page.pageId]?.size ?? 0) > 0 ? `${picked[page.pageId].size} selected` : "Select forms"}
                  </span>
                </button>
                {expanded === page.pageId && (
                  <div className="px-3 pb-3 space-y-1.5 border-t border-border pt-2">
                    {!forms[page.pageId] ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      : forms[page.pageId].length === 0 ? <p className="text-xs text-muted-foreground">No lead forms on this page.</p>
                      : forms[page.pageId].map((f) => (
                        <label key={f.formId} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={picked[page.pageId]?.has(f.formId) ?? false}
                            onChange={() => toggleForm(page.pageId, f.formId)} />
                          {f.name || f.formId}
                        </label>
                      ))}
                  </div>
                )}
              </div>
            ))}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={select.isPending} onClick={save}>
            {select.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect selected"}
          </Button>
        </div>
      </motion.div>
    </>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return { ...fallback, ...JSON.parse(json) }; } catch { return fallback; }
}
