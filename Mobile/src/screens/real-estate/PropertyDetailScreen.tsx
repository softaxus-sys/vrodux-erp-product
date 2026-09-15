import { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useProperty } from "@/hooks/use-real-estate";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_TONE, UNIT_STATUS_LABELS, UNIT_STATUS_TONE } from "@/types/real-estate";
import { Badge, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "PropertyDetail">;

export default function PropertyDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { propertyId, propertyName } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: propertyName });
  }, [navigation, propertyName]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const property = useProperty(propertyId);

  if (property.isLoading || !property.data) {
    return <LoadingState />;
  }
  if (property.isError) {
    return <ErrorState message="Couldn't load this property." onRetry={() => property.refetch()} />;
  }

  const p = property.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{p.name}</Text>
        <View style={styles.subtitleRow}>
          <Badge label={PROPERTY_STATUS_LABELS[p.status] ?? p.status} tone={PROPERTY_STATUS_TONE[p.status] ?? "neutral"} />
          <Text style={styles.subtitle}>
            {p.propertyNumber} · {p.propertyType}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <Stat label="Units" value={`${p.occupiedUnits}/${p.totalUnits}`} />
          <Stat label="Occupancy" value={`${Math.round(p.occupancyRate)}%`} tone="primary" />
          <Stat label="Area" value={`${p.totalArea.toLocaleString()} sqft`} />
          <Stat label="Value" value={formatCompactValue(p.marketValue, currency)} />
        </View>
      </View>

      <SectionCard title="Details">
        <DetailRow label="Address" value={p.location.address || "—"} />
        <DetailRow label="City" value={p.location.city} />
        <DetailRow label="Emirate" value={p.location.emirate} />
        {p.developer ? <DetailRow label="Developer" value={p.developer} /> : null}
      </SectionCard>

      {p.description ? (
        <SectionCard title="Description">
          <Text style={styles.bodyText}>{p.description}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title={`Units (${p.units.length})`}>
        {p.units.length === 0 ? (
          <Text style={styles.emptyText}>No units recorded yet.</Text>
        ) : (
          p.units.map((u) => (
            <View key={u.id} style={styles.unitRow}>
              <View style={styles.unitTop}>
                <Text style={styles.unitName}>
                  Unit {u.unitNumber} <Text style={styles.unitType}>· {u.unitType}</Text>
                </Text>
                <Badge label={UNIT_STATUS_LABELS[u.status] ?? u.status} tone={UNIT_STATUS_TONE[u.status] ?? "neutral"} />
              </View>
              <Text style={styles.unitMeta}>
                Floor {u.floor} · {u.area.toLocaleString()} sqft · {formatCompactValue(u.rentPerYear, currency)}/yr
                {u.currentTenantName ? ` · ${u.currentTenantName}` : ""}
              </Text>
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.xs },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },

    bodyText: { fontSize: fontSize.md, color: colors.foreground },
    emptyText: { fontSize: fontSize.base, color: colors.mutedForeground },

    unitRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: 2 },
    unitTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    unitName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    unitType: { fontWeight: fontWeight.regular, color: colors.mutedForeground },
    unitMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
