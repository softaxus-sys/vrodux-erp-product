/**
 * PosOfflineProvider — decides whether this till runs local-first, and owns the offline engine.
 *
 * Every tenant chooses online or offline mode (POS settings). Switching is only allowed with nothing
 * in flight, enforced server-side from the status each till reports here. If an administrator forces
 * the switch to online while this till still holds records, the till is locked on a "sync first"
 * screen until they are uploaded — live selling never resumes on top of an unsynced backlog.
 *
 * The last known mode is cached in localStorage so a till booting with no internet still knows it is
 * allowed to sell offline. `usePosOffline()` returns null in online mode: every hook then behaves
 * exactly as before, which is also what every page outside this provider gets.
 */

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudUpload, Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";
import { usePosSettings } from "@/hooks/pos/use-pos-settings";
import { OfflinePos, type OfflineStatus } from "@/lib/pos/offline/offline-pos";
import { OfflineSyncDialog } from "@/components/pos/offline-sync";

export interface PosOfflineValue {
  engine:     OfflinePos;
  /** True in offline mode. False while draining a backlog after the tenant switched to online mode. */
  active:     boolean;
  online:     boolean;
  status:     OfflineStatus | null;
  refreshStatus: () => void;
  syncOpen:   boolean;
  openSync:   () => void;
  closeSync:  () => void;
}

const PosOfflineContext = React.createContext<PosOfflineValue | null>(null);

/** The offline engine when this till is in offline mode, otherwise null (online mode). */
export function usePosOffline(): PosOfflineValue | null {
  const ctx = React.useContext(PosOfflineContext);
  return ctx?.active ? ctx : null;
}

/** The engine whenever one exists — including while draining — for the sync UI. */
export function usePosOfflineEngine(): PosOfflineValue | null {
  return React.useContext(PosOfflineContext);
}

function readFlag(key: string): boolean | null {
  try { const v = localStorage.getItem(key); return v === null ? null : v === "1"; } catch { return null; }
}
function writeFlag(key: string, value: boolean) {
  try { localStorage.setItem(key, value ? "1" : "0"); } catch { /* private mode — fine */ }
}

