import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useBrokersPaged, useBrokersSummary } from "@/hooks/use-real-estate";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import type { BrokerDto } from "@/types/real-estate";
import { EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "BrokersList">;

const PAGE_SIZE = 25;

export default function BrokersListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BrokerDto[]>([]);

  const summary = useBrokersSummary();
  const query = useBrokersPaged({ page, pageSize: PAGE_SIZE, search });

  useEffect(() => setPage(1), [search]);
  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (query.data.page === 1 ? query.data.items : [...prev, ...query.data.items]));
  }, [query.data]);

  const hasMore = query.data ? query.data.page < query.data.totalPages : false;

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Brokers" value={String(summary.data.total)} />
          <SummaryTile label="Deals" value={String(summary.data.totalDeals)} />
          <SummaryTile label="Commission" value={formatCompactValue(summary.data.totalCommission, currency)} />
        </View>
      ) : null}

      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name or agency…" />

      {query.isError ? (
        <ErrorState message="Couldn't load brokers." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={() => (page === 1 ? query.refetch() : setPage(1))} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => hasMore && !query.isFetching && setPage((p) => p + 1)}
          ListEmptyComponent={<EmptyListState icon="user" title="No brokers here" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => <BrokerRow broker={item} onPress={() => navigation.navigate("BrokerDetail", { broker: item })} />}
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

function BrokerRow({ broker, onPress }: { broker: BrokerDto; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {broker.name}
        </Text>
        <View style={styles.rating}>
          <Feather name="star" size={13} color={colors.warning} />
          <Text style={styles.ratingText}>{broker.rating.toFixed(1)}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {broker.agency} · {broker.specialization}
      </Text>
      <Text style={styles.stat}>
        {broker.dealsCompleted} deal{broker.dealsCompleted === 1 ? "" : "s"}
      </Text>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    footerSpinner: { paddingVertical: spacing.lg },
    list: { paddingVertical: spacing.md },

    summaryRow: { flexDirection: "row", justifyContent: "space-around", margin: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: spacing.md },
    summaryTile: { alignItems: "center" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    summaryLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    rating: { flexDirection: "row", alignItems: "center", gap: 4 },
    ratingText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
