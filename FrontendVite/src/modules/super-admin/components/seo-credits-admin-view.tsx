import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Coins, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";
import { tenantsAdminApi } from "@/lib/admin/tenants.api";
import { cn, formatDate } from "@/lib/utils";
import type { SeoCreditsDto } from "@/lib/seo/seo.api";

const BASE = `${getApiBaseUrl()}/api/admin/seo/credits`;

interface AdminWalletDto { tenantId: string; balance: number; lifetimeAdded: number; lifetimeSpent: number; updatedAt: string | null }

const adminApi = {
  overview: (): Promise<AdminWalletDto[]> => rawApiClient.get(BASE),
  forTenant: (id: string): Promise<SeoCreditsDto> => rawApiClient.get(`${BASE}/${id}`),
  grant: (body: { tenantId: string; amount: number; reason: string }): Promise<SeoCreditsDto> => rawApiClient.post(`${BASE}/grant`, body),
};

const QUICK = [50, 100, 250, 500, 1000];

/** Platform owner: see every workspace's SEO credit balance and add (or remove) any amount. The API enforces SuperAdminOnly. */
export function SeoCreditsAdminView() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState("");
  const [picked, setPicked] = React.useState<{ id: string; name: string } | null>(null);

  const tenants = useQuery({ queryKey: ["admin", "tenants"], queryFn: tenantsAdminApi.getAll, staleTime: 60_000 });
  const wallets = useQuery({ queryKey: ["admin", "seo-credits"], queryFn: adminApi.overview, staleTime: 15_000 });

  const rows = React.useMemo(() => {
    const byTenant = new Map((wallets.data ?? []).map((w) => [w.tenantId, w]));
    const q = search.trim().toLowerCase();
    return (tenants.data ?? [])
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || (t.contactEmail ?? "").toLowerCase().includes(q))
      .map((t) => ({ t, w: byTenant.get(t.id) }))
      .sort((a, b) => (b.w?.lifetimeSpent ?? 0) - (a.w?.lifetimeSpent ?? 0) || a.t.name.localeCompare(b.t.name));
  }, [tenants.data, wallets.data, search]);

  const totals = React.useMemo(() => {
    const list = wallets.data ?? [];
    return { balance: list.reduce((n, w) => n + w.balance, 0), spent: list.reduce((n, w) => n + w.lifetimeSpent, 0), added: list.reduce((n, w) => n + w.lifetimeAdded, 0) };
  }, [wallets.data]);

  const loading = tenants.isLoading || wallets.isLoading;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/super-admin")}><ArrowLeft className="h-4 w-4" />Back</Button>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Coins className="h-5 w-5 text-primary" />SEO audit credits</h1>
          <p className="text-sm text-muted-foreground">Give any workspace as many credits as you like. One credit checks about 25 pages.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Credits outstanding" value={totals.balance} />
        <Stat label="Credits given, all time" value={totals.added} />
        <Stat label="Credits used, all time" value={totals.spent} />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workspaces…" className="pl-8 h-8 text-sm" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : tenants.error || wallets.error ? (
        <p className="text-sm text-destructive">{((tenants.error || wallets.error) as Error).message}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-start font-medium px-4 py-2.5">Workspace</th>
                <th className="text-end font-medium px-3 py-2.5">Balance</th>
                <th className="text-end font-medium px-3 py-2.5">Given</th>
                <th className="text-end font-medium px-3 py-2.5">Used</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, w }) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.contactEmail || t.slug}</p>
                  </td>
                  <td className={cn("px-3 py-2.5 text-end tabular-nums font-semibold", w && w.balance < 1 ? "text-destructive" : "text-foreground")}>{w ? w.balance.toLocaleString() : "—"}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-muted-foreground">{w ? w.lifetimeAdded.toLocaleString() : "—"}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-muted-foreground">{w ? w.lifetimeSpent.toLocaleString() : "—"}</td>
                  <td className="px-4 py-2.5 text-end">
                    <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setPicked({ id: t.id, name: t.name })}><Plus className="h-3 w-3" />Add credits</Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No workspaces match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">A dash means the workspace has not used SEO yet. It receives its welcome credits the first time it opens the SEO module.</p>

      {picked && <GrantDialog tenant={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{value.toLocaleString()}</p>
    </div>
  );
}

function GrantDialog({ tenant, onClose }: { tenant: { id: string; name: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["admin", "seo-credits", tenant.id], queryFn: () => adminApi.forTenant(tenant.id) });
  const [amount, setAmount] = React.useState("");
  const [remove, setRemove] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const n = Math.floor(Number(amount));
  const valid = Number.isFinite(n) && n > 0 && n <= 100000 && reason.trim().length > 0;
  const signed = remove ? -n : n;

  const grant = useMutation({
    mutationFn: () => adminApi.grant({ tenantId: tenant.id, amount: signed, reason: reason.trim() }),
    onSuccess: (d) => {
      toast.success(`${tenant.name} now has ${d.balance.toLocaleString()} credits.`);
      qc.invalidateQueries({ queryKey: ["admin", "seo-credits"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => !grant.isPending && onClose()}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">{remove ? "Remove" : "Add"} credits</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{tenant.name}</p>
          </div>
          <button className="p-1 rounded hover:bg-muted/40 text-muted-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        <p className="text-sm text-muted-foreground">
          Current balance: <span className="font-semibold text-foreground">{detail.isLoading ? "…" : (detail.data?.balance ?? 0).toLocaleString()}</span>
        </p>

        <div className="flex gap-1.5">
          {[false, true].map((r) => (
            <button key={String(r)} onClick={() => setRemove(r)}
              className={cn("px-3 py-1 rounded-lg text-xs font-medium border", remove === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
              {r ? "Remove" : "Add"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Amount (any whole number up to 100,000)</label>
          <Input type="number" min={1} max={100000} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 300" autoFocus />
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q} onClick={() => setAmount(String(q))} className="px-2 py-0.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted/40">{q}</button>
            ))}
          </div>
          {valid && <p className="text-xs text-muted-foreground">New balance: {Math.max(0, (detail.data?.balance ?? 0) + signed).toLocaleString()}{remove && (detail.data?.balance ?? 0) < n ? " — not enough to remove that many" : ""}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Reason (kept in the workspace's history)</label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Pilot customer, 3 months free" />
        </div>

        {detail.data && detail.data.recent.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Recent movements</p>
            <ul className="space-y-1 max-h-32 overflow-y-auto text-xs">
              {detail.data.recent.slice(0, 8).map((e) => (
                <li key={e.id} className="flex justify-between gap-3 text-muted-foreground">
                  <span className="truncate">{formatDate(e.createdAt)} · {e.reason}</span>
                  <span className={cn("tabular-nums font-medium", e.amount >= 0 ? "text-success" : "text-foreground")}>{e.amount > 0 ? "+" : ""}{e.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={grant.isPending}>Cancel</Button>
          <Button size="sm" className="gap-1.5" disabled={!valid || grant.isPending} onClick={() => grant.mutate()}>
            {grant.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{remove ? "Remove credits" : "Add credits"}
          </Button>
        </div>
      </div>
    </div>
  );
}
