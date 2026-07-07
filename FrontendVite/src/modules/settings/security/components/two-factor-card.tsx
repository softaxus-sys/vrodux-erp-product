import * as React from "react";
import { ShieldCheck, ShieldOff, Loader2, Copy, Check, KeyRound, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  useTwoFactorStatus, useSetupTwoFactor, useEnableTwoFactor, useDisableTwoFactor,
} from "@/hooks/identity/use-2fa";
import type { TwoFactorSetupDto } from "@/lib/identity/types";
import { downloadFile } from "@/lib/csv";
import { toast } from "sonner";

type Mode = "idle" | "enrolling" | "backup" | "disabling";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : (label ?? "Copy")}
    </button>
  );
}

export function TwoFactorCard() {
  const { data: status, isLoading } = useTwoFactorStatus();
  const setup   = useSetupTwoFactor();
  const enable  = useEnableTwoFactor();
  const disable = useDisableTwoFactor();

  const [mode, setMode]           = React.useState<Mode>("idle");
  const [setupData, setSetupData] = React.useState<TwoFactorSetupDto | null>(null);
  const [code, setCode]           = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);

  const enabled = status?.enabled ?? false;

  const startEnroll = async () => {
    try {
      const data = await setup.mutateAsync();
      setSetupData(data);
      setCode("");
      setMode("enrolling");
    } catch { /* hook toasts */ }
  };

  const confirmEnable = async () => {
    try {
      const res = await enable.mutateAsync(code.trim());
      setBackupCodes(res.backupCodes);
      setCode("");
      setMode("backup");
    } catch { /* hook toasts */ }
  };

  const confirmDisable = async () => {
    try {
      await disable.mutateAsync(code.trim());
      setCode("");
      setMode("idle");
    } catch { /* hook toasts */ }
  };

  const downloadCodes = () =>
    downloadFile(`vrodux-backup-codes-${new Date().toISOString().split("T")[0]}.txt`,
      `Vrodux ERP — two-factor backup codes\nEach code works once. Keep them somewhere safe.\n\n${backupCodes.join("\n")}\n`);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${enabled ? "bg-success/10" : "bg-muted"}`}>
              {enabled ? <ShieldCheck className="h-5 w-5 text-success" /> : <ShieldOff className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
              <CardDescription>
                Require a code from an authenticator app (Google Authenticator, Authy, 1Password…) at sign-in.
              </CardDescription>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${enabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
            {isLoading ? "…" : enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── IDLE — enabled summary or enable CTA ─────────────────────────── */}
        {mode === "idle" && (
          enabled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  {status?.backupCodesRemaining ?? 0} backup code{(status?.backupCodesRemaining ?? 0) === 1 ? "" : "s"} remaining
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setCode(""); setMode("disabling"); }}
                className="rounded-lg border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors"
              >
                Disable 2FA
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEnroll}
              disabled={setup.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
            >
              {setup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Enable 2FA
            </button>
          )
        )}

        {/* ── ENROLLING — QR + secret + confirm code ───────────────────────── */}
        {mode === "enrolling" && setupData && (
          <div className="space-y-4">
            <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
              <li>Scan this QR code in your authenticator app.</li>
              <li>Enter the 6-digit code it shows to confirm.</li>
            </ol>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <img
                src={setupData.qrCodeDataUri}
                alt="Authenticator QR code"
                className="h-40 w-40 rounded-lg border border-border bg-white p-2"
              />
              <div className="space-y-2 min-w-0">
                <p className="text-xs text-muted-foreground">Can't scan? Enter this key manually:</p>
                <div className="flex items-center gap-2">
                  <code className="rounded-md bg-muted px-2 py-1 text-xs break-all">{setupData.secret}</code>
                  <CopyButton text={setupData.secret} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="w-40 rounded-lg border border-border bg-card px-3 py-2 text-center text-lg tracking-[0.3em] font-semibold outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmEnable}
                  disabled={enable.isPending || code.trim().length < 6}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
                >
                  {enable.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verify &amp; enable
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("idle"); setSetupData(null); setCode(""); }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BACKUP — show one-time codes ─────────────────────────────────── */}
        {mode === "backup" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
              <p className="font-semibold text-warning">Save your backup codes</p>
              <p className="text-muted-foreground mt-0.5">
                Each code works once if you lose access to your authenticator. They won't be shown again.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((c) => (
                <code key={c} className="rounded-md bg-muted px-3 py-1.5 text-center text-sm font-mono tracking-wider">{c}</code>
              ))}
            </div>
            <div className="flex gap-2">
              <CopyButton text={backupCodes.join("\n")} label="Copy all" />
              <button
                type="button"
                onClick={downloadCodes}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
              >
                Download .txt
              </button>
              <button
                type="button"
                onClick={() => { setMode("idle"); setBackupCodes([]); toast.success("Two-factor authentication is now active."); }}
                className="ml-auto rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── DISABLING — confirm with a code ──────────────────────────────── */}
        {mode === "disabling" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter a current authenticator or backup code to turn off 2FA.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="text"
              autoComplete="one-time-code"
              placeholder="Authenticator or backup code"
              className="w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmDisable}
                disabled={disable.isPending || code.trim().length < 6}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5 transition disabled:opacity-50"
              >
                {disable.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm disable
              </button>
              <button
                type="button"
                onClick={() => { setMode("idle"); setCode(""); }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
