import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  useCancelWaitlist,
  useNoShowWaitlist,
  useSeatWaitlist,
  useTables,
  useWaitlist,
  useWaitlistSummary,
} from "@/hooks/use-restaurant";
import { RESTAURANT_WAITLIST_EDIT } from "@/lib/restaurant.api";
import { hasPermission } from "@/store/auth.store";
import { WAITLIST_STATUS_LABELS, WAITLIST_STATUS_TONE } from "@/types/restaurant";
import type { WaitlistEntryDto } from "@/types/restaurant";
import { Badge, Button, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

const FILTERS: { key: string; label: string }[] = [
  { key: "waiting", label: "Waiting" },
  { key: "all", label: "All" },
  { key: "seated", label: "Seated" },
  { key: "no_show", label: "No-show" },
];

export default function WaitlistScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canEdit = hasPermission(RESTAURANT_WAITLIST_EDIT);
  const [status, setStatus] = useState("waiting");
  const [seatingId, setSeatingId] = useState<string | null>(null);

  const summary = useWaitlistSummary();
  const waitlist = useWaitlist(status);
  const tables = useTables();
  const seat = useSeatWaitlist();
  const cancel = useCancelWaitlist();
  const noShow = useNoShowWaitlist();

  const availableTables = (tables.data ?? []).filter((t) => t.status === "available");
  const busy = seat.isPending || cancel.isPending || noShow.isPending;

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Waiting" value={summary.data.waiting} />
          <SummaryTile label="Avg quote" value={`${Math.round(summary.data.averageQuotedWaitMinutes)}m`} />
          <SummaryTile label="Today" value={summary.data.total} />
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {waitlist.isError ? (
        <ErrorState message="Couldn't load the waitlist." onRetry={() => waitlist.refetch()} />
      ) : waitlist.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={waitlist.data ?? []}
          keyExtractor={(w) => w.id}
          contentContainerStyle={(waitlist.data ?? []).length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={waitlist.isRefetching} onRefresh={() => waitlist.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="clock" title="Nobody's waiting" />}
          renderItem={({ item }) => (
            <WaitlistRow
              entry={item}
              canEdit={canEdit}
              busy={busy}
              onSeat={() => setSeatingId(item.id)}
              onCancel={() => cancel.mutate(item.id)}
              onNoShow={() => noShow.mutate(item.id)}
            />
          )}
        />
      )}

      <Modal visible={Boolean(seatingId)} transparent animationType="fade" onRequestClose={() => setSeatingId(null)}>
        <Pressable style={styles.overlay} onPress={() => setSeatingId(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Seat at which table?</Text>
            {availableTables.length === 0 ? (
              <Text style={styles.sheetEmpty}>No available tables right now.</Text>
            ) : (
              availableTables.map((t) => (
                <Pressable
                  key={t.id}
                  style={styles.option}
                  onPress={() => {
                    if (seatingId) seat.mutate({ id: seatingId, tableId: t.id });
                    setSeatingId(null);
                  }}
                >
                  <Text style={styles.optionText}>
                    Table {t.tableNumber} · {t.section}
                  </Text>
                  <Text style={styles.optionMeta}>Seats {t.capacity}</Text>
                </Pressable>
              ))
            )}
            <Pressable style={styles.cancelRow} onPress={() => setSeatingId(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: number | string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function WaitlistRow({
  entry,
  canEdit,
  busy,
  onSeat,
  onCancel,
  onNoShow,
}: {
  entry: WaitlistEntryDto;
  canEdit: boolean;
  busy: boolean;
  onSeat: () => void;
  onCancel: () => void;
  onNoShow: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canAct = canEdit && entry.status === "waiting";

  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.guestName}
        </Text>
        <Badge label={WAITLIST_STATUS_LABELS[entry.status] ?? entry.status} tone={WAITLIST_STATUS_TONE[entry.status] ?? "neutral"} />
      </View>
      <Text style={styles.meta}>
        Party of {entry.partySize} · Quoted {entry.quotedWaitMinutes}m · Waited {entry.waitedMinutes}m
      </Text>
      {entry.notes ? <Text style={styles.notes}>{entry.notes}</Text> : null}

      <View style={styles.quickActions}>
        <Feather name="phone" size={14} color={colors.primary} />
        <Text style={styles.phone}>{entry.guestPhone}</Text>
      </View>

      {canAct ? (
        <View style={styles.actionsRow}>
          <Button label={busy ? "..." : "Seat"} size="sm" disabled={busy} onPress={onSeat} />
          <Button label="No-show" size="sm" variant="ghost" disabled={busy} onPress={onNoShow} />
          <Button label="Cancel" size="sm" variant="ghost" disabled={busy} onPress={onCancel} />
        </View>
      ) : null}
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
    list: { paddingVertical: spacing.md },

    summaryRow: { flexDirection: "row", justifyContent: "space-around", margin: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: spacing.md },
    summaryTile: { alignItems: "center" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    summaryLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
    notes: { fontSize: fontSize.sm, color: colors.mutedForeground, fontStyle: "italic" },

    quickActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    phone: { fontSize: fontSize.sm, color: colors.primary },

    actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: 2 },
    sheetTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: spacing.sm },
    sheetEmpty: { fontSize: fontSize.base, color: colors.mutedForeground, paddingVertical: spacing.md },
    option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.border },
    optionText: { fontSize: fontSize.base, color: colors.foreground, fontWeight: fontWeight.medium },
    optionMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    cancelRow: { paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xs },
    cancelText: { fontSize: fontSize.base, color: colors.mutedForeground, fontWeight: fontWeight.medium },
  });
}
