import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Building2, Plus, Search, Users, Server, Cloud,
  ShieldCheck, AlertTriangle, ChevronRight, RefreshCw,
  Loader2, MoreVertical, Key, Link, Trash2, Ban,
  CheckCircle, Clock, X, Edit, Copy, ExternalLink, LogIn, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, parseApiDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  tenantsAdminApi,
  type TenantDto,
  type PlanType,
  type DeploymentType,
  type TenantStatus,
  planLimits,
  ASSIGNABLE_PLANS,
} from "@/lib/admin/tenants.api";
import { DeletedTenantsPanel, useDeletedTenantCount } from "./deleted-tenants-panel";

// ── Status / plan config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TenantStatus, { label: string; color: string; bg: string; dot: string }> = {
  Trial:     { label: "Trial",     color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-900/20",  dot: "bg-amber-500"  },
  Active:    { label: "Active",    color: "text-emerald-600",bg: "bg-emerald-50 dark:bg-emerald-900/20",dot:"bg-emerald-500"},
  Suspended: { label: "Suspended", color: "text-red-600",    bg: "bg-red-50 dark:bg-red-900/20",       dot: "bg-red-500"    },
  Expired:   { label: "Expired",   color: "text-gray-500",   bg: "bg-gray-100 dark:bg-gray-800",       dot: "bg-gray-400"   },
};

const PLAN_COLOR: Record<PlanType, string> = {
  Micro:        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  Starter:      "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  Professional: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Enterprise:   "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  // Legacy alias — pre-rename rows still report "Business".
  Business:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TenantStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.Trial;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", c.color, c.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />{c.label}
    </span>
  );
}

function PlanBadge({ plan }: { plan: PlanType }) {
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold", PLAN_COLOR[plan])}>
      {plan}
    </span>
  );
}

function DeploymentIcon({ type }: { type: DeploymentType }) {
  return type === "Cloud"
    ? <Cloud className="h-3.5 w-3.5 text-blue-500" />
    : <Server className="h-3.5 w-3.5 text-orange-500" />;
}

function StatCard({ label, value, sub, icon: Icon, iconBg }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; iconBg: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/70">{sub}</p>}
      </div>
    </div>
  );
}

// ── Tenant card ───────────────────────────────────────────────────────────────

