import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useBudgetingSummary, useBudgets, useChangeBudgetStatus } from "@/hooks/use-finance-ledger";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { BUDGET_STATUS_LABELS, BUDGET_STATUS_TONE, type BudgetDto, type BudgetStatus } from "@/types/finance-ledger";
import { Badge, Button, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

const PAGE_SIZE = 30;

const STATUS_FILTERS: { key: BudgetStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "approved", label: "Approved" },
  { key: "active", label: "Active" },
  { key: "closed", label: "Closed" },
];

/** No line-item detail endpoint exists on the backend -- the list DTO (name/period/status/
 *  variance/lineCount) is the whole record, so there is no separate detail screen here. */
export default function BudgetsListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BudgetStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BudgetDto[]>([]);

  const query = useBudgets({ page, pageSize: PAGE_SIZE, search, status: status === "all" ? undefined : status });
  const summary = useBudgetingSummary();
  const changeStatus = useChangeBudgetStatus();

  useEffect(() => {
    setPage(1);
  }, [search, status]);

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
          <SummaryTile label="Budget" value={formatCompactValue(summary.data.totalBudget, currency)} />
          <SummaryTile label="Actual" value={formatCompactValue(summary.data.totalActual, currency)} />
          <SummaryTile
            label="Variance"
            value={formatCompactValue(summary.data.overallVariance, currency)}
            tone={summary.data.overallVariance >= 0 ? "success" : "destructive"}
          />
        </View>
      ) : null}

      <SearchInput value={search} onChangeText={setSearch} placeholder="Search budgets…" />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
        data={STATUS_FILTERS}
        keyExtractor={(f) => f.key}
        renderItem={({ item }) => <Chip label={item.label} active={status === item.key} onPress={() => setStatus(item.key)} />}
      />

      {query.isError ? (
        <ErrorState message="Couldn't load budgets." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="pie-chart" title="No budgets match" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <BudgetRow
              budget={item}
              currency={currency}
              onApprove={item.status === "draft" ? () => changeStatus.mutate({ id: item.id, status: "approved" }) : undefined}
              onActivate={item.status === "approved" ? () => changeStatus.mutate({ id: item.id, status: "active" }) : undefined}
              onClose={item.status === "active" ? () => changeStatus.mutate({ id: item.id, status: "closed" }) : undefined}
              busy={changeStatus.isPending && changeStatus.variables?.id === item.id}
            />
          )}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === "success" && { color: colors.success }, tone === "destructive" && { color: colors.destructive }]}>
        {value}
      </Text>
    </View>
  );
}

function BudgetRow({
  budget,
  currency,
  onApprove,
  onActivate,
  onClose,
  busy,
}: {
  budget: BudgetDto;
  currency: string;
  onApprove?: () => void;
  onActivate?: () => void;
  onClose?: () => void;
  busy: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>{budget.name}</Text>
        <Badge label={BUDGET_STATUS_LABELS[budget.status]} tone={BUDGET_STATUS_TONE[budget.status]} />
      </View>
      <Text style={styles.meta}>{budget.period} · {budget.lineCount} {budget.lineCount === 1 ? "line" : "lines"}</Text>
      <View style={styles.figuresRow}>
        <Text style={styles.figure}>{formatCompactValue(budget.totalBudgeted, currency)} budgeted</Text>
        <Text style={styles.figure}>{formatCompactValue(budget.totalActual, currency)} actual</Text>
        <Text style={[styles.figure, budget.variance < 0 && styles.figureNegative]}>{formatCompactValue(budget.variance, currency)} var.</Text>
      </View>
      {(onApprove || onActivate || onClose) ? (
        <View style={styles.actionsRow}>
          {onApprove ? <Button label={busy ? "..." : "Approve"} size="sm" loading={busy} onPress={onApprove} /> : null}
          {onActivate ? <Button label={busy ? "..." : "Activate"} size="sm" loading={busy} onPress={onActivate} /> : null}
          {onClose ? <Button label={busy ? "..." : "Close"} size="sm" variant="outline" loading={busy} onPress={onClose} /> : null}
        </View>
      ) : null}
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

    filterRow: { maxHeight: 40 },
    filterRowContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },

    list: { paddingVertical: spacing.md },
    footerSpinner: { paddingVertical: spacing.lg },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    figuresRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xs },
    figure: { fontSize: fontSize.sm, color: colors.foregroundSecondary },
    figureNegative: { color: colors.destructive },
    actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  });
}
