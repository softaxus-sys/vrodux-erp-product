import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { useLgReply, useLgThread, useLgUpdateThread } from "@/hooks/use-leadgen";
import { LG_INBOX_EDIT, LG_INBOX_SEND, THREAD_CLASSES, lgLabel } from "@/lib/leadgen.api";
import { errorMessage } from "@/components/forms/FormKit";
import { Button, Chip, ErrorState, LoadingState } from "@/components/ui";
import { fontSize, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadGenStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadGenStackParamList, "LgThread">;

export default function LgThreadScreen({ route, navigation }: Props) {
  const { id, subject } = route.params;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const q = useLgThread(id);
  const reply = useLgReply();
  const update = useLgUpdateThread();
  const [text, setText] = useState("");
  const marked = useRef(false);
  const canSend = hasPermission(...LG_INBOX_SEND);
  const canEdit = hasPermission(...LG_INBOX_EDIT);

  useEffect(() => navigation.setOptions({ headerTitle: subject }), [navigation, subject]);

  // Opening a thread reads it, once.
  useEffect(() => {
    if (q.data && q.data.thread.unreadCount > 0 && !marked.current && canEdit) {
      marked.current = true;
      update.mutate({ id, markRead: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, canEdit]);

  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState message="Could not load this conversation." onRetry={() => q.refetch()} />;
  const { thread, messages } = q.data;

  function send() {
    const body = text.trim();
    if (!body) return;
    reply.mutate({ id, body }, { onSuccess: () => setText("") });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={styles.container}>
        {canEdit ? (
          <View style={styles.chips}>
            {THREAD_CLASSES.map((c) => (
              <Chip key={c} label={lgLabel(c === "none" ? "unlabelled" : c)} active={thread.classification === c} onPress={() => thread.classification !== c && update.mutate({ id, classification: c })} />
            ))}
            <Chip label={thread.isArchived ? "Unarchive" : "Archive"} onPress={() => update.mutate({ id, archived: !thread.isArchived })} />
          </View>
        ) : null}
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubble, m.direction === "out" ? styles.out : styles.in]}>
            <Text style={styles.meta}>
              {m.direction === "out" ? "You" : m.from} · {new Date(m.occurredAt).toLocaleString()}
              {m.status === "failed" ? " · failed" : ""}
            </Text>
            <Text style={styles.body}>{m.bodyText ?? ""}</Text>
            {m.error ? <Text style={styles.error}>{m.error}</Text> : null}
          </View>
        ))}
      </ScrollView>
      {canSend ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Write a reply…"
            placeholderTextColor={colors.subtleForeground}
            multiline
          />
          <Button icon="send" label={reply.isPending ? "Sending…" : "Send"} onPress={send} disabled={!text.trim() || reply.isPending} />
          {reply.isError ? <Text style={styles.error}>{errorMessage(reply.error, "Could not send the reply.")}</Text> : null}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    bubble: { padding: spacing.md, borderRadius: radius.lg, gap: spacing.xs, maxWidth: "92%" },
    in: { backgroundColor: colors.cardMuted, alignSelf: "flex-start" },
    out: { backgroundColor: colors.primaryLight, alignSelf: "flex-end" },
    meta: { fontSize: fontSize.xs, color: colors.mutedForeground },
    body: { fontSize: fontSize.md, color: colors.foreground },
    error: { fontSize: fontSize.sm, color: colors.destructive },
    composer: { padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
    input: {
      minHeight: 44, maxHeight: 140, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
      padding: spacing.sm + 2, backgroundColor: colors.background, color: colors.foreground, fontSize: fontSize.md,
    },
  });
}
