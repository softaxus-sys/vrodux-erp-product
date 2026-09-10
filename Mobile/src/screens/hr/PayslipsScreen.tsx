import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useMyPayslips } from "@/hooks/use-hr-self";
import type { EmployeePayslipDto } from "@/types/hr";

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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (query.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load payslips.</Text>
        <Pressable onPress={() => query.refetch()}>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(p) => p.slipId}
      contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching && page === 1}
          onRefresh={() => (page === 1 ? query.refetch() : setPage(1))}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => hasMore && !query.isFetching && setPage((p) => p + 1)}
      ListEmptyComponent={<Text style={styles.emptyText}>No payslips yet.</Text>}
      ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} /> : null}
      renderItem={({ item }) => (
        <Row
          slip={item}
          expanded={expanded === item.slipId}
          onToggle={() => setExpanded(expanded === item.slipId ? null : item.slipId)}
        />
      )}
    />
  );
}

function Row({ slip, expanded, onToggle }: { slip: EmployeePayslipDto; expanded: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onToggle}>
      <View style={styles.rowTop}>
        <Text style={styles.period}>{slip.period}</Text>
        <Text style={styles.net}>{money(slip.netSalary)}</Text>
      </View>
      <Text style={styles.status}>{slip.runStatus}</Text>
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
    </Pressable>
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorText: { color: "#dc2626" },
  retry: { color: "#2563eb", fontWeight: "600" },
  list: { paddingVertical: 4 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#6b7280" },
  footerSpinner: { paddingVertical: 16 },

  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 2 },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  period: { fontSize: 15, fontWeight: "600", color: "#111827" },
  net: { fontSize: 15, fontWeight: "700", color: "#111827" },
  status: { fontSize: 12, color: "#6b7280", textTransform: "capitalize" },

  detail: { marginTop: 8, backgroundColor: "#f9fafb", borderRadius: 8, padding: 10, gap: 4 },
  detailLine: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { fontSize: 13, color: "#4b5563" },
  detailValue: { fontSize: 13, color: "#111827" },
  detailBold: { fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 2 },
  notes: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
});