export function PosOfflineProvider({ children }: { children: React.ReactNode }) {
  const { user, tenant } = useAuthStore();
  const qc = useQueryClient();
  const tenantKey = tenant?.id || tenant?.slug || "tenant";
  const userId    = user?.id ?? "anonymous";
  const modeKey   = `vrodux:pos-offline-enabled:${tenantKey}`;
  // Set once this user ever ran offline on this device: there may be local data to drain.
  const usedKey   = `vrodux:pos-offline-used:${tenantKey}:${userId}`;

  const settings = usePosSettings();
  const cached   = React.useMemo(() => readFlag(modeKey), [modeKey]);

  React.useEffect(() => {
    if (settings.data) writeFlag(modeKey, settings.data.offlineModeEnabled);
  }, [settings.data, modeKey]);

  const enabled: boolean | null =
    settings.data?.offlineModeEnabled ?? (settings.isError ? cached ?? false : cached);

  const [everUsed] = React.useState(() => readFlag(usedKey) === true);
  const needsEngine = enabled === true || (enabled === false && everUsed);

  const engine = React.useMemo(
    () => (needsEngine ? new OfflinePos({ tenantKey, userId }) : null),
    [needsEngine, tenantKey, userId],
  );

  React.useEffect(() => { if (enabled) writeFlag(usedKey, true); }, [enabled, usedKey]);

  const [online, setOnline] = React.useState(() => typeof navigator === "undefined" || navigator.onLine);
  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const [status, setStatus]     = React.useState<OfflineStatus | null>(null);
  const [syncOpen, setSyncOpen] = React.useState(false);

  const refreshStatus = React.useCallback(() => {
    engine?.getStatus().then(setStatus).catch(() => undefined);
  }, [engine]);

  // Report the backlog to the server (debounced) so a mode switch can be refused while it isn't empty.
  const reportTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleReport = React.useCallback(() => {
    if (!engine || !navigator.onLine) return;
    clearTimeout(reportTimer.current);
    reportTimer.current = setTimeout(() => { engine.reportStatus().catch(() => undefined); }, 1500);
  }, [engine]);

  React.useEffect(() => {
    if (!engine) return;
    refreshStatus();
    scheduleReport();
    const unsub = engine.subscribe(() => {
      refreshStatus();
      scheduleReport();
      // Local writes change what the product grid, history and shift queries should show.
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["pos-transactions"] });
      qc.invalidateQueries({ queryKey: ["pos-sessions"] });
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
    });
    return () => { unsub(); clearTimeout(reportTimer.current); };
  }, [engine, refreshStatus, scheduleReport, qc]);

  React.useEffect(() => { if (online) scheduleReport(); }, [online, scheduleReport]);

  // Take a fresh catalogue whenever an offline-mode till is online.
  React.useEffect(() => {
    if (engine && enabled && online) engine.refreshSnapshot().catch(() => undefined);
  }, [engine, enabled, online]);

  const backlog = !!status && (status.pendingRecords > 0 || status.unsyncedShifts > 0);

  // Online mode with an empty queue: nothing left to drain on this device.
  React.useEffect(() => {
    if (enabled === false && status && !backlog) writeFlag(usedKey, false);
  }, [enabled, status, backlog, usedKey]);

  // Still deciding the mode (or reading the local queue): don't render the POS in the wrong mode.
  if ((enabled === null && settings.isLoading) || (enabled === false && engine && !status)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!engine || (enabled === false && !backlog)) return <>{children}</>;

  const value: PosOfflineValue = {
    engine, active: enabled === true, online, status, refreshStatus,
    syncOpen, openSync: () => setSyncOpen(true), closeSync: () => setSyncOpen(false),
  };

  return (
    <PosOfflineContext.Provider value={value}>
      {value.active ? children : <DrainScreen />}
      <OfflineSyncDialog />
    </PosOfflineContext.Provider>
  );
}

/**
 * Shown when the workspace is in online mode but this till still holds offline records. Selling
 * live on top of them would put the day's figures out of order, so the till syncs first.
 */
function DrainScreen() {
  const off = usePosOfflineEngine()!;
  const [busy, setBusy] = React.useState(false);
  const s = off.status!;

  const syncAll = async () => {
    setBusy(true);
    try {
      const closed = await off.engine.closeOpenSessionsForSwitch();
      const r = await off.engine.sync(true);
      if (r && r.rejected > 0) {
        toast.warning(`${r.applied} synced, ${r.rejected} rejected. Open the sync details to review them.`);
        off.openSync();
      } else {
        toast.success(closed
          ? `Shift closed and everything synced. This till is now online.`
          : "Everything synced. This till is now online.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? `Sync failed: ${e.message}` : "Sync failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border-2 border-border bg-card p-6 space-y-5 text-center">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-warning/15 flex items-center justify-center">
          <CloudUpload className="h-7 w-7 text-warning" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-black">Sync this till before continuing</h1>
          <p className="text-sm text-muted-foreground">
            Your workspace switched to online mode, but this till still has {s.pendingRecords} record(s)
            {s.unsyncedShifts ? ` across ${s.unsyncedShifts} shift(s)` : ""} saved only on this device.
            Upload them first so nothing is lost.
          </p>
        </div>
        {s.rejected.length > 0 && (
          <p className="text-xs text-destructive">
            {s.rejected.length} record(s) were rejected on an earlier sync. Review them in the sync details.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Any shift still open on this till is closed at its expected cash, marked as not counted.
        </p>
        {!off.online && (
          <p className="text-sm font-semibold text-destructive flex items-center justify-center gap-1.5">
            <WifiOff className="h-4 w-4" />Connect to the internet to sync.
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={off.openSync} disabled={busy}>Details</Button>
          <Button className="flex-1 gap-2" onClick={syncAll} disabled={busy || !off.online}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}Sync now
          </Button>
        </div>
      </div>
    </div>
  );
}
