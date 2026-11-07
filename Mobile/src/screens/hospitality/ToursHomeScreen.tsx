import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTourDashboard } from "@/hooks/use-tours";
import { formatCompactValue } from "@/lib/crm-helpers";
import { TOURS_BOOKINGS_VIEW, TOURS_PACKAGES_VIEW } from "@/lib/tours.api";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { Badge, ErrorState, ListItemCard, LoadingState, MenuCard, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { HospitalityStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<HospitalityStackParamList, "ToursHome">;

/** Tour operator / travel agency view: what needs attention today, upcoming departures, and the
 *  way into packages and bookings. Same figures as the web's agency dashboard. */
export default function ToursHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const canBookings = hasPermission(TOURS_BOOKINGS_VIEW);
  const canPackages = hasPermission(TOURS_PACKAGES_VIEW, TOURS_BOOKINGS_VIEW);
  const dash = useTourDashboard(canBookings);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {canBookings ? (
        dash.isLoading ? (
          <LoadingState size="small" />
        ) : dash.isError ? (
          <ErrorState message="Couldn't load the tours overview." onRetry={() => dash.refetch()} />
        ) : dash.data ? (
          <>
            <Text style={styles.sectionLabel}>Overview</Text>
            <View style={styles.tileGrid}>
              <Tile label="Enquiries" value={String(dash.data.enquiries)} tone={colors.warning} />
              <Tile label="Confirmed" value={String(dash.data.confirmed)} tone={colors.success} />
              <Tile label="Travelling now" value={String(dash.data.travellingNow)} tone={colors.info} />
              <Tile label="Departing in 30 days" value={String(dash.data.departingNext30Days)} tone={colors.primary} />
              <Tile label="Balance due" value={formatCompactValue(dash.data.balanceDue, currency)} tone={colors.warning} />
              <Tile label="Overdue" value={formatCompactValue(dash.data.overdueAmount, currency)} tone={colors.destructive} />
            </View>

            {dash.data.attention.length > 0 ? (
              <SectionCard title="Needs attention">
                {dash.data.attention.slice(0, 8).map((a) => (
                  <ListItemCard
                    key={`${a.bookingId}-${a.kind}`}
                    onPress={() => navigation.navigate("TourBookingDetail", { bookingId: a.bookingId, bookingNumber: a.bookingNumber })}
                  >
                    <View style={styles.rowTop}>
                      <Text style={styles.name} numberOfLines={1}>{a.customerName}</Text>
                      <Badge label={a.kind} tone={a.kind === "payment" || a.kind === "passport" ? "destructive" : "warning"} />
                    </View>
                    <Text style={styles.meta}>{a.bookingNumber} · {a.message}</Text>
                  </ListItemCard>
                ))}
              </SectionCard>
            ) : null}

            {dash.data.upcomingDepartures.length > 0 ? (
              <SectionCard title="Upcoming departures">
                {dash.data.upcomingDepartures.slice(0, 6).map((d) => (
                  <ListItemCard key={d.id}>
                    <View style={styles.rowTop}>
                      <Text style={styles.name} numberOfLines={1}>{d.packageName}</Text>
                      <Text style={styles.meta}>{d.seatsLeft} left</Text>
                    </View>
                    <Text style={styles.meta}>{d.startDate} → {d.endDate} · {d.seatsBooked}/{d.capacity} booked</Text>
                  </ListItemCard>
                ))}
              </SectionCard>
            ) : null}
          </>
        ) : null
      ) : null}

      <View style={styles.menu}>
        {canBookings ? (
          <MenuCard icon="briefcase" title="Tour bookings" subtitle="Follow, confirm and collect payments" tint={colors.info} onPress={() => navigation.navigate("TourBookingsList")} />
        ) : null}
        {canPackages ? (
          <MenuCard icon="map" title="Packages & departures" subtitle="What you sell and when it leaves" tint={colors.primary} onPress={() => navigation.navigate("TourPackages")} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color: tone }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    sectionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 },
    tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.cardMuted, borderRadius: 12, padding: spacing.md },
    tileValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    tileLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
    name: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    menu: { gap: spacing.sm, marginTop: spacing.sm },
  });
}
