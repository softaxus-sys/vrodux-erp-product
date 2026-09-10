import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useProductsPaged } from "@/hooks/use-inventory";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import type { ProductSummaryDto } from "@/types/inventory";
import type { InventoryStackParamList } from "@/navigation/types";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";

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
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name, SKU, barcode…" />

      <View style={styles.filterRow}>
        <Chip label="Low stock only" active={lowStockOnly} onPress={() => setLowStockOnly((v) => !v)} />
      </View>

      {query.isError ? (
        <ErrorState message="Couldn't load products." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="box" title="No products here" />}
          ListFooterComponent={
            hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null
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
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.price}>{formatCompactValue(product.salePrice, currency)}</Text>
      </View>
      <Text style={styles.meta}>{[product.sku, product.categoryName].filter(Boolean).join(" · ") || "—"}</Text>
      <View style={styles.rowBottom}>
        <Text style={[styles.stock, product.isLowStock && styles.stockLow]}>
          {product.stockQuantity} {product.unit} in stock
        </Text>
        {product.isLowStock ? <Badge label="Low stock" tone="warning" /> : null}
        {!product.isActive ? <Badge label="Inactive" tone="neutral" /> : null}
      </View>
    </ListItemCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  footerSpinner: { paddingVertical: spacing.lg },
  list: { paddingVertical: spacing.md },

  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
  price: { fontSize: fontSize.base, color: colors.foreground, fontWeight: fontWeight.semibold },
  meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  stock: { fontSize: fontSize.sm, color: colors.mutedForeground },
  stockLow: { color: colors.warning, fontWeight: fontWeight.semibold },
});
