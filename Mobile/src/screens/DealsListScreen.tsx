import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useDealsPaged } from "@/hooks/use-deals";
import { formatCompactValue } from "@/lib/crm-helpers";
import { PIPELINE_STAGES } from "@/types/crm";
import type { DealDto } from "@/types/crm";
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
      <TextInput
        style={styles.search}
        placeholder="Search opportunities by title, company..."
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} style={[styles.chip, stage === f.key && styles.chipActive]} onPress={() => setStage(f.key)}>
            <Text style={[styles.chipText, stage === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {query.isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Could not load the pipeline.</Text>
          <Pressable onPress={() => query.refetch()}>
            <Text style={styles.retry}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : query.isLoading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(d) => d.id}
          contentContainerStyle={items.length === 0 ? styles.emptyList : undefined}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<Text style={styles.emptyText}>No opportunities here.</Text>}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} /> : null}
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
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {deal.title}
        </Text>
        <Text style={styles.stageBadge}>{stageLabel}</Text>
      </View>
      {deal.company ? <Text style={styles.company}>{deal.company}</Text> : null}
      <View style={styles.rowBottom}>
        <Text style={styles.value}>{formatCompactValue(deal.value, deal.currency)}</Text>
        <Text style={styles.weighted}>
          {formatCompactValue(deal.weightedValue, deal.currency)} weighted · {deal.probability}%
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  search: {
    margin: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#f3f4f6" },
  chipActive: { backgroundColor: "#111827" },
  chipText: { fontSize: 13, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorText: { color: "#dc2626" },
  retry: { color: "#2563eb", fontWeight: "600" },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#6b7280" },
  footerSpinner: { paddingVertical: 16 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 2 },
  rowPressed: { backgroundColor: "#f9fafb" },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "600", color: "#111827", flexShrink: 1 },
  stageBadge: { fontSize: 11, color: "#374151", backgroundColor: "#e5e7eb", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  company: { fontSize: 13, color: "#4b5563" },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  value: { fontSize: 13, fontWeight: "600", color: "#111827" },
  weighted: { fontSize: 12, color: "#6b7280" },
});
