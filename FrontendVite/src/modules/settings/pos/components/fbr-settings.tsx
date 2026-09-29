import * as React from "react";
import { Landmark, Loader2, CheckCircle2, AlertTriangle, RefreshCw, KeyRound, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { useCurrency } from "@/hooks/use-currency";
import { useFbrSettings, useRetryFbr, useSaveFbrSettings, useTestFbrConnection } from "@/hooks/pos/use-fbr";
import type { FbrEnvironment } from "@/lib/pos/fbr.api";

/**
 * Settings -> FBR Integration (Pakistan). Every POS sale is reported to FBR's IMS; FBR returns an
 * invoice number that is printed on the receipt with a QR code. Sales that can't reach FBR are
 * queued and retried automatically - the till never stops for it.
 */
export function FbrSettings() {
  const canEdit  = useCan("pos.sessions.approve");
  const currency = useCurrency();
  const { data, isLoading, refetch } = useFbrSettings(canEdit);
  const save  = useSaveFbrSettings();
  const test  = useTestFbrConnection();
  const retry = useRetryFbr();

  const [enabled, setEnabled] = React.useState(false);
  const [env,     setEnv]     = React.useState<FbrEnvironment>("sandbox");
  const [posId,   setPosId]   = React.useState("");
  const [token,   setToken]   = React.useState("");
  const [fee,     setFee]     = React.useState("1");
  const [pct,     setPct]     = React.useState("");
  const [testMsg, setTestMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setEnv(data.environment);
    setPosId(data.posId ? String(data.posId) : "");
    setFee(String(data.serviceFee));
    setPct(data.defaultPctCode ?? "");
  }, [data]);

  if (!canEdit)
    return <div className="max-w-3xl mx-auto p-6 text-sm text-muted-foreground">Only a POS supervisor or administrator can manage the FBR integration.</div>;

  const onSave = () => {
    setTestMsg(null);
    save.mutate({
      enabled, environment: env,
      posId: posId ? Number(posId) : null,
      token: token.trim() || null,
      serviceFee: Number(fee) || 0,
      defaultPctCode: pct.trim() || null,
    }, { onSuccess: () => setToken("") });
  };

  const onTest = () => {
    setTestMsg(null);
    test.mutate(undefined, { onSuccess: r => setTestMsg({ ok: r.success, text: r.message }) });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> FBR Integration</h1>
        <p className="text-sm text-muted-foreground">
          Report every POS sale to FBR (Pakistan). The FBR invoice number and QR code are printed on each receipt.
          If FBR can't be reached, sales are queued and sent automatically - the till keeps working.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
      ) : (
        <>
          {/* Status */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sent to FBR", value: data.submitted, cls: "text-emerald-600" },
              { label: "Waiting (queued)", value: data.pending, cls: data.pending ? "text-amber-600" : "text-muted-foreground" },
              { label: "Rejected by FBR", value: data.failed, cls: data.failed ? "text-red-600" : "text-muted-foreground" },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={cn("text-2xl font-bold tabular-nums", c.cls)}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Settings */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm">Report sales to FBR</p>
                <p className="text-xs text-muted-foreground">Adds the FBR POS service fee to each sale and prints the FBR invoice number.</p>
              </div>
              <input type="checkbox" className="h-5 w-5" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            </label>

            <div className="grid grid-cols-2 gap-2">
              {(["sandbox", "production"] as const).map(e => (
                <button key={e} type="button" onClick={() => setEnv(e)}
                  className={cn("rounded-lg border px-3 py-2 text-sm font-medium text-left",
                    env === e ? (e === "production" ? "border-red-500 bg-red-500/5" : "border-primary bg-primary/5") : "border-border text-muted-foreground")}>
                  {e === "sandbox" ? "Sandbox (testing)" : "Production (live tax records)"}
                </button>
              ))}
            </div>
            {env === "production" && (
              <p className="text-xs text-red-600 flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Production submissions are real tax records. Switch only after testing in sandbox.
              </p>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">FBR POS ID</label>
                <Input value={posId} onChange={e => setPosId(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 123456" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> API token {data.hasToken && <span className="text-emerald-600">(saved)</span>}
                </label>
                <Input type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="off"
                  placeholder={data.hasToken ? "Leave blank to keep the saved token" : "Paste the token issued by FBR"} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">POS service fee per sale ({currency})</label>
                <Input value={fee} onChange={e => setFee(e.target.value.replace(/[^0-9.]/g, ""))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Default PCT code</label>
                <Input value={pct} onChange={e => setPct(e.target.value)} placeholder="e.g. 2106.9090" className="h-9" />
                <p className="text-[11px] text-muted-foreground">Sent for items without their own PCT (HS) code.</p>
              </div>
            </div>

            {testMsg && (
              <div className={cn("rounded-lg border px-3 py-2 text-sm flex items-start gap-2",
                testMsg.ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : "border-red-500/30 bg-red-500/5 text-red-700")}>
                {testMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                <span>{testMsg.text}</span>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={onTest} disabled={test.isPending || !data.hasToken || data.environment !== "sandbox"}
                title={data.environment !== "sandbox" ? "Testing is only allowed in sandbox" : !data.hasToken ? "Save the token first" : undefined}>
                {test.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FlaskConical className="h-4 w-4 mr-1.5" />}
                Test connection (sandbox)
              </Button>
              <Button onClick={onSave} disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save
              </Button>
            </div>
          </div>

          {/* Queue */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="font-semibold text-sm">Not yet accepted by FBR</p>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => refetch()} title="Refresh"><RefreshCw className="h-4 w-4" /></Button>
                {data.failed > 0 && (
                  <Button size="sm" variant="outline" onClick={() => retry.mutate(undefined)} disabled={retry.isPending}>Retry all rejected</Button>
                )}
              </div>
            </div>
            {data.unsubmitted.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">Nothing waiting - every sale has been accepted by FBR.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.unsubmitted.map(q => (
                  <div key={q.id} className="px-4 py-2.5 flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{q.transactionNumber}
                        <span className={cn("ml-2 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded",
                          q.status === "failed" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-700")}>
                          {q.status === "failed" ? "Rejected" : "Queued"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(q.completedAt)} · {formatCurrency(q.totalAmount, currency)} · {q.attempts} attempt{q.attempts === 1 ? "" : "s"}
                      </p>
                      {q.lastError && <p className="text-xs text-red-600 truncate" title={q.lastError}>{q.lastError}</p>}
                    </div>
                    {q.status === "failed" && (
                      <Button size="sm" variant="outline" onClick={() => retry.mutate(q.id)} disabled={retry.isPending}>Retry</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
