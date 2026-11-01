import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Mic, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePlatformAi, usePlatformAiUsage, useTestPlatformAi, useTestPlatformVoice, useUpdatePlatformAi } from "@/hooks/ai/use-ai-platform";
import type { AiProvider } from "@/lib/ai/ai.api";

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: "OpenRouter", label: "OpenRouter (free and paid models)" },
  { value: "GroqFree", label: "Groq (free tier)" },
  { value: "GroqPaid", label: "Groq (paid)" },
  { value: "Claude", label: "Anthropic Claude" },
];

const int = (v: string) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : 0; };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * Platform owner: the AI every workspace without its own key falls back to. A workspace's own key
 * is always used first; this one is the default for everyone else and the safety net behind a
 * workspace's own key when its provider is down. Keys are write-only.
 */
export function AiPlatformView() {
  const navigate = useNavigate();
  const { data, isLoading } = usePlatformAi();
  const { data: usage } = usePlatformAiUsage();
  const save = useUpdatePlatformAi();
  const test = useTestPlatformAi();
  const testVoice = useTestPlatformVoice();

  const [f, setF] = React.useState({
    enabled: false, provider: "OpenRouter" as AiProvider, model: "", apiKey: "", clearKey: false,
    cap: "100", nudge: "10", banner: true,
    voiceEnabled: false, stt: "", tts: "", ttsVoice: "", voiceCap: "50", voiceKey: "", clearVoiceKey: false,
  });

  React.useEffect(() => {
    if (!data) return;
    setF({
      enabled: data.enabled, provider: data.provider, model: data.model ?? "", apiKey: "", clearKey: false,
      cap: String(data.monthlyMessageCapPerTenant), nudge: String(data.nudgeEveryMessages), banner: data.showOwnKeyBanner,
      voiceEnabled: data.voiceEnabled, stt: data.sttModel ?? "", tts: data.ttsModel ?? "", ttsVoice: data.ttsVoice ?? "",
      voiceCap: String(data.voiceMonthlyCapPerTenant), voiceKey: "", clearVoiceKey: false,
    });
  }, [data]);

  const submit = () => save.mutate({
    enabled: f.enabled, provider: f.provider, model: f.model.trim() || null,
    apiKey: f.apiKey.trim() || null, clearApiKey: f.clearKey,
    monthlyMessageCapPerTenant: int(f.cap), nudgeEveryMessages: int(f.nudge), showOwnKeyBanner: f.banner,
    voiceEnabled: f.voiceEnabled, sttModel: f.stt.trim() || null, ttsModel: f.tts.trim() || null,
    ttsVoice: f.ttsVoice.trim() || null, voiceMonthlyCapPerTenant: int(f.voiceCap),
    voiceApiKey: f.voiceKey.trim() || null, clearVoiceApiKey: f.clearVoiceKey,
  });

  if (isLoading || !data) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/super-admin")}><ArrowLeft className="h-4 w-4" />Back</Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Platform AI</h1>
          <p className="text-sm text-muted-foreground">
            The AI every workspace uses until it adds its own key. A workspace's own key always comes first.
          </p>
        </div>
      </div>

      <div className={cn("rounded-xl border p-3 text-sm flex items-start gap-2",
        data.ready ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
        {data.ready ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
        <span>{data.ready
          ? "Ready. Workspaces without their own key are being served by the model below."
          : `Not serving anyone yet. ${data.readyIssue ?? ""}`}</span>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="font-semibold">Text assistant</h2>
        <Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Offer the shared AI to workspaces without their own key"
          hint="Off means those workspaces see the assistant as not set up." />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Provider">
            <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={f.provider}
              onChange={(e) => setF({ ...f, provider: e.target.value as AiProvider })}>
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Model" hint={f.provider === "OpenRouter" ? "Paste a model id from openrouter.ai/models. Free models end in :free and change often, so there is no default." : "Leave empty for the provider default."}>
            <Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="e.g. meta-llama/llama-3.3-70b-instruct:free" />
          </Field>
        </div>
        <Field label={`API key ${data.hasApiKey ? "(a key is stored)" : ""}`} hint="Stored encrypted. It is never shown again.">
          <div className="flex gap-2">
            <Input type="password" autoComplete="off" value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value, clearKey: false })}
              placeholder={data.hasApiKey ? "Leave blank to keep the stored key" : "Paste the provider key"} />
            {data.hasApiKey && <Button type="button" variant="outline" size="sm" onClick={() => setF({ ...f, apiKey: "", clearKey: !f.clearKey })}>{f.clearKey ? "Keep" : "Remove"}</Button>}
          </div>
          {f.clearKey && <span className="block text-xs text-destructive">The stored key will be removed when you save.</span>}
        </Field>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={test.isPending} onClick={() => test.mutate()}>
            {test.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Test saved settings
          </Button>
          {test.data && (
            <span className={cn("text-sm", test.data.ok ? "text-emerald-600" : "text-destructive")}>
              {test.data.ok ? `Working (${test.data.latencyMs} ms)` : test.data.message}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="font-semibold">Fair use</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Messages per workspace per month" hint="Once reached, the workspace is asked to add its own key. 0 means no limit.">
            <Input inputMode="numeric" value={f.cap} onChange={(e) => setF({ ...f, cap: e.target.value.replace(/\D/g, "") })} />
          </Field>
          <Field label="Suggest their own key every N messages" hint="A friendly reminder in the chat. 0 turns it off.">
            <Input inputMode="numeric" value={f.nudge} onChange={(e) => setF({ ...f, nudge: e.target.value.replace(/\D/g, "") })} />
          </Field>
        </div>
        <Toggle checked={f.banner} onChange={(v) => setF({ ...f, banner: v })} label="Show a permanent note at the top of the assistant"
          hint="Tells the workspace it is on the shared AI, how much is left, and links to where they add their own key." />
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Mic className="h-4 w-4" />Voice</h2>
        <Toggle checked={f.voiceEnabled} onChange={(v) => setF({ ...f, voiceEnabled: v })} label="Let people talk to the assistant"
          hint="Speech in, spoken answer out, using the models below. When off, the browser's built-in voice is used where it exists." />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Speech-to-text model" hint="An audio-capable model id on the provider above.">
            <Input value={f.stt} onChange={(e) => setF({ ...f, stt: e.target.value })} placeholder="model id" />
          </Field>
          <Field label="Text-to-speech model">
            <Input value={f.tts} onChange={(e) => setF({ ...f, tts: e.target.value })} placeholder="model id" />
          </Field>
          <Field label="Voice name" hint="Provider specific, e.g. alloy.">
            <Input value={f.ttsVoice} onChange={(e) => setF({ ...f, ttsVoice: e.target.value })} />
          </Field>
          <Field label="Voice requests per workspace per month" hint="Each recording or spoken reply is one request. 0 means no limit.">
            <Input inputMode="numeric" value={f.voiceCap} onChange={(e) => setF({ ...f, voiceCap: e.target.value.replace(/\D/g, "") })} />
          </Field>
        </div>
        <Field label={`Separate voice key ${data.hasVoiceApiKey ? "(a key is stored)" : "(optional)"}`} hint="Leave empty to use the text key above.">
          <div className="flex gap-2">
            <Input type="password" autoComplete="off" value={f.voiceKey} onChange={(e) => setF({ ...f, voiceKey: e.target.value, clearVoiceKey: false })}
              placeholder={data.hasVoiceApiKey ? "Leave blank to keep the stored key" : "Optional"} />
            {data.hasVoiceApiKey && <Button type="button" variant="outline" size="sm" onClick={() => setF({ ...f, voiceKey: "", clearVoiceKey: !f.clearVoiceKey })}>{f.clearVoiceKey ? "Keep" : "Remove"}</Button>}
          </div>
        </Field>
      </section>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save</Button>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Use this month</h2>
        {!usage || usage.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workspace has used the shared AI yet this month.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1">Workspace</th><th className="py-1 text-right">Messages</th><th className="py-1 text-right">Voice requests</th></tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.tenantId} className="border-t border-border">
                  <td className="py-1.5">{u.tenantName}</td>
                  <td className="py-1.5 text-right tabular-nums">{u.messages}</td>
                  <td className="py-1.5 text-right tabular-nums">{u.voiceTurns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
