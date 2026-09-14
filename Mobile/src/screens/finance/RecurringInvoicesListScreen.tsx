import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRecurringInvoices, useRecurringSummary } from "@/hooks/use-finance-ledger";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { RECURRENCE_FREQUENCY_LABELS, type RecurringInvoiceDto } from "@/types/finance-ledger";
import type { FinanceStackParamList } from "@/navigation/types";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<FinanceStackParamList, "RecurringInvoicesList">;

const PAGE_SIZE = 25;

export default function RecurringInvoicesListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<RecurringInvoiceDto[]>([]);

  const query = useRecurringInvoices({ page, pageSize: PAGE_SIZE, search, isActive: activeOnly ? true : undefined });
  const summary = useRecurringSummary();

  useEffect(() => {
    setPage(1);
  }, [search, activeOnly]);

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
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Active" value={String(summary.data.active)} />
          <SummaryTile label="Due soon" value={String(summary.data.dueSoon)} tone={summary.data.dueSoon > 0 ? "warning" : undefined} />
          <SummaryTile label="Generated" value={String(summary.data.generatedTotal)} />
        </View>
      ) : null}

      <SearchInput value={search} onChangeText={setSearch} placeholder="Search templates or customer…" />
      <View style={styles.filterRow}>
        <Chip label="Active only" active={activeOnly} onPress={() => setActiveOnly((v) => !v)} />
      </View>

      {query.isError ? (
        <ErrorState message="Couldn't load recurring invoices." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="repeat" title="No recurring invoices match" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <RecurringRow recurring={item} currency={currency} onPress={() => navigation.navigate("RecurringInvoiceDetail", { recurring: item })} />
          )}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === "warning" && { color: colors.warning }]}>{value}</Text>
    </View>
  );
}

function RecurringRow({ recurring, currency, onPress }: { recurring: RecurringInvoiceDto; currency: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>{recurring.templateName}</Text>
        <Badge label={recurring.isActive ? "Active" : "Paused"} tone={recurring.isActive ? "success" : "neutral"} />
      </View>
      <Text style={styles.meta}>{recurring.customerName} · {RECURRENCE_FREQUENCY_LABELS[recurring.frequency]}</Text>
      <View style={styles.rowBottom}>
        <Text style={styles.total}>{formatCompactValue(recurring.total, currency)}</Text>
        <Text style={styles.nextRun}>Next {recurring.nextRunDate}</Text>
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    summaryRow: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
    summaryTile: { flex: 1 },
    summaryLabel: { fontSize: fontSize.xs, color: colors.subtleForeground, textTransform: "uppercase" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground, marginTop: 2 },

    filterRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },

    list: { paddingVertical: spacing.md },
    footerSpinner: { paddingVertical: spacing.lg },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
    total: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    nextRun: { fontSize: fontSize.xs, color: colors.mutedForeground },
  });
}
