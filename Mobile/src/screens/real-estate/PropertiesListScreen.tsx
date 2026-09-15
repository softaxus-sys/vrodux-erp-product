import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePropertiesPaged, usePropertiesSummary } from "@/hooks/use-real-estate";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_TONE } from "@/types/real-estate";
import type { PropertyDto } from "@/types/real-estate";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "PropertiesList">;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "partially_occupied", label: "Partial" },
  { key: "fully_occupied", label: "Fully Occupied" },
];

const PAGE_SIZE = 25;

export default function PropertiesListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PropertyDto[]>([]);

  const summary = usePropertiesSummary();
  const query = usePropertiesPaged({ page, pageSize: PAGE_SIZE, search, status: status === "all" ? undefined : status });

  useEffect(() => setPage(1), [status, search]);
  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (query.data.page === 1 ? query.data.items : [...prev, ...query.data.items]));
  }, [query.data]);

  const hasMore = query.data ? query.data.page < query.data.totalPages : false;

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Occupancy" value={`${Math.round(summary.data.occupancyRate)}%`} />
          <SummaryTile label="Units" value={String(summary.data.totalUnits)} />
          <SummaryTile label="Value" value={formatCompactValue(summary.data.totalMarketValue, currency)} />
        </View>
      ) : null}

      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name or number…" />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {query.isError ? (
        <ErrorState message="Couldn't load properties." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={() => (page === 1 ? query.refetch() : setPage(1))} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => hasMore && !query.isFetching && setPage((p) => p + 1)}
          ListEmptyComponent={<EmptyListState icon="home" title="No properties here" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <PropertyRow property={item} onPress={() => navigation.navigate("PropertyDetail", { propertyId: item.id, propertyName: item.name })} />
          )}
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

function PropertyRow({ property, onPress }: { property: PropertyDto; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {property.name}
        </Text>
        <Badge label={PROPERTY_STATUS_LABELS[property.status] ?? property.status} tone={PROPERTY_STATUS_TONE[property.status] ?? "neutral"} />
      </View>
      <Text style={styles.meta}>
        {property.propertyNumber} · {property.propertyType} · {property.location.city}
      </Text>
      <Text style={styles.stat}>
        {property.occupiedUnits}/{property.totalUnits} units occupied ({Math.round(property.occupancyRate)}%)
      </Text>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
    footerSpinner: { paddingVertical: spacing.lg },
    list: { paddingVertical: spacing.md },

    summaryRow: { flexDirection: "row", justifyContent: "space-around", margin: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: spacing.md },
    summaryTile: { alignItems: "center" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    summaryLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
