import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuotationsPaged } from "@/hooks/use-sales";
import { formatCompactValue } from "@/lib/crm-helpers";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_TONE } from "@/types/sales";
import type { QuotationSummaryDto } from "@/types/sales";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";
import type { SalesStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<SalesStackParamList, "QuotationsList">;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "viewed", label: "Viewed" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
  { key: "expired", label: "Expired" },
];

const PAGE_SIZE = 25;

export default function QuotationsListScreen({ navigation }: Props) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<QuotationSummaryDto[]>([]);

  const query = useQuotationsPaged({ page, pageSize: PAGE_SIZE, search, status });

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
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by quotation # or customer…" />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {query.isError ? (
        <ErrorState message="Couldn't load quotations." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(q) => q.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="file-text" title="No quotations here" />}
          ListFooterComponent={
            hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null
          }
          renderItem={({ item }) => (
            <QuotationRow
              quotation={item}
              onPress={() =>
                navigation.navigate("QuotationDetail", { quotationId: item.id, quotationNumber: item.quotationNumber })
              }
            />
          )}
        />
      )}
    </View>
  );
}

function QuotationRow({ quotation, onPress }: { quotation: QuotationSummaryDto; onPress: () => void }) {
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {quotation.title || quotation.customerName || quotation.quotationNumber}
        </Text>
        <Text style={styles.value}>{formatCompactValue(quotation.total, quotation.currencyCode)}</Text>
      </View>
      <Text style={styles.meta}>
        {quotation.quotationNumber}
        {quotation.customerName ? ` · ${quotation.customerName}` : ""}
      </Text>
      <View style={styles.rowBottom}>
        <Badge label={QUOTATION_STATUS_LABELS[quotation.status] ?? quotation.status} tone={QUOTATION_STATUS_TONE[quotation.status] ?? "neutral"} />
        {quotation.isExpired ? <Badge label="Expired" tone="destructive" dot={false} /> : null}
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
  value: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
  meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
