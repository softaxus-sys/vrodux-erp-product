import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Loader2, Layers, Cloud, Server,
  Factory, UserCog, Mail, CheckCircle2, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  tenantsAdminApi,
  type PlanType,
  type DeploymentType,
} from "@/lib/admin/tenants.api";
import { ModuleSelector, PLAN_DEFAULTS, moduleSetsEqual } from "./module-selector";
import { INDUSTRY_OPTIONS } from "@/config/industry-packs";
import { COUNTRIES } from "@/lib/onboarding/geo-data";

// Public tiers and list prices — mirrors vrodux.com/pricing and the backend PlanDefinitions.
// Annual rates shown in the description are the discounted per-month equivalents.
const PLANS: { value: PlanType; label: string; desc: string; color: string }[] = [
  { value: "Micro",        label: "Micro",        color: "text-gray-600",   desc: "3 users · $159/mo · $129/mo billed annually"  },
  { value: "Starter",      label: "Starter",      color: "text-sky-600",    desc: "10 users · $299/mo · $249/mo billed annually" },
  { value: "Professional", label: "Professional", color: "text-blue-600",   desc: "50 users · $849/mo · $699/mo billed annually · POS, Restaurant, Hospitality" },
  { value: "Enterprise",   label: "Enterprise",   color: "text-violet-600", desc: "Unlimited users & modules · custom pricing"   },
];

const DEPLOYMENTS: { value: DeploymentType; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "Cloud",      label: "Cloud",       desc: "Vrodux hosts the database",       icon: Cloud  },
  { value: "OnPremises", label: "On-Premises", desc: "Client provides their own server", icon: Server },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Section card wrapper for a clean, scannable form. */
