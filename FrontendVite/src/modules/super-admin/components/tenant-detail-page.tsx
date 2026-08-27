import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Key, Server, Cloud, Users, Warehouse,
  ShieldCheck, AlertTriangle, CheckCircle, Ban, Edit, Save,
  Trash2, Copy, Link,
  CalendarDays, RefreshCw, ShieldOff, Layers, RotateCcw, Factory,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, parseApiDate } from "@/lib/utils";
import {
  tenantsAdminApi,
  type TenantDto,
  type PlanType,
  planLimits,
  ASSIGNABLE_PLANS,
} from "@/lib/admin/tenants.api";
import { ModuleSelector, PLAN_DEFAULTS, moduleSetsEqual } from "./module-selector";
import { INDUSTRY_OPTIONS } from "@/config/industry-packs";

// ── License Panel ─────────────────────────────────────────────────────────────

function LicensePanel({ tenant, onUpdated }: { tenant: TenantDto; onUpdated: (t: TenantDto) => void }) {
  const [validityDays, setValidityDays] = React.useState(365);
  const [generating,   setGenerating]   = React.useState(false);
  const [licenseKey,   setLicenseKey]   = React.useState<string | null>(null);
  const [error,        setError]        = React.useState<string | null>(null);
  const [copied,       setCopied]       = React.useState(false);

  const generate = async () => {
    try {
      setGenerating(true);
      setError(null);
      const resp = await tenantsAdminApi.generateLicense(tenant.id, {
        validityDays,
        features: planLimits(tenant.plan).maxUsers < 0
          ? ["pos", "inventory", "reports", "hr", "crm", "finance", "api"]
          : ["pos", "inventory", "reports"],
      });
      setLicenseKey(resp.licenseKey);
      const updated = await tenantsAdminApi.getById(tenant.id);
      onUpdated(updated);
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate license.");
    } finally {
      setGenerating(false);
    }
  };

  const copy = () => {
    if (!licenseKey) return;
    navigator.clipboard.writeText(licenseKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-foreground">License Key</span>
        </div>
        {tenant.hasLicenseKey ? (
          <span className="text-[11px] text-emerald-600 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Active · expires {tenant.licenseExpiresAt ? parseApiDate(tenant.licenseExpiresAt).toLocaleDateString() : "—"}
          </span>
        ) : (
          <span className="text-[11px] text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> No license
          </span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="space-y-1 flex-1">
          <label className="text-[11px] text-muted-foreground">Validity (days)</label>
          <Input type="number" min={30} max={3650} value={validityDays}
            onChange={e => setValidityDays(parseInt(e.target.value) || 365)} className="h-8 text-sm w-28" />
        </div>
        <Button size="sm" onClick={generate} disabled={generating} className="h-8">
          {generating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Key className="h-3.5 w-3.5 mr-1.5" />}
          {tenant.hasLicenseKey ? "Renew" : "Generate"}
        </Button>
      </div>

      {licenseKey && (
        <div className="bg-muted rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-foreground">New License Key</span>
            <button onClick={copy} className="text-[11px] text-primary flex items-center gap-1">
              <Copy className="h-3 w-3" />{copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground break-all select-all">{licenseKey}</p>
          <p className="text-[11px] text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 shrink-0" /> Copy this key now — it won't be shown again.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Cloud Subscription Panel ──────────────────────────────────────────────────

function CloudSubscriptionPanel({ tenant, onUpdated }: { tenant: TenantDto; onUpdated: (t: TenantDto) => void }) {
  const defaultExpiry = (() => {
    const base = tenant.licenseExpiresAt && new Date(tenant.licenseExpiresAt) > new Date()
      ? new Date(tenant.licenseExpiresAt) : new Date();
    base.setFullYear(base.getFullYear() + 1);
    return base.toISOString().split("T")[0];
  })();

  const [expiryDate, setExpiryDate] = React.useState(defaultExpiry);
  const [saving,     setSaving]     = React.useState(false);
  const [expiring,   setExpiring]   = React.useState(false);
  const [confirmExp, setConfirmExp] = React.useState(false);
  const [error,      setError]      = React.useState<string | null>(null);
  const [saved,      setSaved]      = React.useState(false);

  const isExpired = tenant.licenseExpiresAt ? new Date(tenant.licenseExpiresAt) < new Date() : false;

  const renew = async () => {
    try {
      setSaving(true); setError(null);
      const updated = await tenantsAdminApi.renewSubscription(tenant.id, { expiresAt: new Date(expiryDate).toISOString() });
      onUpdated(updated); setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (err: any) { setError(err?.message ?? "Failed to renew subscription."); }
    finally { setSaving(false); }
  };

  const forceExpire = async () => {
    try {
      setExpiring(true); setError(null);
      const updated = await tenantsAdminApi.expire(tenant.id);
      onUpdated(updated); setConfirmExp(false);
    } catch (err: any) { setError(err?.message ?? "Failed to expire tenant."); }
    finally { setExpiring(false); }
  };

  return (
    <div className="space-y-4">
      <div className={cn("rounded-xl border p-4 flex items-start gap-3",
        tenant.status === "Active" && !isExpired ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200")}>
        {tenant.status === "Active" && !isExpired
          ? <ShieldCheck className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
          : <ShieldOff className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />}
        <div>
          <p className="text-sm font-semibold text-foreground">
            {tenant.status === "Active" && !isExpired ? "Subscription Active" : "Subscription Inactive"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tenant.licenseExpiresAt
              ? `${isExpired ? "Expired" : "Expires"}: ${parseApiDate(tenant.licenseExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
              : "No expiry date set — tenant is on trial or has no active plan."}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Set Subscription Expiry</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Setting an expiry date activates the tenant. After expiry, all API requests are blocked automatically.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] text-muted-foreground">Expiry Date (UTC)</label>
            <input type="date" value={expiryDate} min={new Date().toISOString().split("T")[0]}
              onChange={e => setExpiryDate(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <Button size="sm" onClick={renew} disabled={saving || !expiryDate} className="h-8">
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : saved ? <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-emerald-100" />
              : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            {saved ? "Renewed!" : tenant.licenseExpiresAt ? "Renew" : "Activate"}
          </Button>
        </div>
      </div>

      <div className="pt-3 border-t border-border">
        {!confirmExp ? (
          <Button size="sm" variant="outline"
            className="h-8 text-xs w-full border-destructive/50 text-destructive hover:bg-destructive/5"
            onClick={() => setConfirmExp(true)}>
            <ShieldOff className="h-3.5 w-3.5 mr-1.5" /> Force Expire Now
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-destructive font-medium">This immediately blocks all access for this tenant. Confirm?</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={expiring} className="h-8 text-xs flex-1" onClick={forceExpire}>
                {expiring ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null} Yes, Expire Now
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setConfirmExp(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Connection Strings Panel ──────────────────────────────────────────────────

function ConnectionStringsPanel({ tenant, onUpdated }: { tenant: TenantDto; onUpdated: (t: TenantDto) => void }) {
  const [identityDb,  setIdentityDb]  = React.useState("");
  const [posDb,       setPosDb]       = React.useState("");
  const [inventoryDb, setInventoryDb] = React.useState("");
  const [saving,      setSaving]      = React.useState(false);
  const [error,       setError]       = React.useState<string | null>(null);
  const [saved,       setSaved]       = React.useState(false);

  const save = async () => {
    if (!identityDb.trim() || !posDb.trim() || !inventoryDb.trim()) return;
    try {
      setSaving(true); setError(null);
      const updated = await tenantsAdminApi.setConnectionStrings(tenant.id, {
        identityDb: identityDb.trim(), posDb: posDb.trim(), inventoryDb: inventoryDb.trim(),
      });
      onUpdated(updated); setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err: any) { setError(err?.message ?? "Failed to save connection strings."); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium text-foreground">Connection Strings</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        On-premises database connection strings. These are stored encrypted on the server.
      </p>
      {[
        { label: "Identity DB", value: identityDb, set: setIdentityDb, placeholder: "Server=...;Database=Vrodux_Acme_IdentityDB;..." },
        { label: "POS DB",      value: posDb,       set: setPosDb,       placeholder: "Server=...;Database=Vrodux_Acme_PosDB;..."      },
        { label: "Inventory DB",value: inventoryDb, set: setInventoryDb, placeholder: "Server=...;Database=Vrodux_Acme_InventoryDB;..." },
      ].map(f => (
        <div key={f.label} className="space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">{f.label}</label>
          <Input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} className="h-8 text-xs font-mono" />
        </div>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="sm" onClick={save} disabled={saving} className="h-8">
        {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          : saved ? <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
          : <Save className="h-3.5 w-3.5 mr-1.5" />}
        {saved ? "Saved!" : "Save Connection Strings"}
      </Button>
    </div>
  );
}

// ── Modules Panel ─────────────────────────────────────────────────────────────

function ModulesPanel({ tenant, onUpdated }: { tenant: TenantDto; onUpdated: (t: TenantDto) => void }) {
  const planDefaults = PLAN_DEFAULTS[tenant.plan] ?? [];
  const currentModules: string[] = tenant.resolvedModules ?? planDefaults;

  const [editing,         setEditing]         = React.useState(false);
  const [selectedModules, setSelectedModules] = React.useState<string[]>(currentModules);
  const [saving,          setSaving]          = React.useState(false);
  const [resetting,       setResetting]       = React.useState(false);
  const [error,           setError]           = React.useState<string | null>(null);
  const [saved,           setSaved]           = React.useState(false);

  React.useEffect(() => {
    setSelectedModules(tenant.resolvedModules ?? PLAN_DEFAULTS[tenant.plan] ?? []);
  }, [tenant.id, tenant.plan, tenant.resolvedModules]);

  const isUsingPlanDefaults = moduleSetsEqual(currentModules, planDefaults);
  const hasChanges = !moduleSetsEqual(selectedModules, currentModules);

  const save = async () => {
    try {
      setSaving(true); setError(null);
      const modules = moduleSetsEqual(selectedModules, planDefaults) ? null : selectedModules;
      const updated = await tenantsAdminApi.setModules(tenant.id, { modules });
      onUpdated(updated); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (err: any) { setError(err?.message ?? "Failed to save modules."); }
    finally { setSaving(false); }
  };

  const resetToDefaults = async () => {
    try {
      setResetting(true); setError(null);
      const updated = await tenantsAdminApi.setModules(tenant.id, { modules: null });
      onUpdated(updated); setEditing(false);
    } catch (err: any) { setError(err?.message ?? "Reset failed."); }
    finally { setResetting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Module Access</span>
            {!isUsingPlanDefaults
              ? <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Custom override</span>
              : <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Plan defaults</span>}
          </div>
          <p className="text-[11px] text-muted-foreground pl-6">
            {currentModules.length} module{currentModules.length !== 1 ? "s" : ""} enabled
            {isUsingPlanDefaults ? ` (${tenant.plan} plan defaults)` : " (custom override)"}
          </p>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => { setSelectedModules(currentModules); setEditing(true); }}>
            <Edit className="h-3 w-3 mr-1" /> Edit
          </Button>
        )}
      </div>

      {!editing && (
        <div className="space-y-3">
          <ModuleSelector selected={currentModules} onChange={() => {}} readOnly />
          {saved && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Module access updated.</p>}
          {!isUsingPlanDefaults && (
            <div className="pt-2 border-t border-border">
              <Button size="sm" variant="outline" className="h-7 text-xs text-muted-foreground" disabled={resetting} onClick={resetToDefaults}>
                {resetting ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1.5" />}
                Reset to {tenant.plan} plan defaults
              </Button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border p-3 bg-muted/20">
            <ModuleSelector selected={selectedModules} onChange={setSelectedModules} planDefaults={planDefaults} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {hasChanges ? `${selectedModules.length} module${selectedModules.length !== 1 ? "s" : ""} selected — unsaved changes` : "No changes."}
            </p>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>
              <Button size="sm" className="h-8 text-xs" disabled={saving || !hasChanges} onClick={save}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />} Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-5 sm:p-6", className)}>{children}</div>;
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PLANS: PlanType[] = [...ASSIGNABLE_PLANS];

export function TenantDetailPage() {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();

  const [tenant,  setTenant]  = React.useState<TenantDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"overview" | "modules" | "license" | "subscription" | "connections">("overview");

  // profile edit
  const [editing, setEditing] = React.useState(false);
  const [name,    setName]    = React.useState("");
  const [email,   setEmail]   = React.useState("");
  const [phone,   setPhone]   = React.useState("");
  const [country, setCountry] = React.useState("");
  const [color,   setColor]   = React.useState("#6366f1");
  const [saving,  setSaving]  = React.useState(false);

  const [changingPlan, setChangingPlan] = React.useState(false);
  // Picking a tier only STAGES it — a plan change resizes seat limits and can strip modules
  // from a live tenant, so it must never fire on a single click.
  const [pendingPlan,  setPendingPlan]  = React.useState<PlanType | null>(null);
  const [planSaving,   setPlanSaving]   = React.useState(false);
  const [industrySaving, setIndustrySaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting,      setDeleting]      = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const syncEditFields = (t: TenantDto) => {
    setName(t.name); setEmail(t.contactEmail ?? ""); setPhone(t.contactPhone ?? "");
    setCountry(t.country ?? ""); setColor(t.primaryColor ?? "#6366f1");
  };

  React.useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true); setLoadErr(null);
        const t = await tenantsAdminApi.getById(id);
        setTenant(t); syncEditFields(t);
      } catch (err: any) {
        setLoadErr(err?.message ?? "Failed to load tenant.");
      } finally { setLoading(false); }
    })();
  }, [id]);

  const onUpdated = (t: TenantDto) => { setTenant(t); syncEditFields(t); };

  const saveProfile = async () => {
    if (!tenant) return;
    try {
      setSaving(true);
      const updated = await tenantsAdminApi.update(tenant.id, {
        name, contactEmail: email || undefined, contactPhone: phone || undefined,
        country: country || undefined, primaryColor: color || undefined,
      });
      onUpdated(updated); setEditing(false);
    } catch (err: any) { setActionError(err?.message ?? "Update failed."); }
    finally { setSaving(false); }
  };

  const changeIndustry = async (industry: string) => {
    if (!tenant) return;
    try {
      setIndustrySaving(true);
      setActionError(null);
      const updated = await tenantsAdminApi.setIndustry(tenant.id, industry || null);
      onUpdated(updated);
      toast.success(industry
        ? `Industry set to ${INDUSTRY_OPTIONS.find(o => o.value === industry)?.label ?? industry} — pack activated.`
        : "Industry cleared — pack removed.");
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to update industry.");
    } finally {
      setIndustrySaving(false);
    }
  };

  const changePlan = async () => {
    if (!tenant || !pendingPlan) return;
    try {
      setPlanSaving(true);
      setActionError(null);
      const updated = await tenantsAdminApi.changePlan(tenant.id, pendingPlan);
      onUpdated(updated);
      toast.success(`Plan changed to ${pendingPlan}.`);
      setPendingPlan(null);
      setChangingPlan(false);
    } catch (err: any) { setActionError(err?.message ?? "Plan change failed."); }
    finally { setPlanSaving(false); }
  };

  const toggleStatus = async () => {
    if (!tenant) return;
    try {
      setActionError(null);
      const updated = tenant.status === "Suspended"
        ? await tenantsAdminApi.activate(tenant.id)
        : await tenantsAdminApi.suspend(tenant.id);
      onUpdated(updated);
    } catch (err: any) { setActionError(err?.message ?? "Status change failed."); }
  };

  const handleDelete = async () => {
    if (!tenant) return;
    try {
      setDeleting(true);
      await tenantsAdminApi.delete(tenant.id);
      toast.success(`Tenant "${tenant.name}" deleted.`);
      navigate("/super-admin");
    } catch (err: any) { setActionError(err?.message ?? "Delete failed."); setDeleting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading tenant…</span>
      </div>
    );
  }

  if (loadErr || !tenant) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 opacity-40" />
        <p className="text-sm">{loadErr ?? "Tenant not found."}</p>
        <Button size="sm" variant="outline" onClick={() => navigate("/super-admin")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to tenants
        </Button>
      </div>
    );
  }

  const limits        = planLimits(tenant.plan);
  const industryLabel = tenant.industry ? (INDUSTRY_OPTIONS.find(o => o.value === tenant.industry)?.label ?? tenant.industry) : null;

  const tabs = ([
    { id: "overview",     label: "Overview" },
    { id: "modules",      label: "Modules" },
    { id: "subscription", label: "Subscription", show: tenant.deploymentType === "Cloud" },
    { id: "license",      label: "License",      show: tenant.deploymentType === "OnPremises" },
    { id: "connections",  label: "Connections",  show: tenant.deploymentType === "OnPremises" },
  ] as const).filter(t => t.show !== false);

  return (
    <div className="h-full overflow-auto bg-muted/20">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/super-admin")}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Back to tenants">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: tenant.primaryColor ?? "#6366f1" }}>
              {tenant.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm text-foreground truncate">{tenant.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">/{tenant.slug}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-md bg-muted text-foreground font-medium">{tenant.plan}</span>
            <span className="text-xs px-2 py-1 rounded-md bg-muted text-foreground font-medium flex items-center gap-1">
              {tenant.deploymentType === "Cloud" ? <Cloud className="h-3.5 w-3.5 text-blue-500" /> : <Server className="h-3.5 w-3.5 text-orange-500" />}
              {tenant.deploymentType}
            </span>
            {industryLabel && (
              <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-medium flex items-center gap-1">
                <Factory className="h-3.5 w-3.5" />{industryLabel}
              </span>
            )}
          </div>
        </div>
        {/* Tabs */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={cn("px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-5">

        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* left */}
            <div className="lg:col-span-2 space-y-5">
              <Card>
                {!editing ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">Profile</h3>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(true)}>
                        <Edit className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </div>
                    {[
                      { label: "Contact Email", value: tenant.contactEmail },
                      { label: "Contact Phone", value: tenant.contactPhone },
                      { label: "Country",       value: tenant.country },
                      { label: "Industry",      value: industryLabel ?? "Generic (CRM only)" },
                      { label: "Created",       value: parseApiDate(tenant.createdAt).toLocaleDateString() },
                      { label: "Trial Ends",    value: tenant.trialEndsAt ? parseApiDate(tenant.trialEndsAt).toLocaleDateString() : null },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground text-xs">{f.label}</span>
                        <span className="text-foreground text-xs font-medium">{f.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Edit Profile</h3>
                    {[
                      { label: "Name",          value: name,    set: setName,    type: "text"  },
                      { label: "Contact Email", value: email,   set: setEmail,   type: "email" },
                      { label: "Contact Phone", value: phone,   set: setPhone,   type: "text"  },
                      { label: "Country",       value: country, set: setCountry, type: "text"  },
                    ].map(f => (
                      <div key={f.label} className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">{f.label}</label>
                        <Input value={f.value} onChange={e => f.set(e.target.value)} type={f.type} className="h-9 text-sm" />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Brand Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
                        <Input value={color} onChange={e => setColor(e.target.value)} className="h-9 text-sm font-mono flex-1" maxLength={7} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveProfile} disabled={saving} className="h-9">
                        {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditing(false); syncEditFields(tenant); }} className="h-9">Cancel</Button>
                    </div>
                  </div>
                )}
              </Card>

              {/* Plan + limits */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Plan & Limits</h3>
                  <button
                    onClick={() => { setChangingPlan(!changingPlan); setPendingPlan(null); }}
                    className="text-primary text-[11px] hover:underline"
                  >
                    {changingPlan ? "Cancel" : "Change plan"}
                  </button>
                </div>
                {changingPlan && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {PLANS.map(p => {
                        const isCurrent  = p === tenant.plan;
                        const isSelected = p === pendingPlan;
                        return (
                          <button key={p} disabled={isCurrent || planSaving} onClick={() => setPendingPlan(p)}
                            className={cn("p-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-60",
                              isSelected ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40"
                                : isCurrent ? "border-primary/40 bg-muted text-muted-foreground"
                                : "border-border bg-card hover:border-primary/50 text-foreground")}>
                            {p}{isCurrent && <span className="block text-[10px] font-normal">current</span>}
                          </button>
                        );
                      })}
                    </div>

                    {pendingPlan && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
                        <p className="text-xs font-semibold text-foreground">
                          Change plan from {tenant.plan} to {pendingPlan}?
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Seats: {planLimits(tenant.plan).maxUsers < 0 ? "Unlimited" : planLimits(tenant.plan).maxUsers}
                          {" → "}
                          {planLimits(pendingPlan).maxUsers < 0 ? "Unlimited" : planLimits(pendingPlan).maxUsers}
                        </p>
                        {/* A downgrade silently drops modules — the backend intersects the tenant's
                            modules with the plan's, so say so BEFORE the change, not after. */}
                        {(() => {
                          const allowed = PLAN_DEFAULTS[pendingPlan] ?? [];
                          const losing  = (tenant.resolvedModules ?? []).filter(m => !allowed.includes(m));
                          return losing.length > 0 ? (
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">
                              Modules no longer included on {pendingPlan}: <b>{losing.join(", ")}</b>
                            </p>
                          ) : null;
                        })()}
                        <div className="flex gap-2 pt-0.5">
                          <Button size="sm" className="h-8 text-xs flex-1" disabled={planSaving} onClick={changePlan}>
                            {planSaving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                            Confirm change
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={planSaving}
                            onClick={() => setPendingPlan(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Industry pack */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <Factory className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Industry Pack</span>
                    {industrySaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  <select
                    value={tenant.industry ?? ""}
                    disabled={industrySaving}
                    onChange={e => changeIndustry(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                  >
                    {INDUSTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    {tenant.industry
                      ? `Activates the ${industryLabel} pack (+ core CRM) for this tenant.`
                      : "Generic tenant — core CRM only, no industry pack."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div><p className="text-xs text-muted-foreground">Max Users</p>
                      <p className="text-sm font-semibold text-foreground">{limits.maxUsers < 0 ? "Unlimited" : limits.maxUsers}</p></div>
                  </div>
                  <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-muted-foreground" />
                    <div><p className="text-xs text-muted-foreground">Max Warehouses</p>
                      <p className="text-sm font-semibold text-foreground">{limits.maxWarehouses < 0 ? "Unlimited" : limits.maxWarehouses}</p></div>
                  </div>
                </div>
              </Card>
            </div>

            {/* right — danger / status */}
            <div className="lg:col-span-1">
              <Card className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Actions</h3>
                <Button size="sm" variant="outline"
                  className={cn("h-9 text-xs w-full", tenant.status === "Suspended" ? "border-emerald-500 text-emerald-600" : "border-amber-500 text-amber-600")}
                  onClick={toggleStatus}>
                  {tenant.status === "Suspended"
                    ? <><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Reactivate Tenant</>
                    : <><Ban className="h-3.5 w-3.5 mr-1.5" /> Suspend Tenant</>}
                </Button>
                {!confirmDelete ? (
                  <Button size="sm" variant="outline"
                    className="h-9 text-xs w-full border-destructive text-destructive hover:bg-destructive/5"
                    onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Tenant
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-destructive font-medium">Permanently delete this tenant?</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" disabled={deleting} className="h-9 text-xs flex-1" onClick={handleDelete}>
                        {deleting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />} Confirm
                      </Button>
                      <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
                {actionError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{actionError}</p>}
              </Card>
            </div>
          </div>
        )}

        {tab === "modules"      && <Card><ModulesPanel tenant={tenant} onUpdated={onUpdated} /></Card>}
        {tab === "subscription" && tenant.deploymentType === "Cloud"      && <Card><CloudSubscriptionPanel tenant={tenant} onUpdated={onUpdated} /></Card>}
        {tab === "license"      && tenant.deploymentType === "OnPremises" && <Card><LicensePanel tenant={tenant} onUpdated={onUpdated} /></Card>}
        {tab === "connections"  && tenant.deploymentType === "OnPremises" && <Card><ConnectionStringsPanel tenant={tenant} onUpdated={onUpdated} /></Card>}
      </div>
    </div>
  );
}
