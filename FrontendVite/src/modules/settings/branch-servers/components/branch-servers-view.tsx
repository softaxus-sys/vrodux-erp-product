import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Server, CheckCircle2, AlertTriangle, XCircle, WifiOff, Clock, Loader2, RefreshCw, Info, PlugZap, KeyRound, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useBranches } from "@/hooks/identity/use-branches";
import {
  branchServersApi, type BranchServerState, type BranchServerStatusDto, type IssuedBranchKeyDto,
} from "@/lib/identity/branch-servers.api";

const STATE: Record<BranchServerState, { icon: React.ElementType; cls: string; key: string; fallback: string }> = {
  ok:             { icon: CheckCircle2,  cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30", key: "branchServers.state.ok",            fallback: "Healthy" },
  warning:        { icon: AlertTriangle, cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",       key: "branchServers.state.warning",       fallback: "Needs attention" },
  error:          { icon: XCircle,       cls: "text-red-600 bg-red-50 dark:bg-red-950/30",             key: "branchServers.state.error",         fallback: "Sync failing" },
  offline:        { icon: WifiOff,       cls: "text-red-600 bg-red-50 dark:bg-red-950/30",             key: "branchServers.state.offline",       fallback: "Offline" },
  never:          { icon: Clock,         cls: "text-muted-foreground bg-muted",                        key: "branchServers.state.never",         fallback: "Never connected" },
  not_configured: { icon: PlugZap,       cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",       key: "branchServers.state.notConfigured", fallback: "No key" },
};

const stateOf = (s: string): (typeof STATE)[BranchServerState] => STATE[s as BranchServerState] ?? STATE.never;

/**
 * Head office's view of branch servers: which branches run their own server, when each was last heard from,
 * whether its sync works, and what is waiting for it. Only meaningful on the head-office (cloud) server.
 */
export function BranchServersView() {
  const { t } = useTranslation("settings");
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["branch-servers"],
    queryFn: branchServersApi.getStatus,
    refetchInterval: 30_000,
    retry: false,
  });
  const branches = useBranches();
  const [confirm, setConfirm] = React.useState<{ id: string; name: string; mode: "local" | "cloud" } | null>(null);

  const setMode = useMutation({
    mutationFn: (v: { id: string; mode: "local" | "cloud" }) => branchServersApi.setServerMode(v.id, v.mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-servers"] });
      toast.success(t("branchServers.modeSaved", { defaultValue: "Saved. Tills follow the new setting within a minute." }));
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [issued, setIssued] = React.useState<(IssuedBranchKeyDto & { name: string }) | null>(null);
  const [revoking, setRevoking] = React.useState<{ id: string; name: string } | null>(null);
  const nameOf = (id: string) =>
    status.data?.find(r => r.branchId === id)?.name ?? branches.data?.find(b => b.id === id)?.name ?? "";

  const issue = useMutation({
    mutationFn: (branchId: string) => branchServersApi.issueKey(branchId),
    onSuccess: (k) => { setIssued({ ...k, name: nameOf(k.branchId) }); qc.invalidateQueries({ queryKey: ["branch-servers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (branchId: string) => branchServersApi.revokeKeys(branchId),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["branch-servers"] });
      toast.success(r.stillInConfig
        ? t("branchServers.revokedButConfig", { defaultValue: "Issued keys revoked. This branch also has a key in server configuration, which must be removed there." })
        : t("branchServers.revoked", { defaultValue: "Revoked. The branch server stops syncing within a minute." }));
      setRevoking(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(t("branchServers.copied", { defaultValue: "Copied." })),
      () => toast.error(t("branchServers.copyFailed", { defaultValue: "Could not copy - select the text and copy it." })));
  };

  const notCloud = status.error instanceof ApiError && status.error.statusCode === 404;
  const rows = status.data ?? [];
  const byId = new Map(rows.map(r => [r.branchId, r]));
  const cloudRun = (branches.data ?? []).filter(b => !byId.has(b.id) && b.status !== "inactive");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("branchServers.title", { defaultValue: "Branch Servers" })}</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            {t("branchServers.description", { defaultValue: "Branches that run their own server keep trading when the internet fails, and sync with head office in both directions. This page shows whether each one is connected and up to date." })}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => status.refetch()} disabled={status.isFetching}>
          <RefreshCw className={cn("h-4 w-4", status.isFetching && "animate-spin")} />
          {t("branchServers.refresh", { defaultValue: "Refresh" })}
        </Button>
      </div>

      {notCloud && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm flex gap-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <span>{t("branchServers.notCloud", { defaultValue: "This server is not set up as the head-office server for branch servers, so there is nothing to show here." })}</span>
        </div>
      )}
      {status.isError && !notCloud && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{(status.error as Error).message}</span>
          <Button size="sm" variant="outline" onClick={() => status.refetch()}>{t("branchServers.retry", { defaultValue: "Retry" })}</Button>
        </div>
      )}
      {status.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />
          {t("branchServers.loading", { defaultValue: "Checking branch servers…" })}</div>
      )}

      {!notCloud && status.isSuccess && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("branchServers.empty", { defaultValue: "No branch runs its own server yet. Switch one below once its server is installed." })}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(r => <ServerCard key={r.branchId} row={r}
          onSwitch={() => setConfirm({ id: r.branchId, name: r.name, mode: r.serverMode === "local" ? "cloud" : "local" })}
          onIssueKey={() => issue.mutate(r.branchId)}
          onRevoke={() => setRevoking({ id: r.branchId, name: r.name })} />)}
      </div>

      {!notCloud && cloudRun.length > 0 && (
        <div className="rounded-xl border border-border">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">{t("branchServers.cloudRun", { defaultValue: "Branches using head office directly" })}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("branchServers.cloudRunHint", { defaultValue: "Their tills talk to this server. Switch a branch only after its own server is installed and connected." })}</p>
          </div>
          <div className="divide-y divide-border">
            {cloudRun.map(b => (
              <div key={b.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <span>{b.name} <span className="text-muted-foreground">· {b.code}</span></span>
                <Can permission="settings.branches.edit">
                  <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => issue.mutate(b.id)}>
                    <KeyRound className="h-3.5 w-3.5 mr-1" />{t("branchServers.issueKey", { defaultValue: "Issue key" })}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirm({ id: b.id, name: b.name, mode: "local" })}>
                    {t("branchServers.useOwnServer", { defaultValue: "Use its own server" })}
                  </Button>
                  </div>
                </Can>
              </div>
            ))}
          </div>
        </div>
      )}

      {issued && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card border border-border p-5 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h3 className="font-bold">{t("branchServers.issuedTitle", { defaultValue: "Connection code for {{name}}", name: issued.name })}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("branchServers.issuedBody", { defaultValue: "Paste this into the branch server's setup (choose \"Branch of a chain\"). It contains the head-office address and the branch key. It is shown only now - copy it before closing. If the branch already had a key, that key keeps working until the branch connects with this one, then stops." })}
            </p>
            <div className="relative">
              <textarea readOnly value={issued.connectionCode} rows={4}
                className="w-full rounded-md border border-border bg-muted p-2 pr-10 font-mono text-xs break-all"
                onFocus={e => e.currentTarget.select()} />
              <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-7 w-7" onClick={() => copy(issued.connectionCode)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("branchServers.issuedAddress", { defaultValue: "Head-office address in this code: {{url}}. If branches reach head office at a different address, set BranchSync:PublicBaseUrl on this server and issue a new key.", url: issued.cloudBaseUrl })}
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setIssued(null)}>{t("branchServers.done", { defaultValue: "I've copied it" })}</Button>
            </div>
          </div>
        </div>
      )}

      {revoking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRevoking(null)}>
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold">{t("branchServers.revokeTitle", { defaultValue: "Revoke {{name}}'s keys?", name: revoking.name })}</h3>
            <p className="text-sm text-muted-foreground">
              {t("branchServers.revokeBody", { defaultValue: "The branch server stops syncing straight away. It keeps trading, but nothing reaches head office until a new key is entered there. Use this for a lost, stolen or retired PC." })}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRevoking(null)}>{t("branchServers.cancel", { defaultValue: "Cancel" })}</Button>
              <Button variant="destructive" onClick={() => revoke.mutate(revoking.id)} disabled={revoke.isPending}>
                {revoke.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                {t("branchServers.revoke", { defaultValue: "Revoke" })}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold">
              {confirm.mode === "local"
                ? t("branchServers.toLocalTitle", { defaultValue: "Run {{name}} on its own server?", name: confirm.name })
                : t("branchServers.toCloudTitle", { defaultValue: "Move {{name}} back to head office?", name: confirm.name })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {confirm.mode === "local"
                ? t("branchServers.toLocalBody", { defaultValue: "From now on its bills are written only at the branch. Head office can see them but not change them, and QR / Foodpanda orders are passed to the branch. Do this after closing the day's shifts." })
                : t("branchServers.toCloudBody", { defaultValue: "Its tills must be pointed back at head office. Make sure the branch server has finished uploading first, and close the day's shifts." })}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirm(null)}>{t("branchServers.cancel", { defaultValue: "Cancel" })}</Button>
              <Button onClick={() => setMode.mutate({ id: confirm.id, mode: confirm.mode })} disabled={setMode.isPending}>
                {setMode.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                {t("branchServers.confirm", { defaultValue: "Confirm" })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServerCard({ row, onSwitch, onIssueKey, onRevoke }: {
  row: BranchServerStatusDto; onSwitch: () => void; onIssueKey: () => void; onRevoke: () => void;
}) {
  const { t } = useTranslation("settings");
  const st = stateOf(row.state);
  const Icon = st.icon;
  const drift = row.clockDriftSeconds;
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Server className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold truncate">{row.name}</span>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0", st.cls)}>
          <Icon className="h-3.5 w-3.5" />{t(st.key, { defaultValue: st.fallback })}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{row.summary}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <Field label={t("branchServers.lastSeen", { defaultValue: "Last heard from" })} value={row.lastSeenAt ? formatDate(row.lastSeenAt, "relative") : "—"} />
        <Field label={t("branchServers.lastUpload", { defaultValue: "Last upload" })} value={row.lastUpOkAt ? formatDate(row.lastUpOkAt, "relative") : "—"} />
        <Field label={t("branchServers.lastDownload", { defaultValue: "Last update from head office" })} value={row.lastDownOkAt ? formatDate(row.lastDownOkAt, "relative") : "—"} />
        <Field label={t("branchServers.version", { defaultValue: "Version" })}
          value={row.version ?? "—"} warn={!row.versionMatches} />
        <Field label={t("branchServers.clock", { defaultValue: "Clock difference" })}
          value={drift == null ? "—" : `${drift > 0 ? "+" : ""}${drift}s`} warn={drift != null && Math.abs(drift) > 60} />
        <Field label={t("branchServers.waiting", { defaultValue: "Waiting for the branch" })}
          value={String(row.pendingOrders + row.pendingInstructions)} warn={row.pendingOrders + row.pendingInstructions > 0 && row.state === "offline"} />
        {row.rejectedOrdersToday > 0 && (
          <Field label={t("branchServers.rejected", { defaultValue: "Online orders refused today" })} value={String(row.rejectedOrdersToday)} warn />
        )}
      </dl>
      {row.lastError && row.state !== "ok" && (
        <p className="text-xs rounded-md bg-muted px-2 py-1.5 font-mono break-words">{row.lastError}</p>
      )}
      <div className="flex items-center justify-between gap-2 flex-wrap border-t border-border pt-2">
        <span className="text-xs text-muted-foreground">
          {row.activeKeys > 0
            ? t("branchServers.keyInfo", { defaultValue: "Key …{{hint}}, issued {{when}}", hint: row.keyHint, when: formatDate(row.keyCreatedAt, "relative") })
              + (row.activeKeys > 1 ? " · " + t("branchServers.keyRotating", { defaultValue: "old key still valid until the branch uses the new one" }) : "")
            : row.keyInConfig
              ? t("branchServers.keyConfig", { defaultValue: "Key set in server configuration" })
              : t("branchServers.noKey", { defaultValue: "No key issued" })}
        </span>
        <Can permission="settings.branches.edit">
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={onIssueKey}>
              <KeyRound className="h-3.5 w-3.5 mr-1" />
              {row.activeKeys > 0
                ? t("branchServers.rotateKey", { defaultValue: "New key" })
                : t("branchServers.issueKey", { defaultValue: "Issue key" })}
            </Button>
            {row.activeKeys > 0 && (
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onRevoke}>
                {t("branchServers.revoke", { defaultValue: "Revoke" })}
              </Button>
            )}
          </div>
        </Can>
      </div>
      <div className="flex justify-end">
        <Can permission="settings.branches.edit">
          <Button size="sm" variant="ghost" onClick={onSwitch}>
            {row.serverMode === "local"
              ? t("branchServers.backToCloud", { defaultValue: "Move back to head office" })
              : t("branchServers.useOwnServer", { defaultValue: "Use its own server" })}
          </Button>
        </Can>
      </div>
    </div>
  );
}

function Field({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("truncate", warn && "text-amber-600 font-medium")}>{value}</dd>
    </div>
  );
}
