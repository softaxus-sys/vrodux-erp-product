import * as React from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tenantSettingsApi } from "@/lib/identity/tenant-settings.api";
import { useAuthStore } from "@/store/auth.store";

const KEY = ["tenant-settings", "microsoft-signin"];
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lets a workspace administrator connect their own Microsoft Entra ID (Microsoft 365) app, so staff sign in
 * with their work account. Each workspace uses its own app registration, so one customer's directory is
 * never trusted by another's. The client secret is stored encrypted and is never shown again.
 */
export function MicrosoftSignInCard() {
  const has = useAuthStore(s => s.hasRawPermission);
  const canEdit = has("settings.users.edit") || has("settings.security.edit");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: tenantSettingsApi.getMicrosoftSignIn, enabled: canEdit });
  const [f, setF] = React.useState({ enabled: false, directoryId: "", clientId: "", clientSecret: "" });
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { if (q.data) setF(p => ({ ...p, enabled: q.data!.enabled, directoryId: q.data!.directoryId ?? "", clientId: q.data!.clientId ?? "" })); }, [q.data]);
  const save = useMutation({
    mutationFn: () => tenantSettingsApi.saveMicrosoftSignIn({ enabled: f.enabled, directoryId: f.directoryId.trim(), clientId: f.clientId.trim(), clientSecret: f.clientSecret.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); setF(p => ({ ...p, clientSecret: "" })); toast.success("Microsoft sign-in saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!canEdit) return null;
  const idsOk = GUID.test(f.directoryId.trim()) && GUID.test(f.clientId.trim());
  const needsSecret = !q.data?.hasSecret && !f.clientSecret.trim();
  const canSave = !f.enabled || (idsOk && !needsSecret);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Sign in with Microsoft 365</CardTitle>
        <CardDescription>Let your staff sign in with their work account. Password sign-in keeps working; people who aren't set up here are unaffected.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {q.isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : (
          <>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal ps-5">
              <li>In the Azure portal, open <b>Microsoft Entra ID → App registrations → New registration</b>. Choose <i>Accounts in this organizational directory only</i>.</li>
              <li>Add this <b>Redirect URI</b> (type <i>Web</i>):
                <span className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 font-mono text-xs text-foreground break-all">
                  {q.data?.redirectUri}
                  <button type="button" className="ms-auto shrink-0 p-1 rounded hover:bg-muted" aria-label="Copy"
                    onClick={() => navigator.clipboard.writeText(q.data!.redirectUri).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
                    {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}</button></span></li>
              <li>Under <b>Certificates &amp; secrets</b>, create a client secret. Copy its <i>Value</i>.</li>
              <li>Paste the three values below. People are matched to Vrodux users by their email address.</li>
            </ol>
            <div className="grid gap-4">
              <label className="space-y-1.5 block"><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Directory (tenant) ID</span>
                <Input value={f.directoryId} onChange={e => setF({ ...f, directoryId: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" /></label>
              <label className="space-y-1.5 block"><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Application (client) ID</span>
                <Input value={f.clientId} onChange={e => setF({ ...f, clientId: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" /></label>
              <label className="space-y-1.5 block"><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client secret</span>
                <Input type="password" autoComplete="new-password" value={f.clientSecret} onChange={e => setF({ ...f, clientSecret: e.target.value })}
                  placeholder={q.data?.hasSecret ? "A secret is saved — leave blank to keep it" : "Paste the secret value"} /></label>
            </div>
            {f.enabled && !idsOk && <p className="text-xs text-amber-600">Both IDs should look like 00000000-0000-0000-0000-000000000000.</p>}
            <label className="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4" checked={f.enabled} onChange={e => setF({ ...f, enabled: e.target.checked })} /> Allow sign-in with Microsoft</label>
            <div className="flex justify-end"><Button disabled={save.isPending || !canSave} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="size-4 animate-spin" />} Save</Button></div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
