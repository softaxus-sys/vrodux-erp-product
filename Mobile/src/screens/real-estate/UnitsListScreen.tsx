import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RealEstateStackParamList } from "@/navigation/types";
import { useUnitsPaged, useUnitsSummary } from "@/hooks/use-real-estate";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { PURPOSE_LABELS, PURPOSE_TONE, UNIT_STATUS_LABELS, UNIT_STATUS_TONE } from "@/types/real-estate";
import type { UnitDto } from "@/types/real-estate";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

import { hasPermission } from "@/store/auth.store";
import { REAL_ESTATE_UNITS_CREATE } from "@/lib/real-estate-create";
import { useHeaderActions } from "@/components/forms/useHeaderAction";
const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "vacant", label: "Vacant" },
  { key: "rented", label: "Rented" },
  { key: "sold", label: "Sold" },
  { key: "maintenance", label: "Maintenance" },
];

const PAGE_SIZE = 25;

/** No detail screen -- a unit's full record already fits in its row (mirrors the Tables screen's
 *  own reasoning in Restaurant). Property Detail also shows a property's own units nested; this
 *  screen is the cross-property browse. */
export default function UnitsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RealEstateStackParamList>>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  useHeaderActions(navigation, [{ label: "New", enabled: hasPermission(REAL_ESTATE_UNITS_CREATE), onPress: () => navigation.navigate("NewListing") }]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UnitDto[]>([]);

  const summary = useUnitsSummary();
  const query = useUnitsPaged({ page, pageSize: PAGE_SIZE, search, status: status === "all" ? undefined : status });

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
          <SummaryTile label="Vacant" value={summary.data.vacant} />
          <SummaryTile label="Rented" value={summary.data.rented} />
          <SummaryTile label="Occupancy" value={`${Math.round(summary.data.occupancyRate)}%`} />
        </View>
      ) : null}

      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by unit number…" />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {query.isError ? (
        <ErrorState message="Couldn't load units." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={() => (page === 1 ? query.refetch() : setPage(1))} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => hasMore && !query.isFetching && setPage((p) => p + 1)}
          ListEmptyComponent={<EmptyListState icon="grid" title="No units here" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => <UnitRow unit={item} currency={currency} />}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: number | string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function UnitRow({ unit, currency }: { unit: UnitDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // A sale unit's meaningful figure is salePrice, not rentPerYear -- showing "/yr" on an asking
  // price would be the Module 62 bug this screen must not repeat. Falls back to the sheet's own
  // price text when the parsed number is 0 (a raw import row without a clean figure to parse).
  const isSale = unit.purpose === "sale";
  const parsedAmount = isSale ? unit.salePrice : unit.rentPerYear;
  const priceText = parsedAmount > 0
    ? `${formatCompactValue(parsedAmount, currency)}${isSale ? "" : "/yr"}`
    : unit.priceLabel ?? "—";

  const bedsText = unit.bedsLabel ?? (unit.bedrooms ? `${unit.bedrooms}BR` : null);

  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name}>
          Unit {unit.unitNumber} <Text style={styles.subtle}>· {unit.unitType}</Text>
        </Text>
        <View style={styles.badgeGroup}>
          {unit.purpose ? (
            <Badge label={PURPOSE_LABELS[unit.purpose] ?? unit.purpose} tone={PURPOSE_TONE[unit.purpose] ?? "neutral"} />
          ) : null}
          <Badge label={UNIT_STATUS_LABELS[unit.status] ?? unit.status} tone={UNIT_STATUS_TONE[unit.status] ?? "neutral"} />
        </View>
      </View>
      <Text style={styles.meta}>
        Floor {unit.floor} · {unit.area.toLocaleString()} sqft
        {bedsText ? ` · ${bedsText}` : ""}
        {unit.currentTenantName ? ` · ${unit.currentTenantName}` : ""}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>{priceText}</Text>
        {unit.agentName ? <Text style={styles.agent}>Agent: {unit.agentName}</Text> : null}
      </View>
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
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
    subtle: { fontWeight: fontWeight.regular, color: colors.mutedForeground },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
    badgeGroup: { flexDirection: "row", gap: spacing.xs },
    rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
    agent: { fontSize: fontSize.xs, color: colors.subtleForeground },
  });
}
