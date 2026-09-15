import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useBookingsList, useCheckIn, useCheckOut } from "@/hooks/use-hospitality";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_TONE } from "@/types/hospitality";
import type { BookingDto } from "@/types/hospitality";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, Button, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

const FILTERS: StatusFilterOption[] = [
  { key: "all", label: "All" },
  { key: "confirmed", label: "Confirmed" },
  { key: "checked_in", label: "Checked In" },
  { key: "checked_out", label: "Checked Out" },
  { key: "cancelled", label: "Cancelled" },
];

export default function BookingsListScreen() {
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const list = useBookingsList();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(b) => b.id}
      renderItem={(b) => (
        <BookingRow
          booking={b}
          currency={currency}
          busy={checkIn.isPending || checkOut.isPending}
          onCheckIn={() => checkIn.mutate(b.id)}
          onCheckOut={() => checkOut.mutate(b.id)}
        />
      )}
      isLoading={list.isLoading}
      isError={list.isError}
      isFetching={list.isFetching}
      isRefetching={list.isRefetching}
      hasMore={list.hasMore}
      onRefresh={list.refresh}
      onLoadMore={list.loadMore}
      onRetry={list.refresh}
      search={list.search}
      onSearchChange={list.setSearch}
      searchPlaceholder="Search by guest or booking #…"
      status={list.status}
      onStatusChange={list.setStatus}
      statusFilters={FILTERS}
      emptyIcon="calendar"
      emptyTitle="No bookings here"
    />
  );
}

function BookingRow({
  booking,
  currency,
  busy,
  onCheckIn,
  onCheckOut,
}: {
  booking: BookingDto;
  currency: string;
  busy: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {booking.guestName}
        </Text>
        <Badge label={BOOKING_STATUS_LABELS[booking.status] ?? booking.status} tone={BOOKING_STATUS_TONE[booking.status] ?? "neutral"} />
      </View>
      <Text style={styles.meta}>
        {booking.bookingNumber} · Room {booking.roomNumber} · {booking.nights} night{booking.nights === 1 ? "" : "s"}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>
          {booking.checkIn} → {booking.checkOut}
        </Text>
        {booking.balance > 0 ? (
          <Text style={styles.overdue}>{formatCompactValue(booking.balance, currency)} due</Text>
        ) : (
          <Text style={styles.stat}>Paid in full</Text>
        )}
      </View>

      {booking.status === "confirmed" ? (
        <Button label={busy ? "..." : "Check In"} size="sm" disabled={busy} onPress={onCheckIn} style={styles.actionButton} />
      ) : booking.status === "checked_in" ? (
        <Button label={busy ? "..." : "Check Out"} size="sm" variant="outline" disabled={busy} onPress={onCheckOut} style={styles.actionButton} />
      ) : null}
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
    rowBottom: { flexDirection: "row", justifyContent: "space-between" },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
    overdue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.destructive },
    actionButton: { marginTop: spacing.sm },
  });
}
