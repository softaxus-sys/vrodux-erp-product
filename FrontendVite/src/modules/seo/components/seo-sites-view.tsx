import * as React from "react";
import { toast } from "sonner";
import { Plus, Globe, Rocket, Check, Clock, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useSeoSites, useDeleteSeoSite } from "@/hooks/seo/use-seo";
import type { SiteDto } from "@/lib/seo/seo.api";
import { ConnectSiteWizard } from "./connect-site-wizard";
import { SiteDetailDrawer } from "./site-detail-drawer";

export function SeoSitesView() {
  const { hasRawPermission } = useAuthStore();
  const canCreate = hasRawPermission("seo.sites.create");
  const canDelete = hasRawPermission("seo.sites.delete");

  const { data: sites = [], isLoading } = useSeoSites();
  const deleteSite = useDeleteSeoSite();

  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [resumeSiteId, setResumeSiteId] = React.useState<string | null>(null);
  const [detailSiteId, setDetailSiteId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<SiteDto | null>(null);

  // Google OAuth returns here as a full-page redirect (?provider=google&status=&site=) —
  // resume the wizard at step 3 so the property pickers show right away.
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("provider") !== "google") return;
    const status = p.get("status");
    const site = p.get("site");
    if (status === "connected" && site) { toast.success("Google connected."); setResumeSiteId(site); setWizardOpen(true); }
    else if (status === "error") toast.error("Google connection failed — please try again.");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const stats = React.useMemo(() => ({
    total: sites.length,
    verified: sites.filter(s => s.verificationStatus === "verified").length,
    googleConnected: sites.filter(s => s.googleConnected).length,
  }), [sites]);

  const openNewWizard = () => { setResumeSiteId(null); setWizardOpen(true); };
  const closeWizard = () => { setWizardOpen(false); setResumeSiteId(null); };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Rocket className="h-5 w-5 text-stone-600" />SEO AI Agent
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect a website and let the agent audit it, propose SEO fixes, and apply them once you approve.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openNewWizard} className="gap-1.5">
            <Plus className="h-4 w-4" />Connect a site
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Globe} label="Sites connected" value={stats.total} />
        <StatCard icon={Check} label="Verified" value={stats.verified} tone="success" />
        <StatCard icon={Clock} label="Google connected" value={stats.googleConnected} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : sites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Rocket className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No sites connected yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Connect your first website to start scanning it for SEO issues and let the AI agent propose fixes.
          </p>
          {canCreate && (
            <Button onClick={openNewWizard} className="gap-1.5 mt-4">
              <Plus className="h-4 w-4" />Connect a site
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {sites.map(site => (
            <SiteRow key={site.id} site={site} canDelete={canDelete}
              onOpen={() => setDetailSiteId(site.id)}
              onDelete={() => setPendingDelete(site)} />
          ))}
        </div>
      )}

      <ConnectSiteWizard open={wizardOpen} onClose={closeWizard} siteId={resumeSiteId} initialStep={resumeSiteId ? 3 : 1} />
      <SiteDetailDrawer siteId={detailSiteId} onClose={() => setDetailSiteId(null)} />

      {pendingDelete && (
        <ConfirmDeleteModal
          site={pendingDelete}
          pending={deleteSite.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => deleteSite.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: "success" }) {
  return (
    <div className="rounded-xl border border-border p-4 flex items-center gap-3">
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
        tone === "success" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SiteRow({ site, canDelete, onOpen, onDelete }: { site: SiteDto; canDelete: boolean; onOpen: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors">
      <button onClick={onOpen} className="flex-1 min-w-0 text-left flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-stone-100 dark:bg-stone-900/40 flex items-center justify-center shrink-0">
          <Globe className="h-4 w-4 text-stone-700 dark:text-stone-300" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{site.displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{site.domain}</p>
        </div>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        {site.verificationStatus === "verified" ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success">
            <Check className="h-3 w-3" />Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600">
            <AlertCircle className="h-3 w-3" />Not verified
          </span>
        )}
        <span className="hidden sm:inline text-xs text-muted-foreground">
          {site.lastScanAt ? `Last scan ${formatDate(site.lastScanAt)}` : "Never scanned"}
        </span>
        {canDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" aria-label="Delete site">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ site, pending, onCancel, onConfirm }: { site: SiteDto; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-base font-bold text-foreground">Remove {site.displayName}?</h3>
        <p className="text-sm text-muted-foreground">
          This stops scanning and disconnects Google — approved fixes already applied to your site remain
          until you remove the snippet yourself.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending} className="gap-1.5">
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
