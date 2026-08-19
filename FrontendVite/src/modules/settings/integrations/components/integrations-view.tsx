import * as React from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Trans, useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Link2, Link2Off, AlertCircle, RefreshCw, Search, X, Loader2, Copy, Check,
  KeyRound, Trash2, ShieldCheck, History, FileWarning, SlidersHorizontal, Plug, UploadCloud,
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
  "property-finder":  { label: "PF", color: "bg-rose-600" },
};
const logoFor = (key: string) => LOGO[key] ?? { label: key.slice(0, 2).toUpperCase(), color: "bg-primary" };

const STATUS_CFG: Record<string, { labelKey: string; color: string; bg: string; icon: React.ElementType }> = {
  connected:    { labelKey: "integrations.status.connected",    color: "text-success",          bg: "bg-success/10",     icon: Link2 },
  disconnected: { labelKey: "integrations.status.disconnected", color: "text-muted-foreground", bg: "bg-muted",          icon: Link2Off },
  error:        { labelKey: "integrations.status.error",        color: "text-destructive",      bg: "bg-destructive/10", icon: AlertCircle },
};

const HEALTH_DOT: Record<string, string> = {
  healthy: "bg-success", degraded: "bg-amber-500", down: "bg-destructive", unknown: "bg-muted-foreground",
};

/** Categories come from the backend as English display strings — translate with a passthrough fallback. */
const categoryLabel = (t: TFunction, cat: string) => t(`integrations.category.${cat}`, { defaultValue: cat });
/** Health / sync statuses are raw API values — same passthrough treatment. */
const healthLabel = (t: TFunction, h: string) => t(`integrations.health.${h}`, { defaultValue: h });
const syncStatusLabel = (t: TFunction, s: string) => t(`integrations.syncStatus.${s}`, { defaultValue: s });

/** Shared <Trans> components for the setup-guide prose (inline code + bold). */
const RICH = { c: <code />, b: <b /> };

// ── Main view ────────────────────────────────────────────────────────────────

