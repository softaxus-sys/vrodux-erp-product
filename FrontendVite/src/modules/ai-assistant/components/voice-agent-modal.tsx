import * as React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  KeyRound,
  Loader2,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { useUsers } from "@/hooks/identity/use-users";
import { useAuthStore } from "@/store/auth.store";
import { useUpdateVoiceSettings, useVoiceCalls, useVoiceSettings } from "@/hooks/ai/use-ai";
import type { ScheduledCallDto, ScheduledCallStatus, VoiceLanguage } from "@/lib/ai/ai.api";

/**
 * Admin configuration for the outbound AI voice agent (BYO Vapi account) plus the log of
 * calls it has placed. Opened from the AI Assistant header (settings.ai gated).
 */
export function VoiceAgentModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = React.useState<"settings" | "calls">("settings");

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-xl flex flex-col max-h-[85vh]"
        initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-primary" />
            Voice Agent
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button onClick={() => setTab("settings")}
                className={cn("px-3 py-1.5 transition-colors", tab === "settings" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                Settings
              </button>
              <button onClick={() => setTab("calls")}
                className={cn("px-3 py-1.5 transition-colors", tab === "calls" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                Calls
              </button>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {tab === "settings" ? <VoiceSettingsForm onClose={onClose} /> : <VoiceCallsList />}
      </motion.div>
    </motion.div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

function VoiceSettingsForm({ onClose }: { onClose: () => void }) {
  const { data: settings, isLoading } = useVoiceSettings(true);
  const save = useUpdateVoiceSettings();

  const meId = useAuthStore(s => s.user?.id);
  const meName = useAuthStore(s => s.user?.name ?? "me");

  const [enabled, setEnabled] = React.useState(false);
  const [apiKey, setApiKey] = React.useState("");
  const [clearKey, setClearKey] = React.useState(false);
  const [phoneNumberId, setPhoneNumberId] = React.useState("");
  const [assistantId, setAssistantId] = React.useState("");
  const [runAsUserId, setRunAsUserId] = React.useState<string | null>(null);
  const [runAsUserName, setRunAsUserName] = React.useState("");
  const [userSearch, setUserSearch] = React.useState("");
  const [callDelayMinutes, setCallDelayMinutes] = React.useState(5);
  const [maxAttempts, setMaxAttempts] = React.useState(3);
  const [monthlyMinutesCap, setMonthlyMinutesCap] = React.useState(0);
  const [defaultLanguage, setDefaultLanguage] = React.useState<VoiceLanguage>("en");
  const [agentName, setAgentName] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [companyDescription, setCompanyDescription] = React.useState("");
  const [knowledge, setKnowledge] = React.useState("");

  const { data: usersPage } = useUsers({ search: userSearch, pageSize: 8 });

  // Hydrate from the server once loaded.
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    if (!settings || hydrated.current) return;
    hydrated.current = true;
    setEnabled(settings.enabled);
    setPhoneNumberId(settings.vapiPhoneNumberId ?? "");
    setAssistantId(settings.vapiAssistantId ?? "");
    if (settings.runAsUserId && settings.runAsUserId !== "00000000-0000-0000-0000-000000000000") {
      setRunAsUserId(settings.runAsUserId);
      setRunAsUserName(settings.runAsUserId === meId ? `${meName} (you)` : "configured user");
    }
    setCallDelayMinutes(settings.callDelayMinutes);
    setMaxAttempts(settings.maxAttempts);
    setMonthlyMinutesCap(settings.monthlyMinutesCap);
    setDefaultLanguage(settings.defaultLanguage);
    setAgentName(settings.agentName ?? "");
    setCompanyName(settings.companyName ?? "");
    setIndustry(settings.industry ?? "");
    setCompanyDescription(settings.companyDescription ?? "");
    setKnowledge(settings.knowledge ?? "");
  }, [settings, meId, meName]);

  const handleSave = () => {
    save.mutate({
      enabled,
      vapiApiKey: apiKey.trim() || null,
      clearVapiApiKey: clearKey,
      vapiPhoneNumberId: phoneNumberId.trim() || null,
      vapiAssistantId: assistantId.trim() || null,
      runAsUserId: runAsUserId ?? meId ?? "00000000-0000-0000-0000-000000000000",
      callDelayMinutes,
      maxAttempts,
      monthlyMinutesCap,
      defaultLanguage,
      agentName: agentName.trim() || null,
      companyName: companyName.trim() || null,
      companyDescription: companyDescription.trim() || null,
      industry: industry.trim() || null,
      knowledge: knowledge.trim() || null,
    }, { onSuccess: () => { setApiKey(""); setClearKey(false); onClose(); } });
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const keyStored = !!settings?.hasVapiApiKey && !clearKey;

  return (
    <div className="p-4 overflow-y-auto space-y-4">
      <p className="text-xs text-muted-foreground">
        When a new lead arrives, an AI agent phones them a few minutes later, speaks as your company,
        and logs the call on the lead. Calls are billed to your own Vapi account.
      </p>

      {/* Enable */}
      <label className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer">
        <div>
          <div className="text-sm font-medium">Enable outbound calls</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Requires a Vapi API key and phone number below.
          </p>
        </div>
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
      </label>

      {/* Vapi account */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vapi API key" hint={keyStored ? "A key is stored — enter a new one to replace it." : undefined}>
          <div className="relative">
            <KeyRound className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={keyStored ? "••••••••  (key set)" : "Your Vapi private key"}
              className="w-full h-9 rounded-lg border border-border bg-card pl-8 pr-3 text-sm" />
          </div>
          {keyStored && (
            <button className="text-[11px] text-destructive hover:underline mt-1" onClick={() => setClearKey(true)}>
              Remove stored key
            </button>
          )}
          {clearKey && <p className="text-[11px] text-destructive mt-1">Key will be removed on save.</p>}
        </Field>
        <Field label="Vapi phone number ID" hint="The number the agent calls from (from your Vapi dashboard).">
          <input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)}
            placeholder="e.g. 6f1a2b3c-…"
            className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm" />
        </Field>
      </div>

      <Field label="Vapi assistant ID (optional)"
        hint="A persistent assistant from your Vapi dashboard. When set, its prompt, voice, and language settings drive the call — the persona fields below become {{agentName}}-style template variables instead of a generated prompt.">
        <input value={assistantId} onChange={e => setAssistantId(e.target.value)}
          placeholder="e.g. 75a66a91-159f-46eb-977e-05bba37fb266"
          className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm" />
      </Field>

      {/* Run as */}
      <Field label="Act as" hint="Lead updates after each call are written with this user's permissions.">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-md bg-muted">{runAsUserId ? runAsUserName : `${meName} (you)`}</span>
            {runAsUserId && (
              <button className="text-primary hover:underline" onClick={() => { setRunAsUserId(null); setRunAsUserName(""); }}>
                reset to me
              </button>
            )}
          </div>
          <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users…"
            className="w-full h-8 rounded-lg border border-border bg-card px-3 text-xs" />
          {userSearch && usersPage?.items && usersPage.items.length > 0 && (
            <div className="rounded-lg border border-border bg-card max-h-32 overflow-y-auto">
              {usersPage.items.map(u => (
                <button key={u.id} onClick={() => { setRunAsUserId(u.id); setRunAsUserName(u.fullName || u.username); setUserSearch(""); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex justify-between">
                  <span>{u.fullName || u.username}</span>
                  <span className="text-muted-foreground">{u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      {/* Dialing behaviour */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Call delay (min)">
          <input type="number" min={0} max={1440} value={callDelayMinutes}
            onChange={e => setCallDelayMinutes(Math.max(0, Number(e.target.value)))}
            className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm" />
        </Field>
        <Field label="Max attempts">
          <input type="number" min={1} max={10} value={maxAttempts}
            onChange={e => setMaxAttempts(Math.max(1, Number(e.target.value)))}
            className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm" />
        </Field>
        <Field label="Minutes cap / mo" hint="0 = unlimited">
          <input type="number" min={0} value={monthlyMinutesCap}
            onChange={e => setMonthlyMinutesCap(Math.max(0, Number(e.target.value)))}
            className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm" />
        </Field>
        <Field label="Language">
          <select value={defaultLanguage} onChange={e => setDefaultLanguage(e.target.value as VoiceLanguage)}
            className="w-full h-9 rounded-lg border border-border bg-card px-2 text-sm">
            <option value="en">English</option>
            <option value="ur">Urdu</option>
            <option value="ar">Arabic</option>
          </select>
        </Field>
      </div>

      {settings && settings.monthlyMinutesCap > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Used this month: <b>{settings.minutesUsedThisMonth.toFixed(1)}</b> / {settings.monthlyMinutesCap} min.
        </p>
      )}

      {/* Persona */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Agent name" hint='How the agent introduces itself ("Hi, this is Sara…").'>
          <input value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="e.g. Sara"
            className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm" />
        </Field>
        <Field label="Company name">
          <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Emaar Properties"
            className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm" />
        </Field>
      </div>
      <Field label="Industry">
        <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. real estate"
          className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm" />
      </Field>
      <Field label="About the company">
        <textarea value={companyDescription} onChange={e => setCompanyDescription(e.target.value)} rows={2}
          placeholder="One or two sentences the agent can use to describe the company."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-none" />
      </Field>
      <Field label="Knowledge" hint="What the agent may say — offerings, areas, price ranges. It never invents anything beyond this.">
        <textarea value={knowledge} onChange={e => setKnowledge(e.target.value)} rows={4}
          placeholder="e.g. We sell 1–3 bed apartments in Dubai Marina from AED 1.2M…"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-none" />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={save.isPending} className="gap-1.5">
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}

// ── Calls list ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ScheduledCallStatus, { label: string; className: string; icon: React.ElementType }> = {
  pending:     { label: "Scheduled",   className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",     icon: Phone },
  dialing:     { label: "Dialing",     className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",  icon: PhoneCall },
  in_progress: { label: "In call",     className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",  icon: PhoneCall },
  completed:   { label: "Completed",   className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  no_answer:   { label: "No answer",   className: "bg-orange-500/10 text-orange-600 dark:text-orange-400", icon: PhoneMissed },
  failed:      { label: "Failed",      className: "bg-red-500/10 text-red-600 dark:text-red-400",        icon: PhoneOff },
  canceled:    { label: "Canceled",    className: "bg-muted text-muted-foreground",                      icon: PhoneOff },
};

function VoiceCallsList() {
  const { data: calls, isLoading } = useVoiceCalls(true);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!calls || calls.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        No calls yet. Once the voice agent is enabled, calls to new leads appear here.
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto space-y-2">
      {calls.map(c => {
        const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending;
        const Icon = cfg.icon;
        const expanded = expandedId === c.id;
        return (
          <div key={c.id} className="rounded-lg border border-border">
            <button onClick={() => setExpandedId(expanded ? null : c.id)}
              className="w-full flex items-center gap-3 p-3 text-left">
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0", cfg.className)}>
                <Icon className="h-3 w-3" />{cfg.label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{c.leadName}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {c.phone} · {formatDate(c.createdAt)}
                  {c.durationSeconds > 0 && ` · ${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s`}
                  {c.attemptCount > 1 && ` · attempt ${c.attemptCount}`}
                </div>
              </div>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>

            {expanded && (
              <div className="border-t border-border p-3 space-y-2 text-xs">
                {c.summary && (
                  <div>
                    <div className="font-medium mb-0.5">Summary</div>
                    <p className="text-muted-foreground whitespace-pre-wrap">{c.summary}</p>
                  </div>
                )}
                {c.error && <p className="text-destructive">{c.error}</p>}
                {c.recordingUrl && (
                  <a href={c.recordingUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Recording
                  </a>
                )}
                {c.transcriptText && (
                  <details>
                    <summary className="cursor-pointer font-medium">Transcript</summary>
                    <pre className="mt-1 whitespace-pre-wrap font-sans text-muted-foreground max-h-48 overflow-y-auto">{c.transcriptText}</pre>
                  </details>
                )}
                {!c.summary && !c.transcriptText && !c.error && !c.recordingUrl && (
                  <p className="text-muted-foreground">No call details yet.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Shared field wrapper ──────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
