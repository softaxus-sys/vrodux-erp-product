import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRooms, useRoomsSummary } from "@/hooks/use-hospitality";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { ROOM_STATUS_LABELS, ROOM_STATUS_TONE } from "@/types/hospitality";
import type { RoomDto } from "@/types/hospitality";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "occupied", label: "Occupied" },
  { key: "cleaning", label: "Cleaning" },
  { key: "maintenance", label: "Maintenance" },
];

export default function RoomsListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [status, setStatus] = useState("all");

  const summary = useRoomsSummary();
  const rooms = useRooms();

  const filtered = useMemo(() => {
    const list = rooms.data ?? [];
    const sorted = [...list].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
    return status === "all" ? sorted : sorted.filter((r) => r.status === status);
  }, [rooms.data, status]);

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Occupancy" value={`${Math.round(summary.data.occupancyRate)}%`} />
          <SummaryTile label="Avg rate" value={formatCompactValue(summary.data.avgRate, currency)} />
          <SummaryTile label="Rooms" value={String(summary.data.total)} />
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {rooms.isError ? (
        <ErrorState message="Couldn't load rooms." onRetry={() => rooms.refetch()} />
      ) : rooms.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={filtered.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={rooms.isRefetching} onRefresh={() => rooms.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="home" title="No rooms in this status" />}
          renderItem={({ item }) => <RoomRow room={item} currency={currency} />}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function RoomRow({ room, currency }: { room: RoomDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name}>
          Room {room.roomNumber} <Text style={styles.subtle}>· {room.roomType}</Text>
        </Text>
        <Badge label={ROOM_STATUS_LABELS[room.status] ?? room.status} tone={ROOM_STATUS_TONE[room.status] ?? "neutral"} />
      </View>
      <Text style={styles.meta}>
        Floor {room.floor} · Sleeps {room.capacity}
        {room.currentGuestName ? ` · ${room.currentGuestName}` : ""}
      </Text>
      <Text style={styles.stat}>{formatCompactValue(room.ratePerNight, currency)}/night</Text>
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
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
    subtle: { fontWeight: fontWeight.regular, color: colors.mutedForeground },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
