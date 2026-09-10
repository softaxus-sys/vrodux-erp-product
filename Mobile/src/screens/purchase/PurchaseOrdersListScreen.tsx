import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePurchaseOrdersPaged } from "@/hooks/use-purchase";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { PURCHASE_ORDER_STATUS_LABELS, PURCHASE_ORDER_STATUS_TONE } from "@/types/purchase";
import type { PurchaseOrderSummaryDto } from "@/types/purchase";
import type { PurchaseStackParamList } from "@/navigation/types";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";

type Props = NativeStackScreenProps<PurchaseStackParamList, "PurchaseOrdersList">;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "partial", label: "Partial" },
  { key: "received", label: "Received" },
  { key: "cancelled", label: "Cancelled" },
];

const PAGE_SIZE = 25;

export default function PurchaseOrdersListScreen({ navigation }: Props) {
  // PurchaseOrderSummaryDto carries no currency of its own -- purchasing is recorded in the
  // tenant's operating currency (CLAUDE.md Module 6e/50), so read it off the session claims.
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PurchaseOrderSummaryDto[]>([]);

  const query = usePurchaseOrdersPaged({ page, pageSize: PAGE_SIZE, search, status });

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
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by order # or vendor…" />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {query.isError ? (
        <ErrorState message="Couldn't load purchase orders." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="shopping-cart" title="No purchase orders here" />}
          ListFooterComponent={
            hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null
          }
          renderItem={({ item }) => (
            <OrderRow
              order={item}
              currency={currency}
              onPress={() =>
                navigation.navigate("PurchaseOrderDetail", { orderId: item.id, orderNumber: item.orderNumber })
              }
            />
          )}
        />
      )}
    </View>
  );
}

function OrderRow({ order, currency, onPress }: { order: PurchaseOrderSummaryDto; currency: string; onPress: () => void }) {
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {order.vendorName}
        </Text>
        <Text style={styles.value}>{formatCompactValue(order.total, currency)}</Text>
      </View>
      <Text style={styles.meta}>
        {order.orderNumber} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
      </Text>
      <Badge label={PURCHASE_ORDER_STATUS_LABELS[order.status] ?? order.status} tone={PURCHASE_ORDER_STATUS_TONE[order.status] ?? "neutral"} />
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
});