function Section({
  step, icon: Icon, title, desc, children,
}: {
  step: number; icon: React.ElementType; title: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Step {step}</span>
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {desc && <p className="text-[12px] text-muted-foreground">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function CreateTenantPage() {
  const navigate = useNavigate();

  // ── Fields ────────────────────────────────────────────────────────────────
  const [name,         setName]         = React.useState("");
  const [slug,         setSlug]         = React.useState("");
  const [slugManual,   setSlugManual]   = React.useState(false);
  const [plan,         setPlan]         = React.useState<PlanType>("Starter");
  const [deployment,   setDeployment]   = React.useState<DeploymentType>("Cloud");
  const [contactEmail, setContactEmail] = React.useState("");
  const [country,      setCountry]      = React.useState("");
  const [industry,     setIndustry]     = React.useState("");
  const [startTrial,   setStartTrial]   = React.useState(true);

  const [adminEmail,    setAdminEmail]    = React.useState("");
  const [adminUsername, setAdminUsername] = React.useState("");
  const [adminPassword, setAdminPassword] = React.useState("");
  const [showAdminPassword, setShowAdminPassword] = React.useState(false);

  const [selectedModules, setSelectedModules] = React.useState<string[]>(() => PLAN_DEFAULTS["Starter"]);

  const [saving, setSaving] = React.useState(false);
  const [error,  setError]  = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!slugManual) setSlug(slugify(name));
  }, [name, slugManual]);

  React.useEffect(() => {
    setSelectedModules(prev => {
      const isCustom = !Object.values(PLAN_DEFAULTS).some(d => moduleSetsEqual(prev, d));
      return isCustom ? prev : PLAN_DEFAULTS[plan];
    });
  }, [plan]);

  const isCustom    = !moduleSetsEqual(selectedModules, PLAN_DEFAULTS[plan] ?? []);
  const industryLbl = INDUSTRY_OPTIONS.find(o => o.value === industry)?.label;
  const wantAdmin   = !!(adminEmail.trim() || adminUsername.trim() || adminPassword);
  const canSubmit   = !!name.trim() && !!slug.trim() && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError("Company name and slug are required.");
      return;
    }
    if (wantAdmin && (!adminEmail.trim() || !adminUsername.trim())) {
      setError("To create the tenant admin, email and username are required. Leave the password blank to email the owner an activation link.");
      return;
    }
    if (wantAdmin && adminPassword && adminPassword.length < 8) {
      setError("If you set a password, it must be at least 8 characters. Leave it blank to send an activation link instead.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let tenant = await tenantsAdminApi.create({
        name:           name.trim(),
        slug:           slug.trim(),
        plan,
        deploymentType: deployment,
        contactEmail:   contactEmail.trim() || undefined,
        country:        country.trim() || undefined,
        industry:       industry || undefined,
        startTrial,
        adminEmail:     adminEmail.trim() || undefined,
        adminUsername:  adminUsername.trim() || undefined,
        adminPassword:  adminPassword || undefined,
      });

      const isDefault = moduleSetsEqual(selectedModules, PLAN_DEFAULTS[plan] ?? []);
      if (!isDefault) {
        tenant = await tenantsAdminApi.setModules(tenant.id, { modules: selectedModules });
      }

      toast.success(`Tenant "${tenant.name}" created${wantAdmin ? " with admin user" : ""}.`);
      navigate("/super-admin");
    } catch (err: any) {
      setError(err?.message ?? "Failed to create tenant.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-auto bg-muted/20">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/super-admin")}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Back to tenants"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-foreground truncate">Create New Tenant</h1>
              <p className="text-[12px] text-muted-foreground">Provision an organization, its plan, industry pack and admin user.</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/super-admin")}>Cancel</Button>
            <Button type="submit" form="create-tenant-form" size="sm" disabled={!canSubmit}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5 mr-1.5" />}
              Create Tenant
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <form id="create-tenant-form" onSubmit={handleSubmit} className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">

            <Section step={1} icon={Building2} title="Company Identity" desc="Display name and the URL-safe slug used in API paths.">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Company Name *</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corporation" required className="h-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Slug *</label>
                  <Input
                    value={slug}
                    onChange={e => { setSlug(slugify(e.target.value)); setSlugManual(true); }}
                    placeholder="acme-corporation"
                    required
                    className="h-10 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">Lowercase letters, numbers, hyphens.</p>
                </div>
              </div>
            </Section>

            <Section step={2} icon={Layers} title="Plan & Deployment" desc="Subscription tier and where the database lives.">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PLANS.map(p => (
                    <label key={p.value} className={cn(
                      "flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition-colors",
                      plan === p.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-border/80"
                    )}>
                      <div className="flex items-center gap-2">
                        <input type="radio" name="plan" value={p.value} checked={plan === p.value} onChange={() => setPlan(p.value)} className="accent-primary" />
                        <span className={cn("text-sm font-semibold", p.color)}>{p.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{p.desc}</p>
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEPLOYMENTS.map(d => (
                    <label key={d.value} className={cn(
                      "flex flex-col gap-0.5 p-3 rounded-xl border cursor-pointer transition-colors",
                      deployment === d.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-border/80"
                    )}>
                      <div className="flex items-center gap-2">
                        <input type="radio" name="deployment" value={d.value} checked={deployment === d.value} onChange={() => setDeployment(d.value)} className="accent-primary" />
                        <d.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{d.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground pl-6">{d.desc}</p>
                    </label>
                  ))}
                </div>
              </div>
            </Section>

            <Section step={3} icon={Factory} title="Industry Pack" desc="Activates industry screens on top of the core CRM.">
              <select value={industry} onChange={e => setIndustry(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {INDUSTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground">
                {industry
                  ? `Activates the ${industryLbl} pack — adds industry entities, dashboards and menu on top of CRM.`
                  : "Generic tenant — core CRM only, no industry pack."}
              </p>
            </Section>

            <Section step={4} icon={Layers} title="Module Access" desc="Defaults match the plan. Click a chip to toggle.">
              {isCustom && (
                <span className="inline-block text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  Custom override active
                </span>
              )}
              <ModuleSelector selected={selectedModules} onChange={setSelectedModules} planDefaults={PLAN_DEFAULTS[plan]} />
            </Section>

            <Section step={5} icon={UserCog} title="Tenant Admin User" desc="Optional. First login account for this tenant (Administrator role).">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Admin Email{wantAdmin && " *"}</label>
                  <Input value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="owner@acme.com" type="email" className="h-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Username{wantAdmin && " *"}</label>
                  <Input value={adminUsername} onChange={e => setAdminUsername(e.target.value)} placeholder="acme-admin" className="h-10" />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-foreground">Password <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <div className="relative">
                    <Input
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder="Leave blank to email an activation link"
                      type={showAdminPassword ? "text" : "password"}
                      className="h-10 pe-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowAdminPassword(v => !v)}
                      aria-label={showAdminPassword ? "Hide password" : "Show password"}
                      title={showAdminPassword ? "Hide password" : "Show password"}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {adminPassword
                      ? "The owner logs in with this password (you'll need to share it)."
                      : "Recommended — leave blank and the owner gets an email to set their own password and activate."}
                  </p>
                </div>
              </div>
            </Section>

            <Section step={6} icon={Mail} title="Contact" desc="Billing / notification details (optional).">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Contact Email</label>
                  <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="admin@acme.com" type="email" className="h-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Country</label>
                  <select value={country} onChange={e => setCountry(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Select a country…</option>
                    {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </Section>
          </div>

          {/* Summary sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-[84px] space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Summary</h3>

                <div className="space-y-2.5 text-sm">
                  <Row label="Name"     value={name || "—"} />
                  <Row label="Slug"     value={slug ? <code className="text-xs">{slug}</code> : "—"} />
                  <Row label="Plan"     value={plan} />
                  <Row label="Deploy"   value={deployment} />
                  <Row label="Industry" value={industry ? (industryLbl ?? industry) : "Generic (CRM only)"} />
                  <Row label="Modules"  value={`${selectedModules.length}${isCustom ? " (custom)" : " (plan default)"}`} />
                  <Row label="Admin"    value={wantAdmin ? (adminEmail || "set") : "None"} />
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-border mt-1">
                  <input type="checkbox" checked={startTrial} onChange={e => setStartTrial(e.target.checked)} className="accent-primary" />
                  <span className="text-sm text-foreground">Start 30-day free trial</span>
                </label>

                {industry && (
                  <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{industryLbl}</span> pack + core CRM will be enabled for this tenant.
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
                )}

                <Button type="submit" form="create-tenant-form" className="w-full" disabled={!canSubmit}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Building2 className="h-4 w-4 mr-2" />}
                  Create Tenant
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/super-admin")}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-[12px]">{label}</span>
      <span className="text-foreground font-medium text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}
