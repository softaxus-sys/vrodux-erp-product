import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Send, RotateCcw, Check, Ban, ExternalLink, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "@/store/ui.store";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSendChat, useConfirmAction, useAiConversation, useClearConversation } from "@/hooks/ai/use-ai";
import type { ChatHistoryItem, PendingAction } from "@/lib/ai/ai.api";
import { ApiError } from "@/lib/api-client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** Set on an assistant message that proposed a write action awaiting confirmation. */
  pending?: PendingAction | null;
  /** True when this reply came from the tenant's fallback AI provider, not their primary. */
  usedFallback?: boolean;
}

const suggestions = [
  "How many leads do we have?",
  "What is our total pipeline value?",
  "Which leads are high priority?",
  "List our leads and who owns each",
];

const WELCOME =
  "Hi! I'm your Vrodux assistant. I can answer questions about your company's live data — for example your CRM leads and pipeline. What would you like to know?";

const welcomeMessage = (): Message => ({
  id: "welcome",
  role: "assistant",
  content: WELCOME,
  timestamp: new Date().toISOString(),
});

/** "crm_create_lead" → "create lead". */
function prettifyAction(toolName: string): string {
  const parts = toolName.split("_");
  const s = (parts.length > 1 ? parts.slice(1).join(" ") : toolName).replace(/_/g, " ").trim().toLowerCase();
  return s || toolName;
}

/**
 * The exact values the pending write will send, so the confirmation can actually be reviewed —
 * a prompt you cannot inspect is not a safeguard. Mirrors the full assistant page.
 */
function pendingFields(argumentsJson: string): { label: string; value: string }[] {
  try {
    const obj = JSON.parse(argumentsJson || "{}");
    if (typeof obj !== "object" || obj === null) return [];
    return Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([k, v]) => ({
        label: k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim(),
        value: String(v),
      }));
  } catch {
    return [];
  }
}

export function AiAssistantPanel() {
  const { aiAssistantOpen, setAiAssistantOpen } = useUiStore();
  const navigate = useNavigate();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const sendChat = useSendChat();
  const confirmAction = useConfirmAction();
  const { data: conversation, isLoading: historyLoading } = useAiConversation();
  const clearConversation = useClearConversation();
  const isTyping = sendChat.isPending || confirmAction.isPending;

  // Seed from the user's persisted history once it loads, so reopening the panel (or navigating
  // away and back) shows what they already chatted instead of resetting to just the welcome msg.
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (seededRef.current || historyLoading || !conversation) return;
    seededRef.current = true;
    setMessages(
      conversation.messages.length > 0
        ? conversation.messages.map((m) => ({
            id: m.id, role: m.role, content: m.content, timestamp: m.createdAt, usedFallback: m.usedFallback,
          }))
        : [welcomeMessage()],
    );
  }, [conversation, historyLoading]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = React.useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || sendChat.isPending) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    // Build history from the conversation so far (exclude the welcome placeholder).
    const history: ChatHistoryItem[] = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const res = await sendChat.mutateAsync({ message: trimmed, history, agent: null });
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        timestamp: new Date().toISOString(),
        pending: res.pendingAction ?? null,
        usedFallback: res.usedFallback,
      }]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Something went wrong reaching the assistant.";
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: `⚠️ ${msg}`,
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [messages, sendChat]);

  const handleConfirm = React.useCallback(async (msgId: string, pending: PendingAction) => {
    // Clear the pending prompt so the buttons disappear immediately.
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, pending: null } : m)));
    try {
      const res = await confirmAction.mutateAsync({
        toolName: pending.toolName,
        argumentsJson: pending.argumentsJson,
      });
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`, role: "assistant", content: res.reply, timestamp: new Date().toISOString(),
      }]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "The action could not be completed.";
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`, role: "assistant", content: `⚠️ ${msg}`, timestamp: new Date().toISOString(),
      }]);
    }
  }, [confirmAction]);

  const handleCancel = React.useCallback((msgId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, pending: null } : m)));
    setMessages((prev) => [...prev, {
      id: `a-${Date.now()}`, role: "assistant",
      content: "No problem — I won't make that change.", timestamp: new Date().toISOString(),
    }]);
  }, []);

  return (
    <AnimatePresence>
      {aiAssistantOpen && (
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.2 }}
          className="fixed right-4 bottom-4 top-20 z-50 w-[380px] flex flex-col rounded-xl border border-border bg-card shadow-enterprise-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">AI Assistant</p>
                <p className="text-[10px] text-muted-foreground">Powered by your ERP data</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Open full assistant"
                onClick={() => { setAiAssistantOpen(false); navigate("/ai-assistant"); }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Clear chat"
                onClick={() => { clearConversation.mutate(); setMessages([welcomeMessage()]); }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setAiAssistantOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0 mt-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div className="max-w-[80%] flex flex-col gap-1.5">
                    <div
                      className={cn(
                        "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {msg.role === "assistant"
                        ? <Markdown content={msg.content} />
                        : msg.content}
                    </div>
                    {msg.role === "assistant" && msg.usedFallback && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 px-0.5"
                        title="Answered using your fallback AI provider — your primary was rate-limited or unavailable."
                      >
                        <Zap className="h-2.5 w-2.5" /> via fallback
                      </span>
                    )}
                    {msg.pending && (
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-2.5">
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mb-1.5">
                          ⚠ Confirm before I {prettifyAction(msg.pending.toolName)}:
                        </p>
                        {pendingFields(msg.pending.argumentsJson).length > 0 ? (
                          <div className="rounded-lg bg-background/60 border border-border p-2 mb-2 text-[11px] space-y-0.5">
                            {pendingFields(msg.pending.argumentsJson).map(f => (
                              <div key={f.label} className="flex gap-2">
                                <span className="text-muted-foreground min-w-[80px]">{f.label}</span>
                                <span className="font-medium break-all">{f.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground mb-2 break-words">{msg.pending.summary}</p>
                        )}
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 gap-1 text-xs" disabled={confirmAction.isPending}
                            onClick={() => handleConfirm(msg.id, msg.pending!)}>
                            <Check className="h-3.5 w-3.5" /> Confirm
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={confirmAction.isPending}
                            onClick={() => handleCancel(msg.id)}>
                            <Ban className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                  <div className="bg-muted rounded-xl px-3.5 py-2.5 flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Ask anything about your ERP..."
                rows={1}
                className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[36px] max-h-24"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