function TenantCard({ tenant, onClick, onEnter, entering }: {
  tenant: TenantDto; onClick: () => void; onEnter: () => void; entering: boolean;
}) {
  const limits = planLimits(tenant.plan);
  const userPct = limits.maxUsers > 0
    ? Math.min(100, Math.round((0 / limits.maxUsers) * 100))
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: tenant.primaryColor ?? "#6366f1" }}
          >
            {tenant.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{tenant.name}</p>
            <p className="text-xs text-muted-foreground font-mono">/{tenant.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <DeploymentIcon type={tenant.deploymentType} />
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center flex-wrap gap-1.5 mb-3">
        <StatusBadge status={tenant.status} />
        <PlanBadge plan={tenant.plan} />
        {tenant.country && (
          <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {tenant.country}
          </span>
        )}
      </div>

      {/* Limits */}
      <div className="text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>
            {limits.maxUsers < 0 ? "Unlimited users" : `${limits.maxUsers} users max`}
          </span>
        </div>
        {tenant.deploymentType === "OnPremises" && (
          <div className="flex items-center gap-1">
            {tenant.hasLicenseKey
              ? <ShieldCheck className="h-3 w-3 text-emerald-500" />
              : <AlertTriangle className="h-3 w-3 text-amber-500" />}
            <span>{tenant.hasLicenseKey ? "Licensed" : "No license"}</span>
          </div>
        )}
        {tenant.trialEndsAt && tenant.status === "Trial" && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-500" />
            <span>Trial ends {parseApiDate(tenant.trialEndsAt).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Contact */}
      {tenant.contactEmail && (
        <p className="text-[11px] text-muted-foreground/70 truncate mt-2 pt-2 border-t border-border/50">
          {tenant.contactEmail}
        </p>
      )}

      {/* Open tenant (impersonate) — view this tenant's actual records, scoped */}
      <Button
        size="sm"
        variant="outline"
        className="w-full mt-3"
        disabled={entering}
        onClick={(e) => { e.stopPropagation(); onEnter(); }}
      >
        {entering
          ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          : <LogIn className="h-3.5 w-3.5 mr-1.5" />}
        Open tenant
      </Button>
    </motion.div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function SuperAdminView() {
  const [tenants, setTenants] = React.useState<TenantDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch]   = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<TenantStatus | "All">("All");
  const [filterPlan, setFilterPlan]     = React.useState<PlanType | "All">("All");

  const navigate = useNavigate();
  const enterImpersonation = useAuthStore((s) => s.enterImpersonation);
  const [entering, setEntering] = React.useState<string | null>(null);

  // Recycle bin. `binVersion` bumps whenever the bin's contents could have changed (a delete
  // here, or a restore/purge inside the panel) so the badge count refetches.
  const [binOpen, setBinOpen]         = React.useState(false);
  const [binVersion, setBinVersion]   = React.useState(0);
  const deletedCount = useDeletedTenantCount(binVersion);

  const handleEnter = React.useCallback(async (t: TenantDto) => {
    try {
      setEntering(t.id);
      const res = await tenantsAdminApi.impersonate(t.id);
      enterImpersonation(res.accessToken, {
        tenantId: res.tenantId, tenantName: res.tenantName, tenantSlug: res.tenantSlug,
      });
      toast.success(`Now viewing ${res.tenantName}`);
      navigate("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open tenant.");
    } finally {
      setEntering(null);
    }
  }, [enterImpersonation, navigate]);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await tenantsAdminApi.getAll();
      setTenants(data);
    } catch {
      // silent — error state handled inline
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return tenants.filter(t => {
      if (filterStatus !== "All" && t.status !== filterStatus) return false;
      if (filterPlan   !== "All" && t.plan   !== filterPlan)   return false;
      if (q && !t.name.toLowerCase().includes(q) &&
               !t.slug.toLowerCase().includes(q) &&
               !(t.contactEmail ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tenants, search, filterStatus, filterPlan]);

  // Stats
  const stats = React.useMemo(() => ({
    total:     tenants.length,
    active:    tenants.filter(t => t.status === "Active").length,
    trial:     tenants.filter(t => t.status === "Trial").length,
    onPrem:    tenants.filter(t => t.deploymentType === "OnPremises").length,
    suspended: tenants.filter(t => t.status === "Suspended").length,
  }), [tenants]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Tenant Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Super-admin · Manage all client tenants, plans, and licenses
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/super-admin/billing")}>
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              Billing Setup
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings/security")}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              Security (2FA)
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBinOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Recycle bin
              {deletedCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-semibold">
                  {deletedCount}
                </span>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate("/super-admin/tenants/new")}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Tenant
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 pt-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <StatCard label="Total Tenants" value={stats.total}  icon={Building2}    iconBg="bg-primary/10 text-primary" />
        <StatCard label="Active"        value={stats.active} icon={CheckCircle}  iconBg="bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600" />
        <StatCard label="On Trial"      value={stats.trial}  icon={Clock}        iconBg="bg-amber-100 dark:bg-amber-900/20 text-amber-600" />
        <StatCard label="On-Premises"   value={stats.onPrem} icon={Server}       iconBg="bg-orange-100 dark:bg-orange-900/20 text-orange-600" />
      </div>

      {/* Filters */}
      <div className="px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tenants…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1">
          {(["All", "Trial", "Active", "Suspended", "Expired"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                filterStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Plan filter */}
        <div className="flex items-center gap-1">
          {(["All", ...ASSIGNABLE_PLANS] as const).map(p => (
            <button
              key={p}
              onClick={() => setFilterPlan(p)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                filterPlan === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading tenants…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Building2 className="h-8 w-8 opacity-30" />
            <p className="text-sm">{tenants.length === 0 ? "No tenants yet. Create the first one." : "No tenants match your search."}</p>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence mode="popLayout">
              {filtered.map(t => (
                <TenantCard
                  key={t.id}
                  tenant={t}
                  onClick={() => navigate(`/super-admin/tenants/${t.id}`)}
                  onEnter={() => handleEnter(t)}
                  entering={entering === t.id}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <DeletedTenantsPanel
        open={binOpen}
        // Closing re-reads the count: a purge inside the panel changes it without a restore.
        onClose={() => { setBinOpen(false); setBinVersion(v => v + 1); }}
        onRestored={() => { load(); setBinVersion(v => v + 1); }}
      />
    </div>
  );
}
