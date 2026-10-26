import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTourBookingsList } from "@/hooks/use-tours";
import { formatCompactValue } from "@/lib/crm-helpers";
import type { TourBookingDto } from "@/lib/tours.api";
import { useAuthStore } from "@/store/auth.store";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { Tone } from "@/theme";
import type { HospitalityStackParamList } from "@/navigation/types";

const FILTERS: StatusFilterOption[] = [
  { key: "all", label: "All" },
  { key: "enquiry", label: "Enquiry" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export const TOUR_STATUS_LABEL: Record<string, string> = {
  enquiry: "Enquiry",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const TOUR_STATUS_TONE: Record<string, Tone> = {
  enquiry: "warning",
  confirmed: "info",
  completed: "success",
  cancelled: "destructive",
};

export default function TourBookingsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HospitalityStackParamList>>();
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const list = useTourBookingsList();

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(b) => b.id}
      renderItem={(b) => (
        <BookingRow booking={b} currency={currency} onPress={() => navigation.navigate("TourBookingDetail", { bookingId: b.id, bookingNumber: b.bookingNumber })} />
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
      searchPlaceholder="Search by customer or booking #…"
      status={list.status}
      onStatusChange={list.setStatus}
      statusFilters={FILTERS}
      emptyIcon="briefcase"
      emptyTitle="No tour bookings here"
    />
  );
}

function BookingRow({ booking, currency, onPress }: { booking: TourBookingDto; currency: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const travellers = booking.adults + booking.children;
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>{booking.customerName}</Text>
        <Badge label={TOUR_STATUS_LABEL[booking.status] ?? booking.status} tone={TOUR_STATUS_TONE[booking.status] ?? "neutral"} />
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {booking.bookingNumber} · {booking.title} · {travellers} traveller{travellers === 1 ? "" : "s"}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>{booking.startDate} → {booking.endDate}</Text>
        {booking.overdueAmount > 0 ? (
          <Text style={styles.overdue}>{formatCompactValue(booking.overdueAmount, currency)} overdue</Text>
        ) : booking.balance > 0 ? (
          <Text style={styles.stat}>{formatCompactValue(booking.balance, currency)} due</Text>
        ) : (
          <Text style={styles.stat}>Paid in full</Text>
        )}
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
    name: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
    rowBottom: { flexDirection: "row", justifyContent: "space-between" },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
    overdue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.destructive },
  });
}
