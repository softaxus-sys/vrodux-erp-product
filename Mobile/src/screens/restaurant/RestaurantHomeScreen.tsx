import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useBranchDashboard, useOwnerDashboard } from "@/hooks/use-restaurant";
import {
  RESTAURANT_KITCHEN_VIEW,
  RESTAURANT_ORDERS_VIEW,
  RESTAURANT_RESERVATIONS_VIEW,
  RESTAURANT_TABLES_VIEW,
  RESTAURANT_WAITLIST_VIEW,
} from "@/lib/restaurant.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { ErrorState, LoadingState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RestaurantStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RestaurantStackParamList, "RestaurantHome">;

/** "Front-of-house + kitchen coordination," not an order-taking terminal -- see
 *  lib/restaurant.api.ts's top-of-file note for why order-taking/payment/split-bill deliberately
 *  have no mobile screen at all. */
export default function RestaurantHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const canTables = hasPermission(RESTAURANT_TABLES_VIEW);
  const canOrders = hasPermission(RESTAURANT_ORDERS_VIEW);
  const canKitchen = hasPermission(RESTAURANT_KITCHEN_VIEW);
  const canReservations = hasPermission(RESTAURANT_RESERVATIONS_VIEW);
  const canWaitlist = hasPermission(RESTAURANT_WAITLIST_VIEW);

  const owner = useOwnerDashboard();
  const branch = useBranchDashboard();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Today</Text>
      {owner.isLoading ? (
        <LoadingState size="small" />
      ) : owner.isError ? (
        <ErrorState message="Couldn't load today's summary." onRetry={() => owner.refetch()} />
      ) : owner.data ? (
        <View style={styles.dashboardRow}>
          <View style={styles.dashboardTile}>
            <Text style={styles.dashboardValue}>{formatCompactValue(owner.data.todaySales, currency)}</Text>
            <Text style={styles.dashboardLabel}>Sales</Text>
          </View>
          <View style={styles.dashboardTile}>
            <Text style={styles.dashboardValue}>{owner.data.todayOrders}</Text>
            <Text style={styles.dashboardLabel}>Orders</Text>
          </View>
          <View style={styles.dashboardTile}>
            <Text style={styles.dashboardValue}>{branch.data?.activeOrders ?? "—"}</Text>
            <Text style={styles.dashboardLabel}>Active</Text>
          </View>
        </View>
      ) : null}

      {branch.data ? (
        <View style={styles.floorRow}>
          <FloorStat label="Available" value={branch.data.tablesAvailable} tone={colors.success} />
          <FloorStat label="Occupied" value={branch.data.tablesOccupied} tone={colors.warning} />
          <FloorStat label="Reserved" value={branch.data.tablesReserved} tone={colors.info} />
          <FloorStat label="Cleaning" value={branch.data.tablesCleaning} tone={colors.mutedForeground} />
        </View>
      ) : null}

      <View style={styles.menu}>
        {canTables ? (
          <MenuCard
            icon="grid"
            title="Tables"
            subtitle="Floor status at a glance"
            tint={colors.primary}
            onPress={() => navigation.navigate("TablesList")}
          />
        ) : null}
        {canOrders ? (
          <MenuCard
            icon="list"
            title="Live Orders"
            subtitle="Every order in play right now"
            tint={colors.info}
            onPress={() => navigation.navigate("OrdersList")}
          />
        ) : null}
        {canKitchen ? (
          <MenuCard
            icon="watch"
            title="Kitchen"
            subtitle="Active tickets, mark items ready"
            tint={colors.warning}
            onPress={() => navigation.navigate("KitchenTickets")}
          />
        ) : null}
        {canReservations ? (
          <MenuCard
            icon="calendar"
            title="Reservations"
            subtitle="Today's bookings, seat or cancel"
            tint={colors.success}
            onPress={() => navigation.navigate("ReservationsList")}
          />
        ) : null}
        {canWaitlist ? (
          <MenuCard
            icon="clock"
            title="Waitlist"
            subtitle="Walk-ins waiting for a table"
            tint={colors.mutedForeground}
            onPress={() => navigation.navigate("WaitlistList")}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

function FloorStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.floorStat}>
      <Text style={[styles.floorValue, { color: tone }]}>{value}</Text>
      <Text style={styles.floorLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    sectionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 },

    dashboardRow: { flexDirection: "row", gap: spacing.md },
    dashboardTile: { flex: 1, backgroundColor: colors.cardMuted, borderRadius: 12, padding: spacing.md },
    dashboardValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    dashboardLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    floorRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md },
    floorStat: { alignItems: "center" },
    floorValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    floorLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    menu: { gap: spacing.sm, marginTop: spacing.sm },
  });
}
