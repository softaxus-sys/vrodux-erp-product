import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ApiError } from "@/lib/api-client";
import { useAiAgents, useAiConversation, useClearConversation, useConfirmAction, useSendChat } from "@/hooks/use-ai";
import type { ChatHistoryItem, PendingAction } from "@/types/ai";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: PendingAction | null;
  usedFallback?: boolean;
}

const SUGGESTIONS = [
  "How many leads do we have?",
  "What is our total pipeline value?",
  "Which leads are high priority?",
  "List our leads and who owns each",
];

const WELCOME =
  "Hi! I'm your Vrodux assistant. I can answer questions about your company's live data and make changes when you ask -- for anything that writes data, I'll check with you first. What would you like to know?";

function welcomeMessage(): Message {
  return { id: "welcome", role: "assistant", content: WELCOME };
}

/** "crm_create_lead" -> "create lead". */
function prettifyAction(toolName: string): string {
  const parts = toolName.split("_");
  const s = (parts.length > 1 ? parts.slice(1).join(" ") : toolName).replace(/_/g, " ").trim().toLowerCase();
  return s || toolName;
}

/** The exact values a pending write will send, so the confirmation can actually be reviewed --
 *  a prompt you cannot inspect is not a safeguard. Mirrors the web app's panel. */
function pendingFields(argumentsJson: string): { label: string; value: string }[] {
  try {
    const obj: unknown = JSON.parse(argumentsJson || "{}");
    if (typeof obj !== "object" || obj === null) return [];
    return Object.entries(obj as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([k, v]) => ({
        label: k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim(),
        value: String(v),
      }));
  } catch {
    return [];
  }
}

