import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/identity/auth.api";

/** The four-square Microsoft mark, drawn inline so the login page needs no extra asset. */
function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

/**
 * "Sign in with Microsoft". It asks the server where THIS person's workspace sends them, so one login
 * page serves every customer: a workspace that hasn't switched Microsoft sign-in on just gets a clear
 * message and carries on with a password. Nothing here changes how password sign-in works.
 */
export function MicrosoftSignInButton({ email, colors }: {
  email: string;
  colors: { border: string; white: string; muted: string; inputBg: string };
}) {
  const [busy, setBusy] = React.useState(false);
  const go = async () => {
    const e = email.trim();
    if (!e.includes("@")) { toast.message("Type your work email above first, then choose Microsoft."); return; }
    setBusy(true);
    try {
      const r = await authApi.microsoftStart(e);
      if (r.enabled && r.url) { window.location.assign(r.url); return; }
      toast.message("Microsoft sign-in isn't switched on for your organisation. Use your password, or ask your administrator.");
    } catch (err) {
      toast.error((err as Error).message || "Couldn't start Microsoft sign-in.");
    } finally { setBusy(false); }
  };
  return (
    <button type="button" onClick={go} disabled={busy}
      className="w-full h-11 rounded-lg flex items-center justify-center gap-2.5 text-[13px] font-semibold border transition-colors hover:opacity-90 disabled:opacity-50"
      style={{ borderColor: colors.border, color: colors.white, background: colors.inputBg }}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MicrosoftMark />}
      Sign in with Microsoft
    </button>
  );
}
