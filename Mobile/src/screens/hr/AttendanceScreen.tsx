import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useMyAttendance } from "@/hooks/use-hr-self";
import type { AttendanceRecordDto } from "@/types/hr";

const PAGE_SIZE = 20;

export default function AttendanceScreen() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AttendanceRecordDto[]>([]);

  const query = useMyAttendance({ page, pageSize: PAGE_SIZE });

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
        <Text style={styles.errorText}>Could not load attendance history.</Text>
        <Pressable onPress={() => query.refetch()}>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(r) => r.id}
      contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching && page === 1}
          onRefresh={() => (page === 1 ? query.refetch() : setPage(1))}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => hasMore && !query.isFetching && setPage((p) => p + 1)}
      ListEmptyComponent={<Text style={styles.emptyText}>No attendance recorded yet.</Text>}
      ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} /> : null}
      renderItem={({ item }) => <Row record={item} />}
    />
  );
}

function Row({ record }: { record: AttendanceRecordDto }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.date}>{record.date}</Text>
        <StatusBadge status={record.status} />
      </View>
      <View style={styles.rowBottom}>
        <Text style={styles.time}>In: {record.checkIn ?? "—"}</Text>
        <Text style={styles.time}>Out: {record.checkOut ?? "—"}</Text>
        {record.lateMinutes != null && record.lateMinutes > 0 ? (
          <Text style={styles.late}>Late {record.lateMinutes}m</Text>
        ) : null}
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{status.replace("_", " ")}</Text>
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

  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 4 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { fontSize: 15, fontWeight: "600", color: "#111827" },
  rowBottom: { flexDirection: "row", gap: 16, alignItems: "center" },
  time: { fontSize: 13, color: "#4b5563" },
  late: { fontSize: 12, color: "#dc2626", fontWeight: "600" },
  badge: { backgroundColor: "#e5e7eb", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11, color: "#374151", textTransform: "capitalize" },
});
