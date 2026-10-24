import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Copy, Loader2, Plus, Trash2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useCurrentBranch } from "@/hooks/restaurant/use-current-branch";
import {
  useDeletePlatformConnection, usePlatformConnections, useSavePlatformConnection, useTestPlatformConnection,
} from "@/hooks/restaurant/use-tax-platforms";
import type { PlatformConnection } from "@/lib/restaurant/tax-platforms.api";

/**
 * Restaurant ordering platforms on Settings → Integrations. Foodpanda (Delivery Hero) sends each order
 * to the branch's plugin address; it appears on that branch's till to accept, cook and hand over.
 */
export function OrderingPlatformsSection() {
  const { hasRawPermission, hasModuleAccess } = useAuthStore();
  const canView = hasModuleAccess("restaurant") && hasRawPermission("restaurant.integrations.view");
  const canEdit = hasRawPermission("restaurant.integrations.edit");
  const { data = [], isLoading } = usePlatformConnections(canView);
  const { options: branches } = useCurrentBranch();
  const [editing, setEditing] = React.useState<PlatformConnection | "new" | null>(null);
  if (!canView) return null;

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? "—";
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-pink-600 text-white flex items-center justify-center font-black">fp</div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold">Foodpanda</h2>
          <p className="text-sm text-muted-foreground">
            Orders placed on Foodpanda arrive straight on the branch&apos;s till. Staff accept them with a ready time,
            reject them with a reason, and mark them handed to the rider — Foodpanda is told each step.
          </p>
        </div>
        {canEdit && <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4 me-1" /> Connect a branch</Button>}
      </div>

      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No branch is connected yet.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {data.map(c => (
            <button key={c.id} onClick={() => setEditing(c)} className="w-full flex items-center gap-3 p-3 text-start hover:bg-muted/40">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{branchName(c.branchId)} <span className="text-xs text-muted-foreground">· vendor {c.remoteId}</span></p>
                <p className="text-xs text-muted-foreground">
                  {c.lastOrderAt ? `Last order ${formatDate(c.lastOrderAt)}` : "No orders received yet"}
                  {c.autoAccept && " · accepts automatically"}
                </p>
                {c.lastError && <p className="text-xs text-destructive truncate">{c.lastError}</p>}
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium",
                c.environment === "production" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                {c.environment === "production" ? "Live" : "Sandbox"}
              </span>
              {!c.isEnabled && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Paused</span>}
            </button>
          ))}
        </div>
      )}

      {editing && <ConnectionDrawer connection={editing === "new" ? null : editing} canEdit={canEdit} onClose={() => setEditing(null)} />}
    </section>
  );
}

