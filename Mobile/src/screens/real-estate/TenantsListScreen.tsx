import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTenantsPaged, useTenantsSummary } from "@/hooks/use-real-estate";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { TENANT_STATUS_LABELS, TENANT_STATUS_TONE } from "@/types/real-estate";
import type { TenantDto } from "@/types/real-estate";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "TenantsList">;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "blacklisted", label: "Blacklisted" },
];

const PAGE_SIZE = 25;

export default function TenantsListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TenantDto[]>([]);

  const summary = useTenantsSummary();
  const query = useTenantsPaged({ page, pageSize: PAGE_SIZE, search, status: status === "all" ? undefined : status });

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
          <SummaryTile label="Active" value={summary.data.active} />
          <SummaryTile label="Leases" value={summary.data.totalActiveContracts} />
          <SummaryTile label="Collected" value={formatCompactValue(summary.data.totalPaid, currency)} />
        </View>
      ) : null}

      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name, email, or phone…" />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {query.isError ? (
        <ErrorState message="Couldn't load tenants." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={() => (page === 1 ? query.refetch() : setPage(1))} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => hasMore && !query.isFetching && setPage((p) => p + 1)}
          ListEmptyComponent={<EmptyListState icon="users" title="No tenants here" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => <TenantRow tenant={item} onPress={() => navigation.navigate("TenantDetail", { tenant: item })} />}
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

function TenantRow({ tenant, onPress }: { tenant: TenantDto; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {tenant.name}
        </Text>
        <Badge label={TENANT_STATUS_LABELS[tenant.status] ?? tenant.status} tone={TENANT_STATUS_TONE[tenant.status] ?? "neutral"} />
      </View>
      <Text style={styles.meta}>
        {tenant.tenantNumber} · {tenant.tenantType === "company" ? tenant.companyName || tenant.name : tenant.nationality}
      </Text>
      <Text style={styles.stat}>
        {tenant.activeContracts} active lease{tenant.activeContracts === 1 ? "" : "s"}
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
