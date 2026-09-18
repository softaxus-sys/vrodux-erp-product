import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTransactions } from "@/hooks/use-pos";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import type { POSTransactionSummaryDto } from "@/types/pos";
import type { POSStackParamList } from "@/navigation/types";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<POSStackParamList, "POSTransactionsList">;

const PAGE_SIZE = 30;

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Sale", label: "Sales" },
  { key: "Refund", label: "Refunds" },
  { key: "Void", label: "Voided" },
];

function statusTone(status: string): "success" | "warning" | "destructive" | "info" | "neutral" {
  const s = status.toLowerCase();
  if (s.includes("void")) return "destructive";
  if (s.includes("refund")) return "warning";
  if (s.includes("hold")) return "info";
  return "success";
}

export default function POSTransactionsListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<POSTransactionSummaryDto[]>([]);

  const query = useTransactions({ page, pageSize: PAGE_SIZE, search: search.trim() || undefined, type: type === "all" ? undefined : type });

  useEffect(() => {
    setPage(1);
  }, [search, type]);

  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (query.data.page === 1 ? query.data.items : [...prev, ...query.data.items]));
  }, [query.data]);

  const hasMore = query.data ? query.data.page < query.data.totalPages : false;
  function loadMore() {
    if (hasMore && !query.isFetching) setPage((p) => p + 1);
  }

  return (
    <View style={styles.container}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by transaction # or customer…" />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
        data={TYPE_FILTERS}
        keyExtractor={(f) => f.key}
        renderItem={({ item }) => <Chip label={item.label} active={type === item.key} onPress={() => setType(item.key)} />}
      />

      {query.isError ? (
        <ErrorState message="Couldn't load transactions." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="shopping-bag" title="No transactions match" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <ListItemCard onPress={() => navigation.navigate("POSTransactionDetail", { transactionId: item.id, transactionNumber: item.transactionNumber })}>
              <View style={styles.rowTop}>
                <Text style={styles.number} numberOfLines={1}>{item.transactionNumber}</Text>
                <Badge label={item.status} tone={statusTone(item.status)} />
              </View>
              <Text style={styles.meta}>{item.customerName ?? "Walk-in"} · {item.primaryPaymentMethod} · {item.completedAt}</Text>
              <Text style={styles.amount}>{formatCompactValue(item.totalAmount, currency)}</Text>
            </ListItemCard>
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterRow: { maxHeight: 40 },
    filterRowContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },

    list: { paddingVertical: spacing.md },
    footerSpinner: { paddingVertical: spacing.lg },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    number: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    amount: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, marginTop: spacing.xs },
  });
}
