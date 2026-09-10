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
import { useLeadsPaged } from "@/hooks/use-leads";
import { buildLeadSummary, formatCompactValue, leadHeat, urgencyLabel } from "@/lib/crm-helpers";
import type { LeadDto } from "@/types/crm";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "LeadsList">;

const FILTERS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "all", label: "All" },
];

const PAGE_SIZE = 25;

export default function LeadsListScreen({ navigation }: Props) {
  const [status, setStatus] = useState("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<LeadDto[]>([]);

  const query = useLeadsPaged({
    page,
    pageSize: PAGE_SIZE,
    search,
    status,
    sortBy: "score",
    sortDesc: true,
  });

  // Reset to page 1 whenever the filter/search changes.
  useEffect(() => {
    setPage(1);
  }, [status, search]);

  // Page 1 replaces the list (new filter, or pull-to-refresh); later pages append.
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
        placeholder="Search leads by name, company, phone…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, status === f.key && styles.chipActive]}
            onPress={() => setStatus(f.key)}
          >
            <Text style={[styles.chipText, status === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {query.isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Couldn't load leads.</Text>
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
          keyExtractor={(l) => l.id}
          contentContainerStyle={items.length === 0 ? styles.emptyList : undefined}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<Text style={styles.emptyText}>No leads here.</Text>}
          ListFooterComponent={
            hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} /> : null
          }
          renderItem={({ item }) => (
            <LeadRow lead={item} onPress={() => navigation.navigate("LeadDetail", { leadId: item.id, leadName: item.fullName })} />
          )}
        />
      )}
    </View>
  );
}

function LeadRow({ lead, onPress }: { lead: LeadDto; onPress: () => void }) {
  const heat = leadHeat(lead.score);
  const urgency = urgencyLabel(lead.purchaseUrgency);
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {heat.emoji} {lead.fullName || "—"}
        </Text>
        <Text style={styles.score}>{lead.score}</Text>
      </View>
      {lead.company ? <Text style={styles.company}>{lead.company}</Text> : null}
      <Text style={styles.summary} numberOfLines={1}>
        {buildLeadSummary(lead)}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.value}>{formatCompactValue(lead.estimatedValue, lead.currency)}</Text>
        {urgency ? <Text style={styles.urgency}>{urgency}</Text> : null}
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
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  chipActive: { backgroundColor: "#111827" },
  chipText: { fontSize: 13, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorText: { color: "#dc2626" },
  retry: { color: "#2563eb", fontWeight: "600" },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#6b7280" },
  footerSpinner: { paddingVertical: 16 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 2,
  },
  rowPressed: { backgroundColor: "#f9fafb" },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "600", color: "#111827", flexShrink: 1 },
  score: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  company: { fontSize: 13, color: "#4b5563" },
  summary: { fontSize: 13, color: "#6b7280" },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  value: { fontSize: 13, fontWeight: "600", color: "#111827" },
  urgency: { fontSize: 12, color: "#b45309" },
});
