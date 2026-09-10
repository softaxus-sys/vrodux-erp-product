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
import { useVendorsPaged } from "@/hooks/use-purchase";
import type { VendorDto } from "@/types/purchase";
import type { PurchaseStackParamList } from "@/navigation/types";

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
      <TextInput
        style={styles.search}
        placeholder="Search by name, code, email…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      {query.isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Couldn&apos;t load vendors.</Text>
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
          keyExtractor={(v) => v.id}
          contentContainerStyle={items.length === 0 ? styles.emptyList : undefined}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<Text style={styles.emptyText}>No vendors here.</Text>}
          ListFooterComponent={
            hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} /> : null
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
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {vendor.name}
        </Text>
        {vendor.rating > 0 ? <Text style={styles.rating}>★ {vendor.rating.toFixed(1)}</Text> : null}
      </View>
      <Text style={styles.meta}>
        {[vendor.category, vendor.contactPerson].filter(Boolean).join(" · ") || "—"}
      </Text>
      <Text style={styles.meta}>
        {vendor.purchaseOrderCount} order{vendor.purchaseOrderCount === 1 ? "" : "s"}
      </Text>
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
  rating: { fontSize: 13, color: "#b45309", fontWeight: "600" },
  meta: { fontSize: 13, color: "#4b5563" },
});
