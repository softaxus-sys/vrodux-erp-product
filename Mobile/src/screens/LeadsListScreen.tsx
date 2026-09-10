import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLeadsPaged } from "@/hooks/use-leads";
import { buildLeadSummary, formatCompactValue, leadHeat, urgencyLabel } from "@/lib/crm-helpers";
import type { LeadDto } from "@/types/crm";
import { Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";
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

  useEffect(() => {
    setPage(1);
  }, [status, search]);

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
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search leads by name, company, phone…" />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {query.isError ? (
        <ErrorState message="Couldn't load leads." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(l) => l.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="users" title="No leads here" />}
          ListFooterComponent={
            hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null
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
    <ListItemCard onPress={onPress}>
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
    </ListItemCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  footerSpinner: { paddingVertical: spacing.lg },
  list: { paddingVertical: spacing.md },

  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
  score: { fontSize: fontSize.base, color: colors.mutedForeground, fontWeight: fontWeight.semibold },
  company: { fontSize: fontSize.base, color: colors.foregroundSecondary },
  summary: { fontSize: fontSize.base, color: colors.mutedForeground },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  value: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
  urgency: { fontSize: fontSize.sm, color: colors.warning },
});
