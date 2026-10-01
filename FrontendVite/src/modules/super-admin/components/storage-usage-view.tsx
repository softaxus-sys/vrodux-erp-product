import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { HardDrive, ArrowLeft, Loader2, RefreshCw, AlertTriangle, Users2, FileText, Ticket, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatFileSize } from "@/lib/utils";
import { storageUsageApi, type StorageUsageDto, type TenantStorageUsageDto } from "@/lib/admin/storage-usage.api";

/**
 * Super-admin: per-tenant breakdown of the shared object-storage bucket against its provisioned
 * budget. Visibility only — this screen enforces nothing; it exists so a storage-budget decision
 * (raise the plan, nudge a heavy tenant, add per-tenant caps) can be made with real numbers rather
 * than guessed. The other two agreed storage-budget measures (per-file size caps, server-side
 * image compression before upload) already run on every upload and need no screen of their own.
 */

function moduleTotal(tenants: TenantStorageUsageDto[], key: "hrBytes" | "crmBytes" | "supportBytes" | "realEstateBytes") {
  return tenants.reduce((sum, t) => sum + t[key], 0);
}

function BudgetBar({ used, budget }: { used: number; budget: number }) {
  const pct = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-2xl font-bold">{formatFileSize(used)}</span>
        <span className="text-sm text-muted-foreground">of {formatFileSize(budget)} provisioned</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {pct.toFixed(1)}% used — {formatFileSize(Math.max(0, budget - used))} remaining
      </p>
    </div>
  );
}

function ModuleStat({ icon: Icon, label, bytes }: { icon: React.ElementType; label: string; bytes: number }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-lg font-bold">{formatFileSize(bytes)}</div>
    </div>
  );
}

export function StorageUsageView() {
  const navigate = useNavigate();
  const [data, setData] = React.useState<StorageUsageDto | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    storageUsageApi.get()
      .then(setData)
      .catch(e => toast.error(e instanceof Error ? e.message : "Could not load storage usage."))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading storage usage…</span>
      </div>
    );
  }

  const tenants = data?.tenants ?? [];
  const budget  = data?.budgetBytes ?? 0;
  const used    = data?.totalBytes ?? 0;
  const nearBudget = budget > 0 && used / budget >= 0.8;

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <button
              onClick={() => navigate("/super-admin")}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="h-3 w-3" /> Tenants
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              Storage Usage
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              The shared object-storage bucket, per tenant — HR documents, CRM documents, support
              attachments, and property photos.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5 max-w-5xl">
        {/* Budget */}
        <section className="rounded-xl border border-border p-5">
          <BudgetBar used={used} budget={budget} />
        </section>

        {nearBudget && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-900/15 p-4 flex gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold text-sm">Approaching the provisioned budget</p>
              <p className="mt-1">
                Consider raising the bucket's capacity, or follow up with the heaviest tenants below.
                Per-file size caps and server-side image compression already run on every upload —
                this is the headroom left after those.
              </p>
            </div>
          </div>
        )}

        {/* Per-module totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ModuleStat icon={Users2} label="HR documents" bytes={moduleTotal(tenants, "hrBytes")} />
          <ModuleStat icon={FileText} label="CRM documents" bytes={moduleTotal(tenants, "crmBytes")} />
          <ModuleStat icon={Ticket} label="Support attachments" bytes={moduleTotal(tenants, "supportBytes")} />
          <ModuleStat icon={Building} label="Property photos" bytes={moduleTotal(tenants, "realEstateBytes")} />
        </div>

        {/* Per-tenant table */}
        <section className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">By tenant</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Heaviest first. A tenant using none of the four modules below doesn't appear.
            </p>
          </div>
          {tenants.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No tenant has anything stored in the bucket yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left font-medium px-4 py-2">Tenant</th>
                    <th className="text-left font-medium px-4 py-2">Plan</th>
                    <th className="text-right font-medium px-4 py-2">HR</th>
                    <th className="text-right font-medium px-4 py-2">CRM</th>
                    <th className="text-right font-medium px-4 py-2">Support</th>
                    <th className="text-right font-medium px-4 py-2">Real Estate</th>
                    <th className="text-right font-medium px-4 py-2">Total</th>
                    <th className="text-right font-medium px-4 py-2">% of budget</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(t => (
                    <tr key={t.tenantId} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{t.tenantName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{t.plan}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatFileSize(t.hrBytes)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatFileSize(t.crmBytes)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatFileSize(t.supportBytes)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatFileSize(t.realEstateBytes)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatFileSize(t.totalBytes)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {budget > 0 ? `${((t.totalBytes / budget) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
