import { useMemo } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useCompleteTask, useHousekeepingList, useStartTask, useVerifyTask } from "@/hooks/use-hospitality";
import { HOUSEKEEPING_STATUS_LABELS, HOUSEKEEPING_STATUS_TONE, PRIORITY_TONE } from "@/types/hospitality";
import type { HousekeepingTaskDto } from "@/types/hospitality";
import { Badge, Button, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import { titleCaseStatus } from "@/lib/verticals-shared";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "verified", label: "Verified" },
];

const TASK_TYPE_FILTERS = [
  { key: "all", label: "Any type" },
  { key: "cleaning", label: "Cleaning" },
  { key: "turnover", label: "Turnover" },
  { key: "deep_clean", label: "Deep Clean" },
  { key: "inspection", label: "Inspection" },
];

export default function HousekeepingListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const list = useHousekeepingList();
  const start = useStartTask();
  const complete = useCompleteTask();
  const verify = useVerifyTask();
  const busy = start.isPending || complete.isPending || verify.isPending;

  return (
    <View style={styles.container}>
      <SearchInput value={list.search} onChangeText={list.setSearch} placeholder="Search by room number…" />
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={list.status === f.key} onPress={() => list.setStatus(f.key)} />
        ))}
      </View>
      <View style={styles.filterRow}>
        {TASK_TYPE_FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={list.taskType === f.key} onPress={() => list.setTaskType(f.key)} />
        ))}
      </View>

      {list.isError ? (
        <ErrorState message="Couldn't load housekeeping tasks." onRetry={list.refresh} />
      ) : list.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(t) => t.id}
          contentContainerStyle={list.items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={list.refresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={list.loadMore}
          ListEmptyComponent={<EmptyListState icon="clipboard" title="No housekeeping tasks here" />}
          ListFooterComponent={list.hasMore && list.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <TaskRow
              task={item}
              busy={busy}
              onStart={() => start.mutate(item.id)}
              onComplete={() => complete.mutate(item.id)}
              onVerify={() => verify.mutate(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

function TaskRow({
  task,
  busy,
  onStart,
  onComplete,
  onVerify,
}: {
  task: HousekeepingTaskDto;
  busy: boolean;
  onStart: () => void;
  onComplete: () => void;
  onVerify: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name}>
          Room {task.roomNumber} <Text style={styles.subtle}>· {titleCaseStatus(task.taskType)}</Text>
        </Text>
        <Badge label={HOUSEKEEPING_STATUS_LABELS[task.status] ?? task.status} tone={HOUSEKEEPING_STATUS_TONE[task.status] ?? "neutral"} />
      </View>
      <View style={styles.rowBottom}>
        <Badge label={titleCaseStatus(task.priority)} tone={PRIORITY_TONE[task.priority.toLowerCase()] ?? "neutral"} />
        {task.assignedTo ? <Text style={styles.stat}>{task.assignedTo}</Text> : null}
      </View>

      {task.status === "pending" ? (
        <Button label={busy ? "..." : "Start"} size="sm" disabled={busy} onPress={onStart} style={styles.actionButton} />
      ) : task.status === "in_progress" ? (
        <Button label={busy ? "..." : "Mark Complete"} size="sm" disabled={busy} onPress={onComplete} style={styles.actionButton} />
      ) : task.status === "completed" ? (
        <Button label={busy ? "..." : "Verify"} size="sm" variant="outline" disabled={busy} onPress={onVerify} style={styles.actionButton} />
      ) : null}
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
    footerSpinner: { paddingVertical: spacing.lg },
    list: { paddingVertical: spacing.md },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
    subtle: { fontWeight: fontWeight.regular, color: colors.mutedForeground },
    rowBottom: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
    actionButton: { marginTop: spacing.sm },
  });
}
