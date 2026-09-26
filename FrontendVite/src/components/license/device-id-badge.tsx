import * as React from "react";
import { Copy, Check, Cpu } from "lucide-react";
import { licenseApi } from "@/lib/identity/license.api";

/**
 * This server's Device ID, for requesting a machine-bound licence key. Shown on the login page
 * because a new on-premises site has no licence — and so no user to sign in with — until the key
 * generated from this ID is entered. Renders nothing on the cloud (the API returns no code there).
 */
export function DeviceIdBadge({ color, muted }: { color?: string; muted?: string }) {
  const [code, setCode] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    licenseApi.status()
      .then(s => setCode(s.machineCode && s.machineCode !== "UNKNOWN" ? s.machineCode : null))
      .catch(() => {});
  }, []);

  if (!code) return null;

  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-[11px]" style={{ color: muted }}>
      <Cpu className="h-3.5 w-3.5" />
      <span>Device ID</span>
      <span className="font-mono font-semibold tracking-wider" style={{ color }}>{code}</span>
      <button type="button" onClick={copy} title="Copy Device ID" className="p-1 rounded hover:opacity-70">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
