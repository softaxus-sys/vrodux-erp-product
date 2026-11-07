import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTourDepartures, useTourPackages } from "@/hooks/use-tours";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { Badge, EmptyListState, ErrorState, ListItemCard, LoadingState, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

/** What the agency sells (packages) and when it leaves (open departures from today). Read-only on the
 *  phone: building a package and scheduling departures stay on the web. */
export default function TourPackagesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const packages = useTourPackages();
  const departures = useTourDepartures();

  if (packages.isLoading || departures.isLoading) return <LoadingState />;
  if (packages.isError) return <ErrorState message="Couldn't load packages." onRetry={() => { packages.refetch(); departures.refetch(); }} />;

  const pk = packages.data ?? [];
  const dep = departures.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={packages.isRefetching || departures.isRefetching}
          onRefresh={() => { packages.refetch(); departures.refetch(); }}
          tintColor={colors.primary}
        />
      }
    >
      <SectionCard title="Upcoming departures">
        {dep.length === 0 ? (
          <Text style={styles.meta}>No open departures.</Text>
        ) : (
          dep.map((d) => (
            <ListItemCard key={d.id}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>{d.packageName}</Text>
                <Badge label={d.seatsLeft > 0 ? `${d.seatsLeft} seats left` : "Full"} tone={d.seatsLeft > 0 ? "success" : "destructive"} />
              </View>
              <Text style={styles.meta}>{d.startDate} → {d.endDate} · {d.seatsBooked}/{d.capacity} booked</Text>
              <Text style={styles.meta}>Adult {formatCompactValue(d.adultPrice, currency)} · Child {formatCompactValue(d.childPrice, currency)}</Text>
            </ListItemCard>
          ))
        )}
      </SectionCard>

      <SectionCard title="Packages">
        {pk.length === 0 ? (
          <EmptyListState icon="map" title="No packages yet" />
        ) : (
          pk.map((p) => (
            <ListItemCard key={p.id}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                {!p.isActive ? <Badge label="Inactive" tone="neutral" /> : null}
              </View>
              <Text style={styles.meta}>
                {[p.code, p.destination, `${p.durationDays} day${p.durationDays === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
              </Text>
              <Text style={styles.meta}>
                From {formatCompactValue(p.pricePerAdult, currency)} · {p.upcomingDepartures} upcoming departure{p.upcomingDepartures === 1 ? "" : "s"}
              </Text>
            </ListItemCard>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
    name: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