export function IntegrationsView() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
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
    if (status === "connected" && id) { toast.success(t("integrations.metaAuthorized")); setMetaSelectId(id); }
    else if (status === "error") toast.error(t("integrations.metaFailed"));
    window.history.replaceState({}, "", window.location.pathname);
  }, [t]);

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
    // Manual import (CSV / Excel) has no inbound connection — the file is parsed in the
    // browser and posted to the bulk endpoint. Send the user to the Leads importer.
    if (item.capabilities.includes("manualImport")) {
      navigate("/crm/leads?import=1");
      return;
    }
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
          <h1 className="text-2xl font-bold">{t("integrations.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("integrations.description")}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("integrations.statAvailable"), value: stats.available, cls: "text-primary" },
          { label: t("integrations.statConnected"), value: stats.connected, cls: "text-success" },
          { label: t("integrations.statTotal"),     value: stats.total,     cls: "text-foreground" },
          { label: t("integrations.statErrors"),    value: stats.errors,    cls: "text-destructive" },
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
          <Input placeholder={t("integrations.searchPlaceholder")} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>{t("integrations.all")}</FilterChip>
          {categories.map((cat) => (
            <FilterChip key={cat} active={categoryFilter === cat} onClick={() => setCategoryFilter(cat)}>{categoryLabel(t, cat)}</FilterChip>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t("integrations.loading")}
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
  const { t } = useTranslation("settings");
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
            <span className="text-xs text-muted-foreground">{categoryLabel(t, item.category)}</span>
          </div>
        </div>
        {item.comingSoon ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
            {t("integrations.card.comingSoon")}
          </span>
        ) : (
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", cfg.color, cfg.bg)}>
            {item.connected && <span className={cn("h-1.5 w-1.5 rounded-full", HEALTH_DOT[item.health ?? "unknown"])} />}
            <StatusIcon className="h-3 w-3" /> {t(cfg.labelKey)}
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>

      {item.connected && (
        <div className="bg-muted/30 rounded-lg p-3 text-xs flex items-center justify-between">
          <span className="text-muted-foreground">{t("integrations.card.lastSync")}</span>
          <span>{formatDate(item.lastSyncAt, "relative")}</span>
        </div>
      )}

      <div className="flex gap-2 pt-1 mt-auto">
        {item.comingSoon ? (
          <Button size="sm" variant="outline" className="flex-1" disabled>{t("integrations.card.comingSoon")}</Button>
        ) : item.connected ? (
          <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={onConfigure}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> {t("integrations.card.configure")}
          </Button>
        ) : item.capabilities.includes("manualImport") ? (
          <Button size="sm" className="flex-1 gap-1.5" disabled={!canEdit} onClick={onConnect}>
            <UploadCloud className="h-3.5 w-3.5" /> {t("integrations.card.importLeads")}
          </Button>
        ) : (
          <Button size="sm" className="flex-1 gap-1.5" disabled={!canEdit || connecting} onClick={onConnect}>
            {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
            {t("integrations.card.connect")}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ── Configure drawer ─────────────────────────────────────────────────────────

type Tab = "overview" | "setup" | "inbound" | "mapping" | "dedupe" | "routing" | "history" | "errors";

function ConfigureDrawer({ integrationId, canEdit, onClose, onManageMeta }: {
  integrationId: string; canEdit: boolean; onClose: () => void; onManageMeta: (id: string) => void;
}) {
  const { t } = useTranslation("settings");
  const { data: integration, isLoading } = useIntegration(integrationId);
  const [tab, setTab] = React.useState<Tab>("overview");
  const disconnect = useDisconnectIntegration();
  const remove = useDeleteIntegration();

  const isMeta = integration?.providerKey === "meta";
  const isInbound = !!integration?.inboundUrl &&
    (integration?.providerKey !== "meta");

  const tabs: { id: Tab; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: "overview", label: t("integrations.tab.overview"), icon: ShieldCheck,       show: true },
    { id: "setup",    label: t("integrations.tab.setup"),    icon: Plug,              show: isInbound },
    { id: "inbound",  label: t("integrations.tab.inbound"),  icon: KeyRound,          show: isInbound },
    { id: "mapping",  label: t("integrations.tab.mapping"),  icon: SlidersHorizontal, show: true },
    { id: "dedupe",   label: t("integrations.tab.dedupe"),   icon: ShieldCheck,       show: true },
    { id: "routing",  label: t("integrations.tab.routing"),  icon: SlidersHorizontal, show: true },
    { id: "history",  label: t("integrations.tab.history"),  icon: History,           show: true },
    { id: "errors",   label: t("integrations.tab.errors"),   icon: FileWarning,       show: true },
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
                    {t(STATUS_CFG[integration.status].labelKey)} · {healthLabel(t, integration.health)}
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex gap-1 px-3 pt-3 border-b border-border overflow-x-auto">
              {tabs.filter((tb) => tb.show).map((tb) => (
                <button
                  key={tb.id} onClick={() => setTab(tb.id)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap border-b-2 -mb-px transition-colors",
                    tab === tb.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === "overview" && <OverviewTab integration={integration} isMeta={isMeta} onManageMeta={() => onManageMeta(integration.id)} />}
              {tab === "setup"    && <ProviderSetup integration={integration} />}
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
                  <Trash2 className="h-4 w-4" /> {t("integrations.remove")}
                </Button>
                {integration.status === "connected" && (
                  <Button variant="outline" size="sm" className="gap-1.5"
                    onClick={() => disconnect.mutate(integration.id)}>
                    <Link2Off className="h-4 w-4" /> {t("integrations.disconnect")}
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
  const { t } = useTranslation("settings");
  return (
    <div className="space-y-1">
      <Row label={t("integrations.overview.provider")} value={integration.providerKey} />
      <Row label={t("integrations.overview.status")} value={t(STATUS_CFG[integration.status].labelKey)} />
      <Row label={t("integrations.overview.health")} value={healthLabel(t, integration.health)} />
      <Row label={t("integrations.overview.lastSync")} value={formatDate(integration.lastSyncAt, "relative")} />
      <Row label={t("integrations.overview.lastSuccess")} value={formatDate(integration.lastSuccessAt, "relative")} />
      <Row label={t("integrations.overview.lastFailure")} value={formatDate(integration.lastFailureAt, "relative")} />
      <Row label={t("integrations.overview.retryCount")} value={integration.retryCount} />
      {integration.lastError && (
        <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">{integration.lastError}</div>
      )}
      {isMeta && (
        <Button className="mt-4 w-full gap-1.5" variant="outline" onClick={onManageMeta}>
          <SlidersHorizontal className="h-4 w-4" /> {t("integrations.overview.managePages")}
        </Button>
      )}
    </div>
  );
}

function InboundTab({ integration, canEdit }: { integration: any; canEdit: boolean }) {
  const { t } = useTranslation("settings");
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
        {t("integrations.inbound.intro")}
      </p>
      <CopyField label={t("integrations.inbound.urlLabel")} value={integration.inboundUrl ?? "—"} />

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">{t("integrations.inbound.secretLabel")}</label>
        {secret ? <CopyField label="" value={secret} mono /> : (
          <Button variant="outline" size="sm" onClick={reveal} disabled={loadingSecret}>
            {loadingSecret ? <Loader2 className="h-4 w-4 animate-spin" /> : t("integrations.inbound.revealSecret")}
          </Button>
        )}
      </div>

      {integration.providerKey === "website" && snippetUrl && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">{t("integrations.inbound.snippetLabel")}</label>
          <CopyField label="" value={`<script src="${snippetUrl}"></script>`} mono />
          <p className="text-xs text-muted-foreground">
            <Trans t={t} i18nKey="integrations.inbound.snippetHint" components={{ c: <code className="text-foreground" /> }} />
          </p>
        </div>
      )}

      {canEdit && (
        <Button variant="ghost" size="sm" className="gap-1.5 text-amber-600" onClick={() => rotate.mutate(integration.id)}>
          <RefreshCw className="h-4 w-4" /> {t("integrations.inbound.rotate")}
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

// ── Setup Guide (per-provider instructions) ──────────────────────────────────

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const { t } = useTranslation("settings");
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="relative group">
      {lang && <span className="absolute top-2 left-3 text-[10px] uppercase tracking-wide text-muted-foreground/70">{lang}</span>}
      <pre className={cn("bg-muted rounded-lg p-3 pr-11 text-xs overflow-x-auto font-mono leading-relaxed", lang && "pt-6")} dir="ltr">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 border border-border hover:bg-background"
        title={t("integrations.copy")}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-sm">
          <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
          <span className="text-muted-foreground leading-relaxed [&_code]:text-foreground [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px]">{it}</span>
        </li>
      ))}
    </ol>
  );
}

function SetupSection({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

const ACCEPTED_FIELDS =
  "first_name, last_name, name, email, phone, whatsapp, company, title, city, country, interested_in, budget, message, campaign";

/** "Accepted fields: <code>…</code>" line shared by several provider guides. */
function AcceptedFields({ extra }: { extra?: boolean }) {
  const { t } = useTranslation("settings");
  return (
    <p className="text-xs text-muted-foreground">
      {t("integrations.setup.acceptedFields")}{" "}
      <code className="text-foreground bg-muted px-1 rounded text-[11px]" dir="ltr">{ACCEPTED_FIELDS}</code>
      {extra ? <>. {t("integrations.setup.acceptedFieldsExtra")}</> : null}
    </p>
  );
}

function ProviderSetup({ integration }: { integration: any }) {
  const { t } = useTranslation("settings");
  const url: string = integration.inboundUrl ?? "";
  const key: string = integration.providerKey;
  const [webMode, setWebMode] = React.useState<"easy" | "advanced">("easy");

  const curlExample =
`curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@acme.com",
    "phone": "+971500000000",
    "company": "Acme Inc",
    "interested_in": "Enterprise plan",
    "budget": "50k-100k",
    "message": "Please get in touch"
  }'`;

  // ── Website Forms ──────────────────────────────────────────────────────────
  if (key === "website") {
    const iframe = `<iframe\n  src="${url}/form"\n  style="width:100%;max-width:480px;height:660px;border:0"\n  title="Contact form" loading="lazy"></iframe>`;
    const exampleForm =
`<form data-vrodux-lead>
  <input name="first_name" placeholder="First name" required />
  <input name="email" type="email" placeholder="Email" required />
  <input name="phone" placeholder="Phone" />
  <input name="interested_in" placeholder="Interested in" />
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Send</button>
</form>`;
    return (
      <div className="space-y-5">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {(["easy", "advanced"] as const).map(m => (
            <button key={m} onClick={() => setWebMode(m)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                webMode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {m === "easy" ? t("integrations.setup.web.easy") : t("integrations.setup.web.advanced")}
            </button>
          ))}
        </div>

        {webMode === "easy" ? (
          <SetupSection title={t("integrations.setup.web.easyTitle")} desc={t("integrations.setup.web.easyDesc")}>
            <CodeBlock code={iframe} lang="html" />
            <a href={`${url}/form`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <UploadCloud className="h-3.5 w-3.5" /> {t("integrations.setup.web.preview")}
            </a>
            <Steps items={[
              t("integrations.setup.web.step1"),
              t("integrations.setup.web.step2"),
              t("integrations.setup.web.step3"),
            ]} />
          </SetupSection>
        ) : (
          <SetupSection title={t("integrations.setup.web.advTitle")} desc={t("integrations.setup.web.advDesc")}>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">{t("integrations.setup.web.optionA")}</p>
              <CodeBlock code={`<script src="${url}/snippet.js"></script>`} lang="html" />
              <p className="text-xs text-muted-foreground">
                <Trans t={t} i18nKey="integrations.setup.web.optionAHint"
                  components={{ c: <code className="text-foreground bg-muted px-1 rounded" /> }} />
              </p>
              <CodeBlock code={exampleForm} lang="html" />
            </div>
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-foreground">{t("integrations.setup.web.optionB")}</p>
              <CodeBlock code={curlExample} lang="bash" />
              <AcceptedFields />
            </div>
          </SetupSection>
        )}
      </div>
    );
  }

  // ── Google Sheets ──────────────────────────────────────────────────────────
  if (key === "google-sheets") {
    const script =
`const VRODUX_ENDPOINT = "${url}";

// Runs on each new row (link an Apps Script trigger — see steps below).
function vroduxSendRow(e) {
  const sheet   = e.range.getSheet();
  const row     = e.range.getRow();
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values  = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
  const payload = {};
  headers.forEach((h, i) => { if (h) payload[String(h).trim()] = values[i]; });
  UrlFetchApp.fetch(VRODUX_ENDPOINT, {
    method: "post", contentType: "application/json",
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
}`;
    return (
      <SetupSection title={t("integrations.setup.sheets.title")} desc={t("integrations.setup.sheets.desc")}>
        <CodeBlock code={script} lang="apps script" />
        <Steps items={[1, 2, 3, 4, 5].map(n => (
          <Trans key={n} t={t} i18nKey={`integrations.setup.sheets.step${n}`} components={RICH} />
        ))} />
      </SetupSection>
    );
  }

  // ── Google Forms ───────────────────────────────────────────────────────────
  if (key === "google-forms") {
    const script =
`const VRODUX_ENDPOINT = "${url}";

// Runs on every form submission (link an onFormSubmit trigger — see steps below).
function vroduxOnFormSubmit(e) {
  const payload = {};
  for (const q in e.namedValues) { payload[q] = e.namedValues[q].join(", "); }
  UrlFetchApp.fetch(VRODUX_ENDPOINT, {
    method: "post", contentType: "application/json",
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
}`;
    return (
      <SetupSection title={t("integrations.setup.forms.title")} desc={t("integrations.setup.forms.desc")}>
        <CodeBlock code={script} lang="apps script" />
        <Steps items={[1, 2, 3, 4].map(n => (
          <Trans key={n} t={t} i18nKey={`integrations.setup.forms.step${n}`} components={RICH} />
        ))} />
      </SetupSection>
    );
  }

  // ── Property Finder ────────────────────────────────────────────────────────
  if (key === "property-finder") {
    const pfPayload =
`{
  "type": "email",
  "lead_id": "PF-000123",
  "client": {
    "name": "Ahmed Ali",
    "email": "ahmed@example.com",
    "phone": "+971501234567"
  },
  "message": "Is this apartment still available? I'd like a viewing.",
  "property": {
    "reference": "MARINA-2BR-1024",
    "title": "2 Bedroom Apartment, Dubai Marina",
    "type": "Apartment",
    "offering_type": "rent",
    "price": "120000",
    "location": "Dubai Marina, Dubai",
    "bedrooms": "2",
    "bathrooms": "2",
    "url": "https://www.propertyfinder.ae/en/plp/..."
  }
}`;
    const pfCurl =
`curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -d '${pfPayload.replace(/\n/g, "\n  ")}'`;
    return (
      <div className="space-y-5">
        <SetupSection title={t("integrations.setup.pf.title")} desc={t("integrations.setup.pf.desc")}>
          <CopyField label={t("integrations.setup.yourInboundUrl")} value={url || "—"} />
          <Steps items={[1, 2, 3].map(n => (
            <Trans key={n} t={t} i18nKey={`integrations.setup.pf.step${n}`} components={RICH} />
          ))} />
          <p className="text-xs text-muted-foreground">
            <Trans t={t} i18nKey="integrations.setup.pf.note" components={RICH} />
          </p>
        </SetupSection>

        <SetupSection title={t("integrations.setup.pf.payloadTitle")} desc={t("integrations.setup.pf.payloadDesc")}>
          <CodeBlock code={pfPayload} lang="json" />
          <p className="text-xs text-muted-foreground">
            <Trans t={t} i18nKey="integrations.setup.pf.mappedHint"
              components={{ c: <code className="text-foreground bg-muted px-1 rounded text-[11px]" /> }} />
          </p>
        </SetupSection>

        <SetupSection title={t("integrations.setup.pf.testTitle")} desc={t("integrations.setup.pf.testDesc")}>
          <CodeBlock code={pfCurl} lang="bash" />
        </SetupSection>

        <SetupSection title={t("integrations.setup.pf.hmacTitle")} desc={t("integrations.setup.pf.hmacDesc")}>
          <Steps items={[1, 2].map(n => (
            <Trans key={n} t={t} i18nKey={`integrations.setup.pf.hmacStep${n}`} components={RICH} />
          ))} />
        </SetupSection>
      </div>
    );
  }

  // ── Calendly ───────────────────────────────────────────────────────────────
  if (key === "calendly") {
    const orgCurl = `curl -s "https://api.calendly.com/users/me" \\\n  -H "Authorization: Bearer <YOUR_CALENDLY_TOKEN>"`;
    const subCurl =
`curl -X POST "https://api.calendly.com/webhook_subscriptions" \\
  -H "Authorization: Bearer <YOUR_CALENDLY_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "${url}",
    "events": ["invitee.created"],
    "organization": "https://api.calendly.com/organizations/XXXX",
    "scope": "organization"
  }'`;
    return (
      <SetupSection title={t("integrations.setup.calendly.title")} desc={t("integrations.setup.calendly.desc")}>
        <Steps items={[
          <Trans t={t} i18nKey="integrations.setup.calendly.step1" components={RICH} />,
          <Trans t={t} i18nKey="integrations.setup.calendly.step2" components={RICH} />,
        ]} />
        <CodeBlock code={orgCurl} lang="bash" />
        <Steps items={[
          <Trans t={t} i18nKey="integrations.setup.calendly.step3" components={RICH} />,
        ]} />
        <CodeBlock code={subCurl} lang="bash" />
        <Steps items={[
          <Trans t={t} i18nKey="integrations.setup.calendly.step4" components={RICH} />,
        ]} />
      </SetupSection>
    );
  }

  // ── Custom API / Zapier / Make / generic webhook ───────────────────────────
  return (
    <div className="space-y-5">
      <SetupSection title={t("integrations.setup.generic.title")} desc={t("integrations.setup.generic.desc")}>
        <CopyField label={t("integrations.inbound.urlLabel")} value={url || "—"} />
        <CodeBlock code={curlExample} lang="bash" />
        <AcceptedFields extra />
      </SetupSection>

      {(key === "zapier" || key === "make") && (
        <SetupSection title={key === "zapier" ? t("integrations.setup.generic.zapierTitle") : t("integrations.setup.generic.makeTitle")}>
          <Steps items={[
            <Trans t={t} i18nKey="integrations.setup.generic.step1" components={RICH} />,
            <Trans t={t} i18nKey="integrations.setup.generic.step2" components={RICH} />,
            key === "zapier" ? t("integrations.setup.generic.step3Zapier") : t("integrations.setup.generic.step3Make"),
          ]} />
        </SetupSection>
      )}

      <SetupSection title={t("integrations.setup.generic.hmacTitle")} desc={t("integrations.setup.generic.hmacDesc")}>
        <Steps items={[1, 2, 3].map(n => (
          <Trans key={n} t={t} i18nKey={`integrations.setup.generic.hmacStep${n}`} components={RICH} />
        ))} />
      </SetupSection>
    </div>
  );
}

// All CRM lead fields an incoming source field can be mapped onto — must mirror the backend
// CanonicalLeadFields (LeadIntakeService.ApplyFieldMappings). Grouped + labelled so users can map
// Meta/Instagram/Facebook lead-form questions (budget, timeframe, interest, whatsapp, …), not just
// the basic contact fields.
const TARGET_FIELDS: string[] = [
  "firstName", "lastName", "fullName", "email", "phone", "whatsApp",
  "company", "title", "industry", "address", "city", "country",
  "interestedIn", "budget", "timeframe", "message", "notes", "campaign", "formName",
];

function MappingTab({ integration, canEdit }: { integration: any; canEdit: boolean }) {
  const { t } = useTranslation("settings");
  const [rows, setRows] = React.useState<{ sourceField: string; targetField: string }[]>(
    integration.fieldMappings.map((m: any) => ({ sourceField: m.sourceField, targetField: m.targetField })),
  );
  const update = useUpdateIntegrationConfig();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("integrations.mapping.intro")}
      </p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input placeholder={t("integrations.mapping.sourcePlaceholder")} value={r.sourceField} disabled={!canEdit}
            onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, sourceField: e.target.value } : x))} />
          <span className="text-muted-foreground">→</span>
          <select
            className="bg-card border border-border rounded-md px-2 py-2 text-sm flex-1" value={r.targetField} disabled={!canEdit}
            onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, targetField: e.target.value } : x))}
          >
            <option value="">{t("integrations.mapping.pickField")}</option>
            {TARGET_FIELDS.map((f) => <option key={f} value={f}>{t(`integrations.mapping.field.${f}`)}</option>)}
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
            {t("integrations.mapping.addMapping")}
          </Button>
          <Button size="sm" onClick={() => update.mutate({ id: integration.id, req: { fieldMappings: rows.filter((r) => r.sourceField && r.targetField) } })}>
            {t("integrations.mapping.saveMappings")}
          </Button>
        </div>
      )}
    </div>
  );
}

function DedupeTab({ integration, canEdit }: { integration: any; canEdit: boolean }) {
  const { t } = useTranslation("settings");
  const parsed = safeParse(integration.dedupeConfig, { byEmail: true, byPhone: true, byExternalId: true });
  const [rules, setRules] = React.useState(parsed);
  const update = useUpdateIntegrationConfig();
  const items: { key: keyof typeof rules; label: string }[] = [
    { key: "byEmail", label: t("integrations.dedupe.byEmail") },
    { key: "byPhone", label: t("integrations.dedupe.byPhone") },
    { key: "byExternalId", label: t("integrations.dedupe.byExternalId") },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("integrations.dedupe.intro")}</p>
      {items.map((it) => (
        <label key={it.key} className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!rules[it.key]} disabled={!canEdit}
            onChange={(e) => setRules((p: any) => ({ ...p, [it.key]: e.target.checked }))} />
          {it.label}
        </label>
      ))}
      {canEdit && (
        <Button size="sm" onClick={() => update.mutate({ id: integration.id, req: { dedupeConfig: JSON.stringify(rules) } })}>
          {t("integrations.dedupe.saveRules")}
        </Button>
      )}
    </div>
  );
}

