/**
 * RestaurantOfflineProvider — wraps the restaurant till. Watches whether the server can be reached
 * and hands the till's hooks the offline engine, so the till keeps trading through an outage and
 * uploads what happened as soon as the server is back.
 *
 * "Reachable" is measured, not assumed: navigator.onLine only says the device has a network, and a
 * restaurant's Wi-Fi is routinely up while its internet is down. A light /health ping decides, and
 * any request that fails at the network level flips the till offline straight away.
 */

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CloudUpload, Loader2, WifiOff, AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { getApiBaseUrl } from "@/lib/desktop";
import { RestaurantOffline, type OfflineQueueStatus } from "@/lib/restaurant/offline/restaurant-offline";

export interface RestaurantOfflineValue {
  engine: RestaurantOffline;
  /** True while the server cannot be reached — the till reads and writes its local copy. */
  offline: boolean;
  status: OfflineQueueStatus | null;
  /** A request just failed at the network level: go offline now rather than at the next ping. */
  markUnreachable: () => void;
  syncNow: () => Promise<void>;
  syncing: boolean;
}

const Ctx = React.createContext<RestaurantOfflineValue | null>(null);

/** Null outside the restaurant till — every hook then behaves exactly as it always did. */
export function useRestaurantOffline(): RestaurantOfflineValue | null {
  return React.useContext(Ctx);
}

/** A failure to reach the server at all (as opposed to the server answering with an error). */
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof Error && /Failed to fetch|NetworkError|Load failed|network/i.test(e.message));
}

const PING_MS = 15_000;

async function ping(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5_000);
  try {
    const res = await fetch(`${getApiBaseUrl()}/health`, { cache: "no-store", signal: ctl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function RestaurantOfflineProvider({ children }: { children: React.ReactNode }) {
  const { user, tenant } = useAuthStore();
  const qc = useQueryClient();
  const tenantKey = tenant?.id || tenant?.slug || "tenant";
  const userId = user?.id ?? "anonymous";
  const engine = React.useMemo(() => new RestaurantOffline({ tenantKey, userId }), [tenantKey, userId]);

  const [offline, setOffline] = React.useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [status, setStatus] = React.useState<OfflineQueueStatus | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [showQueue, setShowQueue] = React.useState(false);

  const refresh = React.useCallback(() => { engine.getStatus().then(setStatus).catch(() => undefined); }, [engine]);
  const invalidate = React.useCallback(() => qc.invalidateQueries({ queryKey: ["restaurant"] }), [qc]);

  React.useEffect(() => {
    refresh();
    return engine.subscribe(() => { refresh(); invalidate(); });
  }, [engine, refresh, invalidate]);

  const check = React.useCallback(async () => setOffline(!(await ping())), []);
  React.useEffect(() => {
    check();
    const t = setInterval(check, PING_MS);
    const on = () => check();
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { clearInterval(t); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [check]);

  // Going offline or coming back changes where every read comes from.
  const wasOffline = React.useRef(offline);
  React.useEffect(() => {
    if (wasOffline.current !== offline) invalidate();
    wasOffline.current = offline;
  }, [offline, invalidate]);

  const syncNow = React.useCallback(async () => {
    setSyncing(true);
    try {
      const r = await engine.sync();
      if (r.applied + r.already + r.rejected > 0) {
        if (r.rejected > 0) toast.error(`${r.rejected} offline action(s) were refused by the server. Open the queue to see why.`);
        else toast.success(`Uploaded ${r.applied} offline action(s).`);
      }
    } catch (e) {
      if (isNetworkError(e)) setOffline(true);
      else toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setSyncing(false);
      refresh();
      invalidate();
    }
  }, [engine, refresh, invalidate]);

  // Back online with work waiting: upload it straight away, no button to remember.
  const pendingClean = (status?.pending ?? 0) - (status?.rejected.length ?? 0);
  React.useEffect(() => {
    if (!offline && pendingClean > 0 && !syncing) void syncNow();
  }, [offline, pendingClean, syncing, syncNow]);

  const value: RestaurantOfflineValue = {
    engine, offline, status, syncing, syncNow, markUnreachable: () => setOffline(true),
  };

  return (
    <Ctx.Provider value={value}>
      <OfflineBar value={value} onOpenQueue={() => setShowQueue(true)} />
      {children}
      {showQueue && <QueueDialog value={value} onClose={() => setShowQueue(false)} />}
    </Ctx.Provider>
  );
}

function OfflineBar({ value, onOpenQueue }: { value: RestaurantOfflineValue; onOpenQueue: () => void }) {
  const pending = value.status?.pending ?? 0;
  const rejected = value.status?.rejected.length ?? 0;
  if (!value.offline && pending === 0) return null;

  if (value.offline) {
    return (
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-5 py-2.5 bg-warning/15 text-warning text-sm font-extrabold border-b-2 border-warning/30">
        <WifiOff className="h-5 w-5 shrink-0" />
        <span>Offline — orders and payments are saved on this till and upload when the connection returns.</span>
        {pending > 0 && <button onClick={onOpenQueue} className="underline">{pending} waiting</button>}
        <span className="text-xs font-semibold opacity-80">Voids, discounts, refunds, splits and delivery need a connection.</span>
      </div>
    );
  }
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-2 px-5 py-2 bg-primary/10 text-primary text-sm font-bold border-b border-primary/20">
      {value.syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : rejected > 0 ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CloudUpload className="h-4 w-4" />}
      <span>{value.syncing ? "Uploading offline orders…" : rejected > 0 ? `${rejected} offline action(s) need attention` : `${pending} offline action(s) waiting to upload`}</span>
      <button onClick={onOpenQueue} className="underline">Review</button>
    </div>
  );
}

function QueueDialog({ value, onClose }: { value: RestaurantOfflineValue; onClose: () => void }) {
  const rejected = value.status?.rejected ?? [];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl bg-card border border-border p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Offline queue</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {value.status?.pending ?? 0} action(s) on this till have not reached the server yet.
          {value.status?.lastSyncAt && <> Last upload {new Date(value.status.lastSyncAt).toLocaleTimeString()}.</>}
        </p>
        {rejected.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-sm font-semibold text-destructive">Refused by the server — fix it on the bill, then retry or discard:</p>
            {rejected.map(op => (
              <div key={op.opId} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <div className="font-medium">{op.label}</div>
                <div className="text-muted-foreground">{op.error}</div>
                <button onClick={() => value.engine.discard(op.opId)} className="mt-2 inline-flex items-center gap-1 text-xs text-destructive underline">
                  <Trash2 className="h-3 w-3" /> Discard this action
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-border font-medium">Close</button>
          <button disabled={value.offline || value.syncing} onClick={() => void value.syncNow()}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            {value.syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {value.offline ? "Waiting for connection" : "Upload now"}
          </button>
        </div>
      </div>
    </div>
  );
}
