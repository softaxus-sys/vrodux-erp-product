import * as React from "react";
import { useAuthStore } from "@/store/auth.store";
import { taxAuthorityFor, useTenantCountryCode } from "@/lib/tax-authority";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Building2, CheckCircle2, ChevronDown, FlaskConical, KeyRound, Landmark, Loader2, Percent, RefreshCw, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { useCurrency } from "@/hooks/use-currency";
import { useCurrentBranch } from "@/hooks/restaurant/use-current-branch";
import {
  useDeleteBranchTax, useFbrQueue, useRetryFbrQueue, useSaveTaxProfile, useTaxSettings, useTestBranchFbr,
} from "@/hooks/restaurant/use-tax-platforms";
import type { TaxCountryPreset, TaxProfile } from "@/lib/restaurant/tax-platforms.api";

/**
 * Settings → Restaurant Tax & FBR. Tax is chosen by country (and province for Pakistan); a branch
 * can charge a different rate, or report to FBR under its own POS ID. The workspace FBR account
 * itself lives on Settings → FBR Integration, shared with retail POS.
 */
/** Shown as a section on Settings → Integrations. */
export function TaxSettingsView() {
  const canView = useCan("restaurant.tax.view");
  const canEdit = useCan("restaurant.tax.edit");
  const { data, isLoading } = useTaxSettings();
  const { options: branches } = useCurrentBranch();

  const { hasModuleAccess } = useAuthStore();
  const tenantCountry = useTenantCountryCode();
  const authority = taxAuthorityFor(data?.workspace.countryCode ?? tenantCountry);
  const isPk = authority?.code === "PK";
  if (!canView || !hasModuleAccess("restaurant")) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-6">
      <div>
        <h2 className="font-semibold flex items-center gap-2"><Percent className="h-5 w-5 text-primary" /> Restaurant Tax{isPk ? " & FBR" : ""}{authority && !isPk ? ` · ${authority.short}` : ""}</h2>
        <p className="text-sm text-muted-foreground">
          Choose the country (and province) your restaurant pays tax in. Every new bill is charged this rate and keeps it,
          so changing it later never alters a bill already rung up. Rates are a starting point — confirm them with your tax advisor.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          <section className="rounded-xl border bg-card p-4 space-y-3">
            <div>
              <h2 className="font-semibold">Whole workspace</h2>
              <p className="text-xs text-muted-foreground">Used by every branch that has no setting of its own.</p>
            </div>
            {!data.workspace.isSaved && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Nothing saved yet — bills are charged your country&apos;s preset ({data.workspace.ratePercent}% {data.workspace.taxLabel}).
                Save to confirm it.
              </p>
            )}
            <TaxForm profile={data.workspace} presets={data.presets} branchId={null} canEdit={canEdit} />
            {authority && !isPk && (
              <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
                <Landmark className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p className="text-muted-foreground">
                  Tax authority for your country: <b>{authority.name} ({authority.short})</b>. Sending each invoice to {authority.short} is
                  not connected yet; the rate above is still applied to every bill.
                </p>
              </div>
            )}
            {isPk && <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
              <Landmark className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p className="text-muted-foreground">
                The workspace&apos;s FBR account (POS ID and token) is set in{" "}
                <Link to="/settings/fbr" className="font-medium text-primary underline">Settings → FBR Integration</Link>,
                shared with retail POS. Branches registered with FBR under their own POS ID can be set below.
              </p>
            </div>}
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Branches</h2>
            {branches.length === 0 && <p className="text-sm text-muted-foreground">This workspace has no branches.</p>}
            {branches.map(b => (
              <BranchCard key={b.id} branchId={b.id} name={b.name}
                profile={data.branches.find(p => p.branchId === b.id) ?? null}
                workspace={data.workspace} presets={data.presets} canEdit={canEdit} />
            ))}
          </section>

          {isPk && <FbrQueue canEdit={canEdit} />}
        </>
      )}
    </section>
  );
}

