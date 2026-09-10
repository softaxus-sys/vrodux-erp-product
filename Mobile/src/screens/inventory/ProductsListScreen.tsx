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
import { useProductsPaged } from "@/hooks/use-inventory";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import type { ProductSummaryDto } from "@/types/inventory";
import type { InventoryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<InventoryStackParamList, "ProductsList">;

const PAGE_SIZE = 25;

export default function ProductsListScreen({ navigation }: Props) {
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ProductSummaryDto[]>([]);

  const query = useProductsPaged({ page, pageSize: PAGE_SIZE, search, isLowStock: lowStockOnly || undefined });

  useEffect(() => {
    setPage(1);
  }, [search, lowStockOnly]);

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
        placeholder="Search by name, SKU, barcode…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.chip, lowStockOnly && styles.chipActive]}
          onPress={() => setLowStockOnly((v) => !v)}
        >
          <Text style={[styles.chipText, lowStockOnly && styles.chipTextActive]}>Low stock only</Text>
        </Pressable>
      </View>

      {query.isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Couldn&apos;t load products.</Text>
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
          keyExtractor={(p) => p.id}
          contentContainerStyle={items.length === 0 ? styles.emptyList : undefined}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<Text style={styles.emptyText}>No products here.</Text>}
          ListFooterComponent={
            hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} /> : null
          }
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              currency={currency}
              onPress={() => navigation.navigate("ProductDetail", { productId: item.id, productName: item.name })}
            />
          )}
        />
      )}
    </View>
  );
}

function ProductRow({
  product,
  currency,
  onPress,
}: {
  product: ProductSummaryDto;
  currency: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.price}>{formatCompactValue(product.salePrice, currency)}</Text>
      </View>
      <Text style={styles.meta}>
        {[product.sku, product.categoryName].filter(Boolean).join(" · ") || "—"}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={[styles.stock, product.isLowStock && styles.stockLow]}>
          {product.stockQuantity} {product.unit} in stock
        </Text>
        {product.isLowStock ? <Text style={styles.lowBadge}>Low stock</Text> : null}
        {!product.isActive ? <Text style={styles.inactiveBadge}>Inactive</Text> : null}
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
  filterRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8, marginBottom: 8 },
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
  name: { fontSize: 16, fontWeight: "600", color: "#111827", flexShrink: 1 },
  price: { fontSize: 13, color: "#111827", fontWeight: "600" },
  meta: { fontSize: 13, color: "#4b5563" },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  stock: { fontSize: 12, color: "#6b7280" },
  stockLow: { color: "#b45309", fontWeight: "600" },
  lowBadge: { fontSize: 11, color: "#b45309", backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  inactiveBadge: { fontSize: 11, color: "#6b7280", backgroundColor: "#f3f4f6", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
});
