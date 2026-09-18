import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useJournals, useJournalsSummary } from "@/hooks/use-finance-ledger";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { JOURNAL_STATUS_LABELS, JOURNAL_STATUS_TONE, type JournalEntryDto, type JournalStatus } from "@/types/finance-ledger";
import type { FinanceStackParamList } from "@/navigation/types";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<FinanceStackParamList, "JournalsList">;

const PAGE_SIZE = 30;

const STATUS_FILTERS: { key: JournalStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "posted", label: "Posted" },
  { key: "reversed", label: "Reversed" },
  { key: "voided", label: "Voided" },
];

export default function JournalsListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<JournalStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<JournalEntryDto[]>([]);

  const query = useJournals({ page, pageSize: PAGE_SIZE, search, status: status === "all" ? undefined : status });
  const summary = useJournalsSummary();

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
          <SummaryTile label="Total" value={String(summary.data.total)} />
          <SummaryTile label="Draft" value={String(summary.data.draft)} />
          <SummaryTile label="Posted" value={String(summary.data.posted)} />
          <SummaryTile label="This month" value={formatCompactValue(summary.data.totalPostedValue, currency)} />
        </View>
      ) : null}

      <SearchInput value={search} onChangeText={setSearch} placeholder="Search journals…" />
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
        <ErrorState message="Couldn't load journals." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(j) => j.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="book" title="No journal entries match" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <JournalRow
              journal={item}
              currency={currency}
              onPress={() => navigation.navigate("JournalDetail", { journal: item })}
            />
          )}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function JournalRow({ journal, currency, onPress }: { journal: JournalEntryDto; currency: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.number} numberOfLines={1}>{journal.journalNumber}</Text>
        <Badge label={JOURNAL_STATUS_LABELS[journal.status]} tone={JOURNAL_STATUS_TONE[journal.status]} />
      </View>
      <Text style={styles.description} numberOfLines={1}>{journal.description}</Text>
      <View style={styles.rowBottom}>
        <Text style={styles.meta}>{journal.date} · {journal.lines.length} {journal.lines.length === 1 ? "line" : "lines"}</Text>
        <Text style={styles.amount}>{formatCompactValue(journal.totalDebit, currency)}</Text>
      </View>
      {!journal.isBalanced ? <Badge label="Unbalanced" tone="destructive" /> : null}
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    summaryRow: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
    summaryTile: { flex: 1 },
    summaryLabel: { fontSize: fontSize.xs, color: colors.subtleForeground, textTransform: "uppercase" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground, marginTop: 2 },

    filterRow: { maxHeight: 40 },
    filterRowContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },

    list: { paddingVertical: spacing.md },
    footerSpinner: { paddingVertical: spacing.lg },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    number: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    description: { fontSize: fontSize.sm, color: colors.foregroundSecondary, marginTop: 2 },
    rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    amount: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
  });
}
