import * as React from "react";
import { KeyRound, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { licenseApi, type LicenseActivation } from "@/lib/identity/license.api";

/**
 * Paste-a-licence-key panel.
 *
 * Shown on the blocked screen of an on-premises installation whose licence has lapsed, which is
 * the moment the customer has just paid and wants to trade again. Before this, the only way to
 * install a renewed key was to edit appsettings.json on their server and restart the service.
 *
 * Self-contained on purpose: no auth store, no react-query, no toasts. It has to work on a screen
 * where nobody is signed in and every other API call is being refused.
 */
export function LicenseActivation({ onActivated }: { onActivated?: () => void }) {
  const [key,     setKey]     = React.useState("");
  const [busy,    setBusy]    = React.useState(false);
  const [error,   setError]   = React.useState<string | null>(null);
  const [result,  setResult]  = React.useState<LicenseActivation | null>(null);
  const [machine, setMachine] = React.useState<string | null>(null);
  const [copied,  setCopied]  = React.useState(false);

  // The code Softaxis needs to issue a key for THIS computer. Works offline: it is read from the
  // local server, and the customer can read it out over the phone.
  React.useEffect(() => {
    licenseApi.status().then(s => setMachine(s.machineCode ?? null)).catch(() => {});
  }, []);

  const copyMachine = () => {
    if (!machine) return;
    navigator.clipboard?.writeText(machine).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    try {
      const r = await licenseApi.activate(trimmed);
      setResult(r);
      onActivated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate the licence.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900">
              {result.alreadyInUse
                ? "That licence was already installed"
                : "Licence activated"}
            </p>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
              {result.tenantName} · {result.plan} · up to{" "}
              {result.maxUsers > 0 ? `${result.maxUsers} users` : "unlimited users"}
              <br />
              Valid for {result.daysLeft} more day{result.daysLeft === 1 ? "" : "s"}, until{" "}
              {new Date(result.expiresAt).toLocaleDateString()}.
              {result.modules.length > 0 && <> Modules: {result.modules.join(", ")}.</>}
            </p>

            {/* A full reload, not a route change: every cached 403 from the blocked state has to
                go, and the JWT needs re-issuing to pick up the new plan and modules. */}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2
                         text-sm font-medium text-white hover:bg-emerald-700"
            >
              Continue to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Activate a licence key</h3>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed mb-3">
        Paste the key Softaxis sent you. It takes effect immediately — the server does not need to
        be restarted, and nothing on this installation is changed apart from the licence.
      </p>

      {machine && machine !== "UNKNOWN" && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500">This computer's code — send it to Softaxis with your request</p>
            <p className="font-mono text-sm font-semibold tracking-wider text-slate-900">{machine}</p>
          </div>
          <button type="button" onClick={copyMachine}
            className="shrink-0 text-xs font-medium text-blue-600 hover:underline">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      <textarea
        value={key}
        onChange={e => { setKey(e.target.value); setError(null); }}
        rows={4}
        spellCheck={false}
        autoComplete="off"
        placeholder="Paste the whole key, including any line breaks…"
        disabled={busy}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[11px]
                   leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30
                   disabled:opacity-60 break-all"
      />

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-red-700" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={busy || key.trim().length === 0}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm
                   font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {busy ? "Activating…" : "Activate"}
      </button>
    </form>
  );
}
