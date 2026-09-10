import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useVendorsPaged } from "@/hooks/use-purchase";
import type { VendorDto } from "@/types/purchase";
import type { PurchaseStackParamList } from "@/navigation/types";
import { EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";

type Props = NativeStackScreenProps<PurchaseStackParamList, "VendorsList">;

const PAGE_SIZE = 25;

export default function VendorsListScreen({ navigation }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<VendorDto[]>([]);

  const query = useVendorsPaged({ page, pageSize: PAGE_SIZE, search });

  useEffect(() => {
    setPage(1);
  }, [search]);

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
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name, code, email…" />

      {query.isError ? (
        <ErrorState message="Couldn't load vendors." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(v) => v.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="truck" title="No vendors here" />}
          ListFooterComponent={
            hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null
          }
          renderItem={({ item }) => (
            <VendorRow
              vendor={item}
              onPress={() => navigation.navigate("VendorDetail", { vendorId: item.id, vendorName: item.name })}
            />
          )}
        />
      )}
    </View>
  );
}

function VendorRow({ vendor, onPress }: { vendor: VendorDto; onPress: () => void }) {
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {vendor.name}
        </Text>
        {vendor.rating > 0 ? <Text style={styles.rating}>★ {vendor.rating.toFixed(1)}</Text> : null}
      </View>
      <Text style={styles.meta}>{[vendor.category, vendor.contactPerson].filter(Boolean).join(" · ") || "—"}</Text>
      <Text style={styles.meta}>
        {vendor.purchaseOrderCount} order{vendor.purchaseOrderCount === 1 ? "" : "s"}
      </Text>
    </ListItemCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  footerSpinner: { paddingVertical: spacing.lg },
  list: { paddingVertical: spacing.md },

  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
  rating: { fontSize: fontSize.base, color: colors.warning, fontWeight: fontWeight.semibold },
  meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
});
