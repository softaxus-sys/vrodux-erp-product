import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useCancelReservation, useReservations, useReservationsSummary, useSeatReservation } from "@/hooks/use-restaurant";
import { RESTAURANT_RESERVATIONS_EDIT } from "@/lib/restaurant.api";
import { hasPermission } from "@/store/auth.store";
import { RESERVATION_STATUS_LABELS, RESERVATION_STATUS_TONE } from "@/types/restaurant";
import type { ReservationDto } from "@/types/restaurant";
import { Badge, Button, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

// Dynamic, per the project's "never hardcode dates" rule -- a build from last month must still
// default to *this* today, not the day it happened to be compiled on.
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReservationsListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canEdit = hasPermission(RESTAURANT_RESERVATIONS_EDIT);
  const [showToday, setShowToday] = useState(true);

  const summary = useReservationsSummary();
  const reservations = useReservations(showToday ? today() : undefined);
  const seat = useSeatReservation();
  const cancel = useCancelReservation();

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Today" value={summary.data.today} />
          <SummaryTile label="Covers" value={summary.data.todayCovers} />
          <SummaryTile label="Confirmed" value={summary.data.confirmed} />
        </View>
      ) : null}

      <View style={styles.filterRow}>
        <Chip label="Today" active={showToday} onPress={() => setShowToday(true)} />
        <Chip label="All" active={!showToday} onPress={() => setShowToday(false)} />
      </View>

      {reservations.isError ? (
        <ErrorState message="Couldn't load reservations." onRetry={() => reservations.refetch()} />
      ) : reservations.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={reservations.data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={(reservations.data ?? []).length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={reservations.isRefetching} onRefresh={() => reservations.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="calendar" title="No reservations here" />}
          renderItem={({ item }) => (
            <ReservationRow
              reservation={item}
              canEdit={canEdit}
              busy={seat.isPending || cancel.isPending}
              onSeat={() => seat.mutate(item.id)}
              onCancel={() => cancel.mutate(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ReservationRow({
  reservation,
  canEdit,
  busy,
  onSeat,
  onCancel,
}: {
  reservation: ReservationDto;
  canEdit: boolean;
  busy: boolean;
  onSeat: () => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canAct = canEdit && reservation.status === "confirmed";

  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {reservation.guestName}
        </Text>
        <Badge label={RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status} tone={RESERVATION_STATUS_TONE[reservation.status] ?? "neutral"} />
      </View>
      <Text style={styles.meta}>
        {reservation.reservationDate} · {reservation.reservationTime} · {reservation.covers} cover{reservation.covers === 1 ? "" : "s"}
        {reservation.tableNumber ? ` · Table ${reservation.tableNumber}` : ""}
      </Text>
      {reservation.specialRequests ? <Text style={styles.notes}>{reservation.specialRequests}</Text> : null}

      <View style={styles.quickActions}>
        <Feather name="phone" size={14} color={colors.primary} />
        <Text style={styles.phone}>{reservation.guestPhone}</Text>
      </View>

      {canAct ? (
        <View style={styles.actionsRow}>
          <Button label={busy ? "..." : "Seat"} size="sm" disabled={busy} onPress={onSeat} />
          <Button label="Cancel" size="sm" variant="ghost" disabled={busy} onPress={onCancel} />
        </View>
      ) : null}
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
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

    actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  });
}
