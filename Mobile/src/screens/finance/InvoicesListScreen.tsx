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
import { useInvoicesPaged } from "@/hooks/use-finance";
import { formatCompactValue } from "@/lib/crm-helpers";
import { INVOICE_STATUS_LABELS } from "@/types/finance";
import type { InvoiceSummaryDto } from "@/types/finance";
import type { FinanceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<FinanceStackParamList, "InvoicesList">;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "cancelled", label: "Cancelled" },
];

const PAGE_SIZE = 25;

export default function InvoicesListScreen({ navigation }: Props) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<InvoiceSummaryDto[]>([]);

  const query = useInvoicesPaged({ page, pageSize: PAGE_SIZE, search, status });

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
      <TextInput
        style={styles.search}
        placeholder="Search by invoice # or customer…"
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
          <Text style={styles.errorText}>Couldn&apos;t load invoices.</Text>
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
          keyExtractor={(i) => i.id}
          contentContainerStyle={items.length === 0 ? styles.emptyList : undefined}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<Text style={styles.emptyText}>No invoices here.</Text>}
          ListFooterComponent={
            hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} /> : null
          }
          renderItem={({ item }) => (
            <InvoiceRow
              invoice={item}
              onPress={() =>
                navigation.navigate("InvoiceDetail", { invoiceId: item.id, invoiceNumber: item.invoiceNumber })
              }
            />
          )}
        />
      )}
    </View>
  );
}

function InvoiceRow({ invoice, onPress }: { invoice: InvoiceSummaryDto; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {invoice.customerName}
        </Text>
        <Text style={styles.value}>{formatCompactValue(invoice.total, invoice.currencyCode)}</Text>
      </View>
      <Text style={styles.meta}>
        {invoice.invoiceNumber} · Due {invoice.dueDate}
      </Text>
      <Text style={styles.status}>{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</Text>
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
  name: { fontSize: 16, fontWeight: "600", color: "#111827", flexShrink: 1 },
  value: { fontSize: 13, fontWeight: "600", color: "#111827" },
  meta: { fontSize: 13, color: "#4b5563" },
  status: { fontSize: 12, color: "#6b7280", marginTop: 2 },
});
