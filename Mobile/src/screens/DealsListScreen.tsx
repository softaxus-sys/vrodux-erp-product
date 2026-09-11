import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useDealsPaged } from "@/hooks/use-deals";
import { formatCompactValue } from "@/lib/crm-helpers";
import { DEAL_STAGE_TONE, PIPELINE_STAGES } from "@/types/crm";
import type { DealDto } from "@/types/crm";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";
import type { DealsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<DealsStackParamList, "DealsList">;

const FILTERS = [{ key: "all", label: "All" }, ...PIPELINE_STAGES];
const PAGE_SIZE = 25;

export default function DealsListScreen({ navigation }: Props) {
  const [stage, setStage] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DealDto[]>([]);

  const query = useDealsPaged({ page, pageSize: PAGE_SIZE, search, stage });

  useEffect(() => {
    setPage(1);
  }, [stage, search]);

  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (query.data.page === 1 ? query.data.items : [...prev, ...query.data.items]));
  }, [query.data]);

  const hasMore = query.data ? query.data.page < query.data.totalPages : false;

  function loadMore() {
    if (hasMore && !query.isFetching) setPage((p) => p + 1);
  }

  function refresh() {
    if (page === 1) query.refetch();
    else setPage(1);
  }

  return (
    <View style={styles.container}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search opportunities by title, company…" />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={stage === f.key} onPress={() => setStage(f.key)} />
        ))}
      </View>

      {query.isError ? (
        <ErrorState message="Could not load the pipeline." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(d) => d.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="trending-up" title="No opportunities here" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <DealRow
              deal={item}
              onPress={() => navigation.navigate("DealDetail", { dealId: item.id, dealTitle: item.title })}
            />
          )}
        />
      )}
    </View>
  );
}

function DealRow({ deal, onPress }: { deal: DealDto; onPress: () => void }) {
  const stageLabel = PIPELINE_STAGES.find((s) => s.key === deal.stage)?.label ?? deal.stage;
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {deal.title}
        </Text>
        <Badge label={stageLabel} tone={DEAL_STAGE_TONE[deal.stage] ?? "neutral"} dot={false} />
      </View>
      {deal.company ? <Text style={styles.company}>{deal.company}</Text> : null}
      <View style={styles.rowBottom}>
        <Text style={styles.value}>{formatCompactValue(deal.value, deal.currency)}</Text>
        <Text style={styles.weighted}>
          {formatCompactValue(deal.weightedValue, deal.currency)} weighted · {deal.probability}%
        </Text>
      </View>
    </ListItemCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  footerSpinner: { paddingVertical: spacing.lg },
  list: { paddingVertical: spacing.md },

  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
  company: { fontSize: fontSize.base, color: colors.foregroundSecondary },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  value: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
  weighted: { fontSize: fontSize.sm, color: colors.mutedForeground },
});