export default function AiAssistantScreen({ onClose }: { onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [agent, setAgent] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const sendChat = useSendChat();
  const confirmAction = useConfirmAction();
  const { data: conversation, isLoading: historyLoading } = useAiConversation();
  const { data: agents } = useAiAgents();
  const clearConversation = useClearConversation();
  const isTyping = sendChat.isPending || confirmAction.isPending;

  // Seed from the user's persisted history once it loads, so reopening the assistant (or closing
  // and reopening the app) shows what they already chatted instead of resetting to the welcome.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || historyLoading || !conversation) return;
    seededRef.current = true;
    setMessages(
      conversation.messages.length > 0
        ? conversation.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, usedFallback: m.usedFallback }))
        : [welcomeMessage()],
    );
  }, [conversation, historyLoading]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || sendChat.isPending) return;

      const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: trimmed };
      const history: ChatHistoryItem[] = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      try {
        const res = await sendChat.mutateAsync({ message: trimmed, history, agent });
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: res.reply, pending: res.pendingAction ?? null, usedFallback: res.usedFallback },
        ]);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Something went wrong reaching the assistant.";
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: `⚠️ ${msg}` }]);
      }
    },
    [messages, sendChat, agent],
  );

  const handleConfirm = useCallback(
    async (msgId: string, pending: PendingAction) => {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, pending: null } : m)));
      try {
        const res = await confirmAction.mutateAsync({ toolName: pending.toolName, argumentsJson: pending.argumentsJson });
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: res.reply }]);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "The action could not be completed.";
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: `⚠️ ${msg}` }]);
      }
    },
    [confirmAction],
  );

  const handleCancel = useCallback((msgId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, pending: null } : m)));
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: "No problem — I won't make that change." }]);
  }, []);

  const clearChat = () => {
    clearConversation.mutate();
    setMessages([welcomeMessage()]);
    setShowClearConfirm(false);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Feather name="message-circle" size={16} color={colors.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <Text style={styles.headerSubtitle}>Powered by your ERP data</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerButton} onPress={() => setShowClearConfirm(true)} hitSlop={8}>
            <Feather name="rotate-ccw" size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={onClose} hitSlop={8}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {agents && agents.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.agentRow} contentContainerStyle={styles.agentRowContent}>
          <AgentPill label="Auto" active={agent === null} onPress={() => setAgent(null)} />
          {agents.map((a) => (
            <AgentPill key={a.key} label={a.label} active={agent === a.key} onPress={() => setAgent(a.key)} />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.messages}>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            confirmPending={confirmAction.isPending}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        ))}
        {isTyping ? <TypingIndicator /> : null}
      </ScrollView>

      {messages.length <= 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionRow} contentContainerStyle={styles.suggestionRowContent}>
          {SUGGESTIONS.map((s) => (
            <Pressable key={s} style={styles.suggestionChip} onPress={() => sendMessage(s)}>
              <Text style={styles.suggestionText}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything about your ERP..."
          placeholderTextColor={colors.subtleForeground}
          multiline
          maxLength={4000}
        />
        <Pressable
          style={[styles.sendButton, (!input.trim() || isTyping) && styles.sendButtonDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || isTyping}
        >
          <Feather name="send" size={16} color={colors.white} />
        </Pressable>
      </View>

      {showClearConfirm ? (
        <View style={styles.confirmOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowClearConfirm(false)} />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Clear chat history?</Text>
            <Text style={styles.confirmBody}>This deletes your saved conversation with the assistant. This can't be undone.</Text>
            <View style={styles.confirmActions}>
              <Button label="Cancel" variant="outline" size="sm" onPress={() => setShowClearConfirm(false)} />
              <Button label="Clear history" variant="destructive" size="sm" loading={clearConversation.isPending} onPress={clearChat} />
            </View>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function AgentPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={[styles.agentPill, active && styles.agentPillActive]} onPress={onPress}>
      <Text style={[styles.agentPillText, active && styles.agentPillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TypingIndicator() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.typingRow}>
      <View style={styles.avatarSm}>
        <Feather name="message-circle" size={12} color={colors.primary} />
      </View>
      <View style={styles.typingBubble}>
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      </View>
    </View>
  );
}

function MessageBubble({
  msg,
  confirmPending,
  onConfirm,
  onCancel,
}: {
  msg: Message;
  confirmPending: boolean;
  onConfirm: (id: string, pending: PendingAction) => void;
  onCancel: (id: string) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUser = msg.role === "user";
  const fields = msg.pending ? pendingFields(msg.pending.argumentsJson) : [];

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
      {!isUser ? (
        <View style={styles.avatarSm}>
          <Feather name="message-circle" size={12} color={colors.white} />
        </View>
      ) : null}
      <View style={styles.messageCol}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant}>{msg.content}</Text>
        </View>
        {!isUser && msg.usedFallback ? <Text style={styles.fallbackNote}>via fallback provider</Text> : null}
        {msg.pending ? (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>⚠ Confirm before I {prettifyAction(msg.pending.toolName)}:</Text>
            {fields.length > 0 ? (
              <View style={styles.pendingFields}>
                {fields.map((f) => (
                  <View key={f.label} style={styles.pendingFieldRow}>
                    <Text style={styles.pendingFieldLabel}>{f.label}</Text>
                    <Text style={styles.pendingFieldValue}>{f.value}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.pendingSummary}>{msg.pending.summary}</Text>
            )}
            <View style={styles.pendingActions}>
              <Button label="Confirm" size="sm" icon="check" loading={confirmPending} onPress={() => onConfirm(msg.id, msg.pending!)} />
              <Button label="Reject" size="sm" variant="outline" icon="x" disabled={confirmPending} onPress={() => onCancel(msg.id)} />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    avatar: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    headerSubtitle: { fontSize: fontSize.xs, color: colors.subtleForeground },
    headerActions: { flexDirection: "row", gap: spacing.xs },
    headerButton: { padding: spacing.xs },

    agentRow: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
    agentRowContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, gap: spacing.xs, alignItems: "center" },
    agentPill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.muted, marginRight: spacing.xs },
    agentPillActive: { backgroundColor: colors.primary },
    agentPillText: { fontSize: fontSize.sm, color: colors.foregroundSecondary, fontWeight: fontWeight.medium },
    agentPillTextActive: { color: colors.onPrimary, fontWeight: fontWeight.semibold },

    messages: { padding: spacing.lg, gap: spacing.md },

    messageRow: { flexDirection: "row", gap: spacing.sm },
    messageRowUser: { justifyContent: "flex-end" },
    messageRowAssistant: { justifyContent: "flex-start" },
    messageCol: { maxWidth: "82%", gap: 4 },

    avatarSm: { width: 24, height: 24, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },

    bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
    bubbleUser: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
    bubbleAssistant: { backgroundColor: colors.muted, borderTopLeftRadius: 4 },
    bubbleTextUser: { color: colors.onPrimary, fontSize: fontSize.base, lineHeight: 19 },
    bubbleTextAssistant: { color: colors.foreground, fontSize: fontSize.base, lineHeight: 19 },
    fallbackNote: { fontSize: fontSize.xs, color: colors.subtleForeground, marginLeft: 4 },

    typingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    typingBubble: { backgroundColor: colors.muted, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },

    pendingCard: { borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.sm + 2, gap: spacing.xs },
    pendingTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.warning },
    pendingFields: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.xs, gap: 2 },
    pendingFieldRow: { flexDirection: "row", gap: spacing.sm },
    pendingFieldLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, minWidth: 90 },
    pendingFieldValue: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.foreground, flexShrink: 1 },
    pendingSummary: { fontSize: fontSize.xs, color: colors.mutedForeground },
    pendingActions: { flexDirection: "row", gap: spacing.xs, marginTop: 2 },

    suggestionRow: { maxHeight: 40 },
    suggestionRowContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
    suggestionChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardMuted, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginRight: spacing.xs },
    suggestionText: { fontSize: fontSize.xs, color: colors.mutedForeground },

    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.base,
      color: colors.foreground,
      backgroundColor: colors.background,
    },
    sendButton: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    sendButtonDisabled: { backgroundColor: colors.disabled },

    confirmOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)", padding: spacing.lg },
    confirmCard: { width: "100%", maxWidth: 360, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
    confirmTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    confirmBody: { fontSize: fontSize.base, color: colors.mutedForeground },
    confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.xs },
  });
}
