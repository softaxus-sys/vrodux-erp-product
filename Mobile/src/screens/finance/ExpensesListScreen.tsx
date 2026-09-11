import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useExpensesPaged } from "@/hooks/use-finance";
import { formatCompactValue } from "@/lib/crm-helpers";
import { FINANCE_EXPENSES_CREATE } from "@/lib/finance.api";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_STATUS_LABELS, EXPENSE_STATUS_TONE } from "@/types/finance";
import type { ExpenseCategory, ExpenseDto } from "@/types/finance";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";
import type { FinanceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<FinanceStackParamList, "ExpensesList">;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "paid", label: "Paid" },
];

const PAGE_SIZE = 25;

export default function ExpensesListScreen({ navigation }: Props) {
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const canCreate = hasPermission(FINANCE_EXPENSES_CREATE);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ExpenseDto[]>([]);

  const query = useExpensesPaged({ page, pageSize: PAGE_SIZE, search, status });

  useEffect(() => {
    navigation.setOptions({
      headerRight: canCreate
        ? () => (
            <Pressable onPress={() => navigation.navigate("NewExpense")} hitSlop={8} style={styles.headerButtonWrap}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={styles.headerButton}>New</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, canCreate]);

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
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by title or expense #…" />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {query.isError ? (
        <ErrorState message="Couldn't load expenses." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => e.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && page === 1} onRefresh={refresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="credit-card" title="No expenses here" />}
          ListFooterComponent={
            hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null
          }
          renderItem={({ item }) => (
            <ExpenseRow
              expense={item}
              currency={currency}
              onPress={() => navigation.navigate("ExpenseDetail", { expenseId: item.id, expenseNumber: item.expenseNumber })}
            />
          )}
        />
      )}
    </View>
  );
}

function ExpenseRow({ expense, currency, onPress }: { expense: ExpenseDto; currency: string; onPress: () => void }) {
  const categoryLabel = EXPENSE_CATEGORY_LABELS[expense.category as ExpenseCategory] ?? expense.category;
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={styles.value}>{formatCompactValue(expense.amount, currency)}</Text>
      </View>
      <Text style={styles.meta}>
        {expense.expenseNumber} · {categoryLabel} · {expense.expenseDate}
      </Text>
      <Badge label={EXPENSE_STATUS_LABELS[expense.status] ?? expense.status} tone={EXPENSE_STATUS_TONE[expense.status] ?? "neutral"} />
    </ListItemCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerButtonWrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  headerButton: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  footerSpinner: { paddingVertical: spacing.lg },
  list: { paddingVertical: spacing.md },

  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
  value: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
  meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
});
