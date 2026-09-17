/**
 * Offline POS day-end UI: the top-bar "Sync to Cloud" button, the banner on the open-shift screen,
 * and the sync dialog that uploads the till's shifts and reports exactly what happened.
 */

import * as React from "react";
import {
  AlertTriangle, CheckCircle2, CloudOff, CloudUpload, Loader2, PackageX, RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";
import { usePosOfflineEngine as usePosOffline } from "@/contexts/pos-offline-context";
import type { OfflineSyncResult } from "@/lib/pos/offline/offline-pos";
import { TopBarButton } from "@/modules/pos/retail/components/pos-ui";

/** Top-bar button. Renders nothing for tenants in live mode. */
export function OfflineSyncButton() {
  const off = usePosOffline();
  if (!off) return null;
  const pending = off.status?.pendingRecords ?? 0;
  return (
    <TopBarButton
      icon={off.online ? CloudUpload : CloudOff}
      label={off.online ? "Sync to Cloud" : "Offline"}
      badge={pending || undefined}
      title={off.online
        ? `${pending} record(s) waiting to upload`
        : "No internet — sales are saved on this till and upload when you sync"}
      onClick={off.openSync}
    />
  );
}

/** Shown on the open-shift screen when earlier shifts on this till haven't been uploaded yet. */
export function OfflineDayEndBanner() {
  const off = usePosOffline();
  if (!off?.status || off.status.unsyncedShifts === 0) return null;
  const { unsyncedShifts, pendingRecords } = off.status;
  return (
    <div className="rounded-2xl border-2 border-warning/40 bg-warning/10 p-4 flex items-center gap-4">
      <CloudUpload className="h-7 w-7 text-warning shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">
          {unsyncedShifts} shift{unsyncedShifts !== 1 ? "s" : ""} on this till not synced yet
        </p>
        <p className="text-xs text-muted-foreground">
          {pendingRecords} record{pendingRecords !== 1 ? "s" : ""} are saved here only. Sync to upload them to the cloud.
        </p>
      </div>
      <Button onClick={off.openSync} className="shrink-0 gap-2">
        <CloudUpload className="h-4 w-4" />Sync to Cloud
      </Button>
    </div>
  );
}

export function OfflineSyncDialog() {
  const off = usePosOffline();
  const [syncing, setSyncing]       = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [forceClose, setForceClose] = React.useState(false);
  const [result, setResult]         = React.useState<OfflineSyncResult | null>(null);

  React.useEffect(() => {
    if (off?.syncOpen) { setResult(null); setForceClose(false); off.refreshStatus(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [off?.syncOpen]);

  if (!off) return null;
  const { status, online } = off;

  const runSync = async () => {
    setSyncing(true);
    try {
      const r = await off.engine.sync(forceClose);
      if (!r) { toast.info("Everything on this till is already synced."); return; }
      setResult(r);
      if (r.rejected === 0) toast.success(`Synced ${r.applied} record(s) to the cloud.`);
      else toast.warning(`${r.applied} synced, ${r.rejected} rejected. Review them below.`);
      // Server stock now includes the uploaded sales — refresh the till's catalogue from it.
      off.engine.refreshSnapshot().catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? `Sync failed: ${e.message}` : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const refreshCatalogue = async () => {
    setRefreshing(true);
    try {
      const s = await off.engine.refreshSnapshot();
      toast.success(`Catalogue updated: ${s.products.length} products.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't refresh the catalogue.");
    } finally {
      setRefreshing(false);
    }
  };

  const hasRejected = (status?.rejected.length ?? 0) > 0;
  const nothingToSync = !!status && status.pendingRecords === 0 && status.unsyncedShifts === 0;

  return (
    <Dialog open={off.syncOpen} onOpenChange={open => !open && !syncing && off.closeSync()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5 text-primary" />Sync to Cloud
          </DialogTitle>
          <DialogDescription>
            Upload this till's shifts, sales, refunds, voids and cash movements. Safe to run again — nothing is recorded twice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold",
            online ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
          )}>
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {online ? "Connected" : "No internet connection. Sales keep saving on this till; sync once you're back online."}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Unsynced shifts" value={status?.unsyncedShifts ?? "—"} />
            <Stat label="Records to upload" value={status?.pendingRecords ?? "—"} />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Offline catalogue: {status?.catalogueProducts ?? 0} products
              {status?.catalogueTakenAt ? ` · updated ${formatDate(status.catalogueTakenAt)} ${new Date(status.catalogueTakenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : " · never downloaded"}
            </span>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5" disabled={!online || refreshing} onClick={refreshCatalogue}>
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Refresh
            </Button>
          </div>

          {status?.sessionErrors.map(s => (
            <Notice key={s.clientRef} tone="warning" title={`Shift on ${s.registerId}`} body={s.error} />
          ))}

          {hasRejected && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm font-bold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />{status!.rejected.length} record(s) rejected by the server
              </p>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {status!.rejected.map(e => (
                  <li key={e.clientRef} className="text-xs">
                    <span className="font-mono font-semibold">{e.receiptNumber ?? e.kind}</span>
                    <span className="text-muted-foreground"> · {e.error}</span>
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-2 text-xs pt-1 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={forceClose} onChange={e => setForceClose(e.target.checked)} />
                <span>
                  Close the shift anyway. Rejected records stay on this till but won't be in that shift's Z-report.
                </span>
              </label>
            </div>
          )}

          {result && <ResultSummary result={result} />}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={off.closeSync} disabled={syncing}>Close</Button>
            <Button onClick={runSync} disabled={!online || syncing || nothingToSync} className="gap-2 min-w-[150px]">
              {syncing ? <><Loader2 className="h-4 w-4 animate-spin" />Syncing…</> : <><CloudUpload className="h-4 w-4" />Sync now</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function Notice({ tone, title, body }: { tone: "warning" | "success"; title: string; body: string }) {
  return (
    <div className={cn(
      "rounded-xl border p-3 text-xs",
      tone === "warning" ? "border-warning/30 bg-warning/5" : "border-success/30 bg-success/5",
    )}>
      <p className="font-bold">{title}</p>
      <p className="text-muted-foreground mt-0.5">{body}</p>
    </div>
  );
}

function ResultSummary({ result }: { result: OfflineSyncResult }) {
  const closed = result.sessions.filter(s => s.status === "synced").length;
  const open   = result.sessions.filter(s => s.status === "open").length;
  return (
    <div className="rounded-xl border border-border p-3 space-y-2 text-sm">
      <p className="font-bold flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-success" />Last sync
      </p>
      <ul className="text-xs space-y-0.5 text-muted-foreground">
        <li>{result.applied} uploaded · {result.duplicates} already on the server · {result.rejected} rejected</li>
        <li>{closed} shift(s) closed on the server{open ? ` · ${open} still open` : ""}</li>
      </ul>
      {result.negativeStock.length > 0 && (
        <div className="rounded-lg bg-warning/10 border border-warning/30 p-2.5">
          <p className="text-xs font-bold flex items-center gap-1.5 text-warning">
            <PackageX className="h-3.5 w-3.5" />Sold past zero stock while offline
          </p>
          <p className="text-[11px] text-muted-foreground mb-1">The sales are recorded. Count or restock these items.</p>
          <ul className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
            {result.negativeStock.map(p => (
              <li key={p.productId} className="flex justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="font-mono font-semibold text-destructive">{p.stockQuantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