function RoutingTab({ integration, canEdit }: { integration: any; canEdit: boolean }) {
  const { t } = useTranslation("settings");
  const parsed = safeParse(integration.routingConfig, { mode: "fixed", assignTo: "", pool: [] as string[] });
  const [routing, setRouting] = React.useState(parsed);
  const update = useUpdateIntegrationConfig();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("integrations.routing.intro")}</p>
      <select className="bg-card border border-border rounded-md px-2 py-2 text-sm w-full" value={routing.mode} disabled={!canEdit}
        onChange={(e) => setRouting((p: any) => ({ ...p, mode: e.target.value }))}>
        <option value="fixed">{t("integrations.routing.fixed")}</option>
        <option value="round_robin">{t("integrations.routing.roundRobin")}</option>
        <option value="unassigned">{t("integrations.routing.unassigned")}</option>
      </select>
      {routing.mode === "fixed" && (
        <Input placeholder={t("integrations.routing.assignToPlaceholder")} value={routing.assignTo ?? ""} disabled={!canEdit}
          onChange={(e) => setRouting((p: any) => ({ ...p, assignTo: e.target.value }))} />
      )}
      {routing.mode === "round_robin" && (
        <Input placeholder={t("integrations.routing.poolPlaceholder")} value={(routing.pool ?? []).join(",")} disabled={!canEdit}
          onChange={(e) => setRouting((p: any) => ({ ...p, pool: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))} />
      )}
      {canEdit && (
        <Button size="sm" onClick={() => update.mutate({ id: integration.id, req: { routingConfig: JSON.stringify(routing) } })}>
          {t("integrations.routing.saveRouting")}
        </Button>
      )}
    </div>
  );
}

