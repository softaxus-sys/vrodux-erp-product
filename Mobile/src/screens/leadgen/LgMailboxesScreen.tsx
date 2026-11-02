import { useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { hasPermission } from "@/store/auth.store";
import { useLgMailboxAction, useLgMailboxes } from "@/hooks/use-leadgen";
import { LG_MAILBOXES_EDIT, lgLabel, lgTone } from "@/lib/leadgen.api";
import { errorMessage } from "@/components/forms/FormKit";
import { Badge, Button, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

export default function LgMailboxesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const q = useLgMailboxes();
  const act = useLgMailboxAction();
  const canEdit = hasPermission(...LG_MAILBOXES_EDIT);

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message="Could not load mailboxes." onRetry={() => q.refetch()} />;

  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ paddingVertical: spacing.md }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      ListEmptyComponent={<EmptyListState title="No mailboxes" subtitle="Connect a mailbox from the web app to start sending." />}
      ListFooterComponent={act.isError ? <Text style={styles.error}>{errorMessage(act.error, "That didn't work.")}</Text> : null}
      renderItem={({ item: m }) => (
        <ListItemCard>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>{m.address}</Text>
            <Badge label={lgLabel(m.status)} tone={lgTone(m.status)} />
          </View>
          <Text style={styles.sub}>
            {m.provider} · today {m.sentToday}/{m.todayLimit} · warm-up day {m.warmupDay} · bounce {m.bounceRatePercent.toFixed(1)}%
          </Text>
          <Text style={styles.sub}>{m.totalSent} sent · {m.totalReplies} replies</Text>
          {m.statusReason || m.lastError ? <Text style={styles.error}>{m.statusReason ?? m.lastError}</Text> : null}
          {canEdit ? (
            <View style={styles.row}>
              {m.status === "paused" ? (
                <Button label="Resume" size="sm" onPress={() => act.mutate({ id: m.id, action: "resume" })} disabled={act.isPending} />
              ) : m.status === "connected" ? (
                <Button label="Pause" size="sm" variant="outline" onPress={() => act.mutate({ id: m.id, action: "pause" })} disabled={act.isPending} />
              ) : null}
              {m.status !== "disconnected" ? (
                <Button label="Check for replies" size="sm" variant="outline" icon="refresh-cw" onPress={() => act.mutate({ id: m.id, action: "sync" })} disabled={act.isPending} />
              ) : null}
            </View>
          ) : null}
        </ListItemCard>
      )}
    />
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
    name: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
    error: { fontSize: fontSize.base, color: colors.destructive, paddingHorizontal: spacing.lg },
  });
}
