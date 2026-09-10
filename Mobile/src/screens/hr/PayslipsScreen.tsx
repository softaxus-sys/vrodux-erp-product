import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMyPayslips } from "@/hooks/use-hr-self";
import type { EmployeePayslipDto } from "@/types/hr";
import { EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";

const PAGE_SIZE = 24;

function money(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PayslipsScreen() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<EmployeePayslipDto[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useMyPayslips({ page, pageSize: PAGE_SIZE });

  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (query.data.page === 1 ? query.data.items : [...prev, ...query.data.items]));
  }, [query.data]);

  const hasMore = query.data ? query.data.page < query.data.totalPages : false;

  if (query.isLoading && items.length === 0) {
    return <LoadingState />;
  }
  if (query.isError) {
    return <ErrorState message="Could not load payslips." onRetry={() => query.refetch()} />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(p) => p.slipId}
      contentContainerStyle={items.length === 0 ? undefined : styles.list}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching && page === 1}
          onRefresh={() => (page === 1 ? query.refetch() : setPage(1))}
          tintColor={colors.primary}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => hasMore && !query.isFetching && setPage((p) => p + 1)}
      ListEmptyComponent={<EmptyListState icon="file-text" title="No payslips yet" />}
      ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
      renderItem={({ item }) => (
        <Row slip={item} expanded={expanded === item.slipId} onToggle={() => setExpanded(expanded === item.slipId ? null : item.slipId)} />
      )}
    />
  );
}

function Row({ slip, expanded, onToggle }: { slip: EmployeePayslipDto; expanded: boolean; onToggle: () => void }) {
  return (
    <ListItemCard onPress={onToggle}>
      <View style={styles.rowTop}>
        <Text style={styles.period}>{slip.period}</Text>
        <Text style={styles.net}>{money(slip.netSalary)}</Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.status}>{slip.runStatus}</Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.subtleForeground} />
      </View>
      {expanded ? (
        <View style={styles.detail}>
          <DetailLine label="Basic" value={slip.basicSalary} />
          <DetailLine label="Allowances" value={slip.allowances} />
          <DetailLine label="Deductions" value={-slip.deductions} />
          <View style={styles.divider} />
          <DetailLine label="Net" value={slip.netSalary} bold />
          {slip.paidAt ? <Text style={styles.notes}>Paid {new Date(slip.paidAt).toLocaleDateString()}</Text> : null}
        </View>
      ) : null}
    </ListItemCard>
  );
}

function DetailLine({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.detailLine}>
      <Text style={[styles.detailLabel, bold && styles.detailBold]}>{label}</Text>
      <Text style={[styles.detailValue, bold && styles.detailBold]}>{money(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.md },
  footerSpinner: { paddingVertical: spacing.lg },

  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  period: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
  net: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  status: { fontSize: fontSize.sm, color: colors.mutedForeground, textTransform: "capitalize" },

  detail: { marginTop: spacing.sm, backgroundColor: colors.cardMuted, borderRadius: 8, padding: spacing.sm + 2, gap: 4 },
  detailLine: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { fontSize: fontSize.base, color: colors.foregroundSecondary },
  detailValue: { fontSize: fontSize.base, color: colors.foreground },
  detailBold: { fontWeight: fontWeight.bold },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  notes: { fontSize: fontSize.xs, color: colors.subtleForeground, marginTop: spacing.xs },
});
