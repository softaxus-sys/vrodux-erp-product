import * as React from "react";
import { Cpu, Copy, Check } from "lucide-react";
import { licenseApi, type LicenseStatus } from "@/lib/identity/license.api";
import { formatDate } from "@/lib/utils";

/**
 * On-premises only: this computer's device ID (the code a machine-bound licence key is issued
 * for) plus the licence expiry. Renders nothing on the cloud, where it does not apply.
 */
export function LicenceCard() {
  const [status, setStatus] = React.useState<LicenseStatus | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    licenseApi.status().then(setStatus).catch(() => {});
  }, []);

  // machineCode is only ever returned by an on-premises server — never shown on the cloud.
  if (!status?.isOnPremises || !status.machineCode) return null;
  const code = status.machineCode && status.machineCode !== "UNKNOWN" ? status.machineCode : null;

  const copy = () => {
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Licence &amp; Device</h2>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1">Device ID</p>
        {code ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-semibold tracking-wider">{code}</span>
            <button onClick={copy} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Copy">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Could not be read on this computer.</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">
          Send this ID to Softaxis when requesting or renewing a licence key for this computer.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Licence</p>
          <p className="font-medium">{status.licensed ? (status.expired ? "Expired" : "Active") : "Not activated"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Expires</p>
          <p className="font-medium">
            {status.expiresAt ? formatDate(status.expiresAt) : "—"}
            {status.daysLeft != null && !status.expired && (
              <span className="text-xs text-muted-foreground"> ({status.daysLeft} days left)</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
