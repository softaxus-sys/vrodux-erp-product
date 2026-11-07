import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFrontDesk } from "@/hooks/use-hospitality";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { Badge, ErrorState, ListItemCard, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { HospitalityStackParamList } from "@/navigation/types";
import type { BookingDto } from "@/types/hospitality";

/** Today at the desk: who is arriving, who is leaving, who is in the house, and who did not turn up. */
export default function FrontDeskScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<HospitalityStackParamList>>();
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const desk = useFrontDesk();

  if (desk.isLoading) return <LoadingState />;
  if (desk.isError || !desk.data) return <ErrorState message="Couldn't load the front desk." onRetry={() => desk.refetch()} />;
  const d = desk.data;

  const group = (title: string, items: BookingDto[], empty: string) => (
    <SectionCard title={`${title} (${items.length})`}>
      {items.length === 0 ? (
        <Text style={styles.meta}>{empty}</Text>
      ) : (
        items.map((b) => (
          <ListItemCard key={b.id} onPress={() => navigation.navigate("BookingDetail", { bookingId: b.id, bookingNumber: b.bookingNumber })}>
            <View style={styles.top}>
              <Text style={styles.name} numberOfLines={1}>{b.guestName}</Text>
              {b.balance > 0 ? <Badge label={`${formatCompactValue(b.balance, currency)} due`} tone="warning" /> : null}
            </View>
            <Text style={styles.meta}>Room {b.roomNumber} · {b.checkIn} → {b.checkOut}</Text>
          </ListItemCard>
        ))
      )}
    </SectionCard>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={desk.isRefetching} onRefresh={() => desk.refetch()} />}>
      <View style={styles.stats}>
        <Stat label="Occupied tonight" value={`${d.occupiedTonight}/${d.totalRooms}`} tone="primary" />
        <Stat label="Occupancy" value={`${Math.round(d.occupancyPercent)}%`} />
        <Stat label="Dirty rooms" value={String(d.dirtyRooms)} />
      </View>
      {group("Arriving today", d.arrivals, "No arrivals left.")}
      {group("Leaving today", d.departures, "No departures left.")}
      {group("In the house", d.inHouse, "Nobody checked in.")}
      {d.noShows.length > 0 ? group("Did not arrive", d.noShows, "") : null}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    stats: { flexDirection: "row", gap: spacing.lg },
    top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
