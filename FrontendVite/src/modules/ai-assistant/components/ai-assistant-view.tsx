import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, User, RefreshCw, Copy, ThumbsUp, ThumbsDown,
  Lightbulb, TrendingUp, BarChart3, Settings2, X, Loader2, Check, Ban,
  MessageCircle, Link2, ExternalLink, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  useSendChat, useAiSettings, useUpdateAiSettings, useConfirmAction, useAiAgents,
  useTelegramStatus, useGenerateTelegramLink, useUnlinkTelegram, useRegisterTelegramWebhook,
} from "@/hooks/ai/use-ai";
import type { AiProvider, AiTier, ChatHistoryItem, PendingAction } from "@/lib/ai/ai.api";
import { ApiError } from "@/lib/api-client";
import { AutomationsModal } from "./automations-modal";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** Set on an assistant message that proposed a write action awaiting confirmation. */
  pending?: PendingAction | null;
}

const SUGGESTED_PROMPTS = [
  { icon: BarChart3, text: "How many leads do we have?", category: "CRM" },
  { icon: TrendingUp, text: "What is our total pipeline value?", category: "CRM" },
  { icon: Lightbulb, text: "List our leads and who owns each", category: "CRM" },
  { icon: TrendingUp, text: "Which leads are high priority?", category: "CRM" },
];

const WELCOME =
  "Hi! I'm your Vrodux assistant. I can answer questions about your company's data using live records — for example your CRM leads and pipeline. What would you like to know?";

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-1">
      {[0, 1, 2].map(i => (
        <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      ))}
    </div>
  );
}

