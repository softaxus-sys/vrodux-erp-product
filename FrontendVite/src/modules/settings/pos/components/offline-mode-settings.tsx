import * as React from "react";
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, Loader2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { useSwitchReadiness, useUpdatePosSettings } from "@/hooks/pos/use-pos-settings";
import type { OpenShiftBlockerDto } from "@/lib/pos/pos-settings.api";

const time = (iso: string) =>
  `${formatDate(iso)} ${new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

/**
 * Per-tenant choice between online and offline POS. The switch is only offered once nothing is in
 * flight — every live shift closed before going offline, every till synced before going online.
 */
export function OfflineModeSettings() {
  const { data: r, isLoading } = useSwitchReadiness();
  const update  = useUpdatePosSettings();
  const canEdit = useCan("pos.sessions.approve");
  const [confirmForce, setConfirmForce] = React.useState(false);

  const offline = r?.offlineModeEnabled ?? false;
  const target  = !offline;
  const onlyTillsBlock =
    !!r && offline && r.openOfflineShifts.length === 0 && r.tillsWithUnsyncedWork.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-4">
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0",
            offline ? "bg-warning/15" : "bg-primary/10")}>
            {offline ? <CloudOff className="h-5 w-5 text-warning" /> : <Cloud className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-bold flex items-center gap-2 flex-wrap">
              Retail POS mode
              {r && (
                <span className={cn("text-xs px-2 py-0.5 rounded-md font-extrabold uppercase",
                  offline ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary")}>
                  {offline ? "Offline" : "Online"}
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Online:</strong> every sale is recorded live. <strong>Offline:</strong> tills save shifts, sales,
              refunds, voids and cash in/out on the device and upload them with <strong>Sync to Cloud</strong> at day end.
            </p>
            {!offline && (
              <ul className="text-xs text-muted-foreground list-disc ps-4 space-y-0.5 pt-1">
                <li>Stock isn't checked live offline, so items can sell past zero. The sync lists them for a recount.</li>
                <li>Vouchers and loyalty points need a connection.</li>
                <li>Sales reach reports and the ledger only after the till syncs.</li>
                <li>Open the POS once on every till while online, so it downloads the product catalogue.</li>
              </ul>
            )}
          </div>
        </div>

        {isLoading || !r ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {r.canSwitch ? (
              <p className="text-sm flex items-center gap-2 text-success font-semibold">
                <CheckCircle2 className="h-4 w-4" />Everything is synced. You can switch to {target ? "offline" : "online"} mode.
              </p>
            ) : (
              <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 space-y-3">
                <p className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Sync everything before switching to {target ? "offline" : "online"} mode
                </p>
                <ShiftList
                  title="Open shifts in online mode — close them first"
                  shifts={r.openOnlineShifts}
                />
                <ShiftList
                  title="Offline shifts still open — close them on the till and sync"
                  shifts={r.openOfflineShifts}
                />
                {r.tillsWithUnsyncedWork.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1">Tills with records not yet synced — press Sync to Cloud on each</p>
                    <ul className="space-y-1">
                      {r.tillsWithUnsyncedWork.map(t => (
                        <li key={t.deviceId} className="text-xs flex items-center gap-2">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-semibold">{t.registerId ?? "Unknown register"}</span>
                          <span className="text-muted-foreground truncate">
                            {t.userName ?? "—"} · {t.pendingRecords} record(s), {t.unsyncedShifts} shift(s) · last seen {time(t.reportedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">This list updates on its own as tills close shifts and sync.</p>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {onlyTillsBlock && canEdit && (
                <Button variant="outline" className="text-destructive border-destructive/40"
                  onClick={() => setConfirmForce(true)} disabled={update.isPending}>
                  Switch anyway…
                </Button>
              )}
              <Button
                onClick={() => update.mutate({ offlineModeEnabled: target })}
                disabled={!canEdit || !r.canSwitch || update.isPending}
                title={canEdit ? undefined : "Only a POS supervisor or administrator can change this"}
                className="gap-2"
              >
                {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {target ? <CloudOff className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                Switch to {target ? "offline" : "online"} mode
              </Button>
            </div>
          </>
        )}
      </div>

      <Dialog open={confirmForce} onOpenChange={setConfirmForce}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Switch to online mode with tills unsynced?</DialogTitle>
            <DialogDescription>
              Use this only for a till that is lost or broken and will never sync. Any till that does come back online is
              locked on a "sync first" screen until its records are uploaded, so nothing it holds is lost — but those
              sales stay out of your reports until then.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmForce(false)}>Cancel</Button>
            <Button variant="destructive" disabled={update.isPending}
              onClick={() => update.mutate({ offlineModeEnabled: false, force: true }, { onSettled: () => setConfirmForce(false) })}>
              Switch anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShiftList({ title, shifts }: { title: string; shifts: OpenShiftBlockerDto[] }) {
  if (!shifts.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold mb-1">{title}</p>
      <ul className="space-y-1">
        {shifts.map(s => (
          <li key={s.sessionId} className="text-xs flex items-center gap-2">
            <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-semibold">{s.registerId}</span>
            <span className="text-muted-foreground">opened {time(s.openedAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