function HistoryTab({ integrationId }: { integrationId: string }) {
  const { t } = useTranslation("settings");
  const { data: logs = [], isLoading } = useIntegrationSyncLogs(integrationId);
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (!logs.length) return <Empty text={t("integrations.history.empty")} />;
  return (
    <div className="space-y-2">
      {logs.map((l) => (
        <div key={l.id} className="bg-card border border-border rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium capitalize">{l.trigger}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full",
              l.status === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
              {syncStatusLabel(t, l.status)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {t("integrations.history.summary", {
              created: l.created, duplicates: l.duplicates, failed: l.failed,
              when: formatDate(l.startedAt, "relative"),
            })}
          </div>
          {l.message && <div className="text-xs text-destructive mt-1">{l.message}</div>}
        </div>
      ))}
    </div>
  );
}

function ErrorsTab({ integrationId }: { integrationId: string }) {
  const { t } = useTranslation("settings");
  const { data: rows = [], isLoading } = useIntegrationInbox(integrationId);
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (!rows.length) return <Empty text={t("integrations.errors.empty")} />;
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
              : "bg-amber-500/10 text-amber-600")}>
              {syncStatusLabel(t, r.status)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {t("integrations.errors.attempts", { n: r.attempts, when: formatDate(r.receivedAt, "relative") })}
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
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { data: pages = [], isLoading } = useMetaPages(integrationId, true);
  const select = useSelectMetaTargets();
  const startOAuth = useStartMetaOAuth();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [forms, setForms] = React.useState<Record<string, MetaForm[]>>({});
  const [picked, setPicked] = React.useState<Record<string, Set<string>>>({});

  async function reauthorize() {
    try {
      const { url } = await startOAuth.mutateAsync(integrationId);
      window.location.href = url;   // re-consent to refresh granted permissions
    } catch { /* hook toasts */ }
  }

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
    if (!selections.length) { toast.error(t("integrations.meta.selectAtLeastOne")); return; }
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
            <h2 className="font-semibold">{t("integrations.meta.title")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("integrations.meta.subtitle")}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto my-8" />
            : pages.length === 0 ? <Empty text={t("integrations.meta.noPages")} />
            : pages.map((page) => (
              <div key={page.pageId} className="border border-border rounded-lg">
                <button className="w-full flex items-center justify-between p-3 text-sm font-medium" onClick={() => toggleExpand(page.pageId)}>
                  <span>{page.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(picked[page.pageId]?.size ?? 0) > 0
                      ? t("integrations.meta.selectedCount", { n: picked[page.pageId].size })
                      : t("integrations.meta.selectForms")}
                  </span>
                </button>
                {expanded === page.pageId && (
                  <div className="px-3 pb-3 space-y-1.5 border-t border-border pt-2">
                    {!forms[page.pageId] ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      : forms[page.pageId].length === 0 ? <p className="text-xs text-muted-foreground">{t("integrations.meta.noForms")}</p>
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

        <div className="p-4 border-t border-border flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5" disabled={startOAuth.isPending} onClick={reauthorize}>
            {startOAuth.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t("integrations.meta.reauthorize")}
          </Button>
          <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>{tc("action.cancel")}</Button>
          <Button size="sm" disabled={select.isPending} onClick={save}>
            {select.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("integrations.meta.connectSelected")}
          </Button>
          </div>
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