function BranchCard({ branchId, name, profile, workspace, presets, canEdit }: {
  branchId: string; name: string; profile: TaxProfile | null; workspace: TaxProfile; presets: TaxCountryPreset[]; canEdit: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const remove = useDeleteBranchTax();
  const summary = profile
    ? `${profile.ratePercent}% ${profile.taxLabel}${profile.fbrEnabled ? ` · FBR POS ${profile.fbrPosId} (${profile.fbrEnvironment === "production" ? "live" : "sandbox"})` : ""}`
    : `Uses the workspace setting (${workspace.ratePercent}% ${workspace.taxLabel})`;
  return (
    <div className="rounded-xl border bg-card">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-4 text-start">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{summary}</p>
        </div>
        {profile && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Own setting</span>}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t p-4 space-y-3">
          <TaxForm profile={profile ?? { ...workspace, id: null, branchId, isSaved: false, fbrEnabled: false, fbrPosId: null, fbrTokenSet: false }}
            presets={presets} branchId={branchId} canEdit={canEdit} />
          {profile && canEdit && (
            <Button variant="ghost" size="sm" className="text-destructive" disabled={remove.isPending} onClick={() => remove.mutate(branchId)}>
              <Trash2 className="h-4 w-4 me-1" /> Use the workspace setting instead
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function TaxForm({ profile, presets, branchId, canEdit }: {
  profile: TaxProfile; presets: TaxCountryPreset[]; branchId: string | null; canEdit: boolean;
}) {
  const save = useSaveTaxProfile();
  const test = useTestBranchFbr();
  const [country, setCountry] = React.useState(profile.countryCode);
  const [region, setRegion] = React.useState(profile.regionCode ?? "");
  const [label, setLabel] = React.useState(profile.taxLabel);
  const [rate, setRate] = React.useState(String(profile.ratePercent));
  const [fbrOn, setFbrOn] = React.useState(profile.fbrEnabled);
  const [env, setEnv] = React.useState(profile.fbrEnvironment);
  const [posId, setPosId] = React.useState(profile.fbrPosId ? String(profile.fbrPosId) : "");
  const [token, setToken] = React.useState("");
  const [fee, setFee] = React.useState(String(profile.fbrServiceFee));
  const [pct, setPct] = React.useState(profile.fbrPctCode);
  const [testMsg, setTestMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const preset = presets.find(p => p.code === country);
  const pickCountry = (code: string) => {
    setCountry(code); setRegion("");
    const p = presets.find(x => x.code === code);
    if (p) { setLabel(p.label); setRate(String(p.rate)); }
  };
  const pickRegion = (code: string) => {
    setRegion(code);
    const r = preset?.regions.find(x => x.code === code);
    if (r) { setLabel(r.label); setRate(String(r.rate)); }
  };
  const isBranch = branchId !== null;
  const showFbr = isBranch && (country === "PK" || fbrOn);
  const rateNum = Number(rate);
  const invalid = !country || !Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100
    || (fbrOn && (!posId || (!profile.fbrTokenSet && !token.trim())));

  const onSave = () => {
    setTestMsg(null);
    save.mutate({
      branchId,
      data: {
        countryCode: country, regionCode: region || null, taxLabel: label.trim() || "Tax", ratePercent: rateNum,
        fbrEnabled: isBranch && fbrOn, fbrEnvironment: env, fbrPosId: posId ? Number(posId) : null,
        fbrToken: token.trim() ? token.trim() : undefined, fbrServiceFee: Number(fee) || 0, fbrPctCode: pct.trim(),
      },
    }, { onSuccess: () => setToken("") });
  };

  const field = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm disabled:opacity-60";
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Country</span>
          <select value={country} disabled={!canEdit} onChange={e => pickCountry(e.target.value)} className={field}>
            {!country && <option value="">Choose…</option>}
            {presets.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        {preset && preset.regions.length > 0 && (
          <label className="space-y-1 text-sm">
            <span className="font-medium">Province / region</span>
            <select value={region} disabled={!canEdit} onChange={e => pickRegion(e.target.value)} className={field}>
              <option value="">Choose…</option>
              {preset.regions.map(r => <option key={r.code} value={r.code}>{r.name} — {r.authority}</option>)}
            </select>
          </label>
        )}
        <label className="space-y-1 text-sm">
          <span className="font-medium">Name on the bill</span>
          <Input value={label} disabled={!canEdit} maxLength={20} onChange={e => setLabel(e.target.value)} placeholder="GST, VAT, PST…" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Rate (%)</span>
          <Input type="number" min={0} max={100} step="0.01" value={rate} disabled={!canEdit} onChange={e => setRate(e.target.value)} />
        </label>
      </div>

      {showFbr && (
        <div className="rounded-lg border p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={fbrOn} disabled={!canEdit} onChange={e => setFbrOn(e.target.checked)} />
            This branch reports to FBR under its own POS ID
          </label>
          {fbrOn && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Environment</span>
                <select value={env} disabled={!canEdit} onChange={e => setEnv(e.target.value as "sandbox" | "production")} className={field}>
                  <option value="sandbox">Sandbox (testing)</option>
                  <option value="production">Live</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">FBR POS ID</span>
                <Input inputMode="numeric" value={posId} disabled={!canEdit} onChange={e => setPosId(e.target.value.replace(/\D/g, ""))} />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> FBR token</span>
                <Input type="password" value={token} disabled={!canEdit} onChange={e => setToken(e.target.value)}
                  placeholder={profile.fbrTokenSet ? "Saved — leave empty to keep it" : "Paste the token FBR issued"} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">POS service fee per bill</span>
                <Input type="number" min={0} step="0.01" value={fee} disabled={!canEdit} onChange={e => setFee(e.target.value)} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">PCT code</span>
                <Input value={pct} disabled={!canEdit} onChange={e => setPct(e.target.value)} />
              </label>
            </div>
          )}
          {testMsg && (
            <p className={cn("flex items-center gap-1.5 text-sm", testMsg.ok ? "text-emerald-600" : "text-destructive")}>
              {testMsg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{testMsg.text}
            </p>
          )}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={invalid || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin me-1" />} Save
          </Button>
          {isBranch && fbrOn && profile.fbrEnabled && (
            <Button variant="outline" disabled={test.isPending || env !== "sandbox"}
              title={env !== "sandbox" ? "Tests are only sent to the sandbox" : undefined}
              onClick={() => { setTestMsg(null); test.mutate(branchId!, { onSuccess: r => setTestMsg({ ok: r.ok, text: r.message }) }); }}>
              {test.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <FlaskConical className="h-4 w-4 me-1" />} Send a test invoice
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FbrQueue({ canEdit }: { canEdit: boolean }) {
  const currency = useCurrency();
  const { data = [], isLoading } = useFbrQueue(null);
  const retry = useRetryFbrQueue();
  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold flex-1">Bills not yet accepted by FBR</h2>
        {canEdit && data.length > 0 && (
          <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(undefined)}>
            {retry.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <RefreshCw className="h-4 w-4 me-1" />} Send all now
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">These are sent again automatically every few minutes. A bill is never charged twice.</p>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : data.length === 0 ? (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Every paid bill has reached FBR.</p>
      ) : (
        <div className="divide-y">
          {data.map(q => (
            <div key={q.orderId} className="py-2 flex items-start gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{q.orderNumber} · {formatCurrency(q.total, currency)}
                  <span className="ms-2 text-xs text-muted-foreground">{formatDate(q.createdAt)}</span></p>
                {q.error && <p className="text-xs text-destructive break-words">{q.error}</p>}
                <p className="text-xs text-muted-foreground">{q.attempts} attempt(s)</p>
              </div>
              {canEdit && (
                <Button size="sm" variant="ghost" disabled={retry.isPending} onClick={() => retry.mutate(q.orderId)}>Send again</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