function ConnectionDrawer({ connection, canEdit, onClose }: { connection: PlatformConnection | null; canEdit: boolean; onClose: () => void }) {
  const { options: branches } = useCurrentBranch();
  const save = useSavePlatformConnection();
  const test = useTestPlatformConnection();
  const remove = useDeletePlatformConnection();
  const [saved, setSaved] = React.useState<PlatformConnection | null>(connection);
  const [env, setEnv] = React.useState(connection?.environment ?? "sandbox");
  const [branchId, setBranchId] = React.useState(connection?.branchId ?? branches[0]?.id ?? "");
  const [remoteId, setRemoteId] = React.useState(connection?.remoteId ?? "");
  const [username, setUsername] = React.useState(connection?.username ?? "");
  const [password, setPassword] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [autoAccept, setAutoAccept] = React.useState(connection?.autoAccept ?? false);
  const [prep, setPrep] = React.useState(String(connection?.defaultPrepMinutes ?? 20));
  const [enabled, setEnabled] = React.useState(connection?.isEnabled ?? true);
  const [testMsg, setTestMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  const onSave = () => save.mutate({
    id: saved?.id ?? null,
    data: {
      platform: "foodpanda", environment: env, branchId, remoteId: remoteId.trim(), username: username.trim() || null,
      password: password || undefined, pluginSecret: secret || undefined, autoAccept,
      defaultPrepMinutes: Math.min(180, Math.max(5, Number(prep) || 20)), isEnabled: enabled,
    },
  }, { onSuccess: c => { setSaved(c); setPassword(""); setSecret(""); } });

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast.success("Copied."), () => undefined);
  const field = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-background p-5 space-y-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-lg font-bold">{saved ? "Foodpanda connection" : "Connect a branch to Foodpanda"}</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center"><X className="h-5 w-5" /></button>
        </div>

        <ol className="list-decimal ps-5 text-sm text-muted-foreground space-y-1">
          <li>Ask your Foodpanda account manager for POS integration and the <b>sandbox</b> (staging) credentials: a username, password and plugin secret.</li>
          <li>Enter them below with the vendor id Foodpanda uses for this branch, and save.</li>
          <li>Give Foodpanda the <b>plugin address</b> shown after saving. Place a test order; it appears on this branch&apos;s till.</li>
          <li>When it works, switch to <b>Live</b> with your live credentials.</li>
        </ol>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Environment</span>
            <select value={env} disabled={!canEdit} onChange={e => setEnv(e.target.value as "sandbox" | "production")} className={field}>
              <option value="sandbox">Sandbox (Delivery Hero staging)</option>
              <option value="production">Live</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Branch</span>
            <select value={branchId} disabled={!canEdit} onChange={e => setBranchId(e.target.value)} className={field}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">Foodpanda vendor (remote) id</span>
            <Input value={remoteId} disabled={!canEdit} onChange={e => setRemoteId(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Username</span>
            <Input value={username} disabled={!canEdit} onChange={e => setUsername(e.target.value)} autoComplete="off" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Password</span>
            <Input type="password" value={password} disabled={!canEdit} onChange={e => setPassword(e.target.value)}
              placeholder={saved?.passwordSet ? "Saved — leave empty to keep" : ""} autoComplete="new-password" />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">Plugin secret</span>
            <Input type="password" value={secret} disabled={!canEdit} onChange={e => setSecret(e.target.value)}
              placeholder={saved?.pluginSecretSet ? "Saved — leave empty to keep" : "The secret Foodpanda signs its calls with"} autoComplete="new-password" />
            {env === "production" && !secret && !saved?.pluginSecretSet && (
              <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> Live orders are refused until a plugin secret is saved.</span>
            )}
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Default ready time (minutes)</span>
            <Input type="number" min={5} max={180} value={prep} disabled={!canEdit} onChange={e => setPrep(e.target.value)} />
          </label>
          <div className="space-y-2 text-sm pt-6">
            <label className="flex items-center gap-2"><input type="checkbox" checked={autoAccept} disabled={!canEdit} onChange={e => setAutoAccept(e.target.checked)} /> Accept orders automatically</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} disabled={!canEdit} onChange={e => setEnabled(e.target.checked)} /> Taking orders</label>
          </div>
        </div>

        {saved && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-sm font-medium">Plugin address for Foodpanda</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-xs">{saved.pluginBaseUrl}</code>
              <Button size="sm" variant="outline" onClick={() => copy(saved.pluginBaseUrl)}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">Keep it private — together with the plugin secret it lets orders in.</p>
          </div>
        )}

        {testMsg && (
          <p className={cn("flex items-center gap-1.5 text-sm", testMsg.ok ? "text-emerald-600" : "text-destructive")}>
            {testMsg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{testMsg.text}
          </p>
        )}

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={onSave} disabled={save.isPending || !branchId || !remoteId.trim()}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin me-1" />} Save
            </Button>
            {saved && (
              <Button variant="outline" disabled={test.isPending}
                onClick={() => { setTestMsg(null); test.mutate(saved.id, { onSuccess: r => setTestMsg({ ok: r.ok, text: r.message }) }); }}>
                {test.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Zap className="h-4 w-4 me-1" />} Test sign-in
              </Button>
            )}
            {saved && (
              <Button variant="ghost" className="text-destructive ms-auto" disabled={remove.isPending}
                onClick={() => confirmRemove ? remove.mutate(saved.id, { onSuccess: onClose }) : setConfirmRemove(true)}>
                <Trash2 className="h-4 w-4 me-1" /> {confirmRemove ? "Press again to disconnect" : "Disconnect"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
