import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useBookingsSummary, useHousekeepingSummary, useRoomsSummary } from "@/hooks/use-hospitality";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { ErrorState, LoadingState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { HospitalityStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<HospitalityStackParamList, "HospitalityHome">;

export default function HospitalityHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const rooms = useRoomsSummary();
  const bookings = useBookingsSummary();
  const housekeeping = useHousekeepingSummary();

  const loading = rooms.isLoading || bookings.isLoading || housekeeping.isLoading;
  const anyError = rooms.isError || bookings.isError || housekeeping.isError;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Overview</Text>
      {loading ? (
        <LoadingState size="small" />
      ) : anyError ? (
        <ErrorState message="Couldn't load the overview." onRetry={() => { rooms.refetch(); bookings.refetch(); housekeeping.refetch(); }} />
      ) : (
        <View style={styles.tileGrid}>
          {rooms.data ? <Tile label="Occupancy" value={`${Math.round(rooms.data.occupancyRate)}%`} tone={colors.primary} /> : null}
          {rooms.data ? <Tile label="Available rooms" value={String(rooms.data.available)} tone={colors.success} /> : null}
          {bookings.data ? <Tile label="Checked in" value={String(bookings.data.checkedIn)} tone={colors.info} /> : null}
          {bookings.data ? <Tile label="Outstanding" value={formatCompactValue(bookings.data.outstanding, currency)} tone={colors.warning} /> : null}
          {housekeeping.data ? <Tile label="Pending tasks" value={String(housekeeping.data.pending)} tone={colors.warning} /> : null}
          {housekeeping.data ? <Tile label="Urgent" value={String(housekeeping.data.urgent)} tone={colors.destructive} /> : null}
        </View>
      )}

      <View style={styles.menu}>
        <MenuCard icon="home" title="Rooms" subtitle="Live status of every room" tint={colors.primary} onPress={() => navigation.navigate("RoomsList")} />
        <MenuCard icon="calendar" title="Bookings" subtitle="Check in and check out guests" tint={colors.info} onPress={() => navigation.navigate("BookingsList")} />
        <MenuCard icon="clipboard" title="Housekeeping" subtitle="Start, complete, and verify tasks" tint={colors.warning} onPress={() => navigation.navigate("HousekeepingList")} />
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

    menu: { gap: spacing.sm, marginTop: spacing.sm },
  });
}