export function AIAssistantView() {
  const [messages, setMessages] = React.useState<Message[]>([
    { id: "welcome", role: "assistant", content: WELCOME, timestamp: now() },
  ]);
  const [input, setInput] = React.useState("");
  const [showSettings, setShowSettings] = React.useState(false);
  const [showAutomations, setShowAutomations] = React.useState(false);
  const [showTelegram, setShowTelegram] = React.useState(false);
  const [agent, setAgent] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const sendChat = useSendChat();
  const confirmAction = useConfirmAction();
  const { data: agents } = useAiAgents();
  const isTyping = sendChat.isPending || confirmAction.isPending;

  const canManageAi = useAuthStore((s) => s.hasRawPermission("settings.ai.edit"));

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = React.useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sendChat.isPending) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: trimmed, timestamp: now() };

    // Build history from the conversation so far (exclude the welcome placeholder).
    const history: ChatHistoryItem[] = messages
      .filter(m => m.id !== "welcome")
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, userMsg]);
    setInput("");

    try {
      const res = await sendChat.mutateAsync({ message: trimmed, history, agent });
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: "assistant", content: res.reply, timestamp: now(),
        pending: res.pendingAction ?? null,
      }]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Something went wrong reaching the assistant.";
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: "assistant",
        content: `⚠️ ${msg}`, timestamp: now(),
      }]);
    }
  }, [messages, sendChat, agent]);

  const handleConfirm = React.useCallback(async (msgId: string, pending: PendingAction) => {
    // Clear the pending prompt so the buttons disappear immediately.
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pending: null } : m));
    try {
      const res = await confirmAction.mutateAsync({
        toolName: pending.toolName,
        argumentsJson: pending.argumentsJson,
      });
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: "assistant", content: res.reply, timestamp: now(),
      }]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "The action could not be completed.";
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: "assistant", content: `⚠️ ${msg}`, timestamp: now(),
      }]);
    }
  }, [confirmAction]);

  const handleCancel = React.useCallback((msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pending: null } : m));
    setMessages(prev => [...prev, {
      id: `a-${Date.now()}`, role: "assistant",
      content: "No problem — I won't make that change.", timestamp: now(),
    }]);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () =>
    setMessages([{ id: "welcome", role: "assistant", content: WELCOME, timestamp: now() }]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">Powered by your ERP data</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowTelegram(true)} className="gap-1.5 text-muted-foreground h-8">
            <MessageCircle className="h-3.5 w-3.5" />Telegram
          </Button>
          {canManageAi && (
            <Button variant="ghost" size="sm" onClick={() => setShowAutomations(true)} className="gap-1.5 text-muted-foreground h-8">
              <Bot className="h-3.5 w-3.5" />Automations
            </Button>
          )}
          {canManageAi && (
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} className="gap-1.5 text-muted-foreground h-8">
              <Settings2 className="h-3.5 w-3.5" />Settings
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1.5 text-muted-foreground h-8">
            <RefreshCw className="h-3.5 w-3.5" />Clear
          </Button>
        </div>
      </div>

      {/* Agent selector (call-by-name targets) */}
      {agents && agents.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span className="text-[11px] text-muted-foreground mr-1">Agent:</span>
          <button onClick={() => setAgent(null)}
            className={cn("px-2.5 py-1 rounded-full text-[11px] border transition-colors",
              agent === null ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40")}>
            Auto
          </button>
          {agents.map(a => (
            <button key={a.key} onClick={() => setAgent(a.key)}
              className={cn("px-2.5 py-1 rounded-full text-[11px] border transition-colors",
                agent === a.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40")}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Suggested prompts */}
      {messages.length === 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {SUGGESTED_PROMPTS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => sendMessage(p.text)}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-muted/30 text-left transition-all">
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium leading-tight">{p.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.category}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                msg.role === "assistant" ? "bg-gradient-to-br from-primary to-purple-500" : "bg-muted")}>
                {msg.role === "assistant" ? <Sparkles className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className={cn("max-w-[78%]", msg.role === "user" ? "items-end" : "items-start", "flex flex-col gap-1")}>
                <div className={cn("rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border rounded-tl-sm")}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
                {msg.pending && (
                  <div className="mt-1 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 w-full">
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mb-2">
                      ⚠ This will change data. Confirm to proceed.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 gap-1" disabled={confirmAction.isPending}
                        onClick={() => handleConfirm(msg.id, msg.pending!)}>
                        <Check className="h-3.5 w-3.5" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1" disabled={confirmAction.isPending}
                        onClick={() => handleCancel(msg.id)}>
                        <Ban className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                  {msg.role === "assistant" && msg.id !== "welcome" && (
                    <>
                      <button onClick={() => navigator.clipboard?.writeText(msg.content)} className="text-muted-foreground hover:text-foreground transition-colors"><Copy className="h-3 w-3" /></button>
                      <button className="text-muted-foreground hover:text-success transition-colors"><ThumbsUp className="h-3 w-3" /></button>
                      <button className="text-muted-foreground hover:text-destructive transition-colors"><ThumbsDown className="h-3 w-3" /></button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <TypingIndicator />
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-card border border-border rounded-2xl p-3 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about your business data…"
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground max-h-32"
          style={{ lineHeight: "1.5" }}
        />
        <Button onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping}
          size="sm" className="h-8 w-8 p-0 rounded-xl shrink-0">
          {isTyping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-2">
        AI responses are based on your ERP data. Always verify critical decisions.
      </p>

      <AnimatePresence>
        {showSettings && <AiSettingsModal onClose={() => setShowSettings(false)} />}
        {showTelegram && <TelegramLinkModal onClose={() => setShowTelegram(false)} />}
        {showAutomations && <AutomationsModal onClose={() => setShowAutomations(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ── AI settings modal (admin) ──────────────────────────────────────────────────

const PROVIDERS: { value: AiProvider; label: string; hint: string }[] = [
  { value: "Claude",   label: "Anthropic Claude", hint: "Best tool-calling reliability. Model e.g. claude-opus-4-8" },
  { value: "GroqFree", label: "Groq (Free)",      hint: "Free tier for testing. Model e.g. llama-3.3-70b-versatile" },
  { value: "GroqPaid", label: "Groq (Paid)",      hint: "Higher limits. Model e.g. llama-3.3-70b-versatile" },
];
const TIERS: AiTier[] = ["starter", "growth", "enterprise"];

function AiSettingsModal({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useAiSettings(true);
  const update = useUpdateAiSettings();
  const registerWebhook = useRegisterTelegramWebhook();

  const [provider, setProvider] = React.useState<AiProvider>("Claude");
  const [model, setModel] = React.useState("");
  const [tier, setTier] = React.useState<AiTier>("starter");
  const [enabled, setEnabled] = React.useState(false);
  const [voiceEnabled, setVoiceEnabled] = React.useState(false);
  const [telegramEnabled, setTelegramEnabled] = React.useState(false);
  const [apiKey, setApiKey] = React.useState("");
  const [botToken, setBotToken] = React.useState("");
  const [botUsername, setBotUsername] = React.useState("");

  React.useEffect(() => {
    if (!data) return;
    setProvider(data.provider);
    setModel(data.model ?? "");
    setTier(data.tier);
    setEnabled(data.enabled);
    setVoiceEnabled(data.voiceEnabled);
    setTelegramEnabled(data.telegramEnabled);
    setBotUsername(data.telegramBotUsername ?? "");
  }, [data]);

  const save = async () => {
    try {
      await update.mutateAsync({
        provider,
        model: model.trim() || null,
        tier,
        enabled,
        voiceEnabled,
        telegramEnabled,
        apiKey: apiKey.trim() ? apiKey.trim() : null,
        clearApiKey: false,
        telegramBotToken: botToken.trim() ? botToken.trim() : null,
        telegramBotUsername: telegramEnabled ? botUsername.trim() : null,
        clearTelegramBot: false,
      });
      setBotToken("");
    } catch {
      /* hook shows the toast; keep the modal open for retry */
    }
  };

  const selectedHint = PROVIDERS.find(p => p.value === provider)?.hint;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-xl"
        initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" /> AI Assistant Settings
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Enabled */}
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Enable AI assistant</span>
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>

            {/* Provider */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Provider</label>
              <select value={provider} onChange={e => setProvider(e.target.value as AiProvider)}
                className="w-full h-9 rounded-lg bg-card border border-border px-3 text-sm">
                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {selectedHint && <p className="text-[11px] text-muted-foreground">{selectedHint}</p>}
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Model</label>
              <input value={model} onChange={e => setModel(e.target.value)}
                placeholder={provider === "Claude" ? "claude-opus-4-8" : "llama-3.3-70b-versatile"}
                className="w-full h-9 rounded-lg bg-card border border-border px-3 text-sm" />
            </div>

            {/* API key */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">API key {data?.hasApiKey && <span className="text-[11px] text-success">(a key is stored)</span>}</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={data?.hasApiKey ? "•••••••• — leave blank to keep current key" : "Paste your provider API key"}
                className="w-full h-9 rounded-lg bg-card border border-border px-3 text-sm" />
              <p className="text-[11px] text-muted-foreground">Your key is encrypted at rest and never shown again.</p>
            </div>

            {/* Tier */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Plan tier</label>
              <select value={tier} onChange={e => setTier(e.target.value as AiTier)}
                className="w-full h-9 rounded-lg bg-card border border-border px-3 text-sm">
                {TIERS.map(t => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>

            {/* Feature toggles */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                <span className="text-xs font-medium">Voice</span>
                <input type="checkbox" checked={voiceEnabled} onChange={e => setVoiceEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                <span className="text-xs font-medium">Telegram</span>
                <input type="checkbox" checked={telegramEnabled} onChange={e => setTelegramEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
              </label>
            </div>

            {/* Telegram bot (per-tenant bot; users link their own accounts) */}
            {telegramEnabled && (
              <div className="rounded-xl border border-border p-3 space-y-3">
                <p className="text-xs font-semibold flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-primary" /> Telegram bot</p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Bot token {data?.hasTelegramBotToken && <span className="text-[11px] text-success">(stored)</span>}</label>
                  <input type="password" value={botToken} onChange={e => setBotToken(e.target.value)}
                    placeholder={data?.hasTelegramBotToken ? "•••••• — blank keeps current token" : "Token from @BotFather"}
                    className="w-full h-9 rounded-lg bg-card border border-border px-3 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Bot username</label>
                  <input value={botUsername} onChange={e => setBotUsername(e.target.value)}
                    placeholder="e.g. AcmeVroduxBot"
                    className="w-full h-9 rounded-lg bg-card border border-border px-3 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 gap-1" disabled={registerWebhook.isPending || !data?.hasTelegramBotToken}
                    onClick={() => registerWebhook.mutate()}>
                    {registerWebhook.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                    Register webhook
                  </Button>
                  <span className="text-[11px] text-muted-foreground">Save the token first, then register so Telegram delivers messages here.</span>
                </div>
                {registerWebhook.data && (
                  <p className="text-[11px] text-success break-all">Webhook registered: {registerWebhook.data}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save settings"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Per-user Telegram link modal ────────────────────────────────────────────────

function TelegramLinkModal({ onClose }: { onClose: () => void }) {
  const { data: status, isLoading } = useTelegramStatus(true);
  const generate = useGenerateTelegramLink();
  const unlink = useUnlinkTelegram();

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl"
        initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" /> Connect Telegram
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !status?.botConfigured ? (
            <p className="text-sm text-muted-foreground">
              Telegram isn't set up for your company yet. Ask an administrator to configure the Telegram bot in AI Settings.
            </p>
          ) : status.linked ? (
            <div className="space-y-3">
              <p className="text-sm">
                ✅ Connected{status.telegramUsername ? <> as <span className="font-medium">@{status.telegramUsername}</span></> : null}. You can chat with the assistant from Telegram — it respects your role and only sees your company's data.
              </p>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={unlink.isPending}
                onClick={() => unlink.mutate()}>
                {unlink.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Link your personal Telegram to chat with the assistant from Telegram. It will act as you — your permissions, your company only.
              </p>
              {status.deepLink ? (
                <>
                  <a href={status.deepLink} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                    <ExternalLink className="h-3.5 w-3.5" /> Open in Telegram
                  </a>
                  <p className="text-[11px] text-muted-foreground">
                    Then press <span className="font-medium">Start</span> in Telegram. (Link code: <code>{status.code}</code>)
                  </p>
                </>
              ) : (
                <Button size="sm" className="gap-1.5" disabled={generate.isPending}
                  onClick={() => generate.mutate()}>
                  {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  Generate link
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
