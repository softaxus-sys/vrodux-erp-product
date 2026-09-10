import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useMyAttendance } from "@/hooks/use-hr-self";
import { ATTENDANCE_STATUS_TONE } from "@/types/hr";
import type { AttendanceRecordDto } from "@/types/hr";
import { Badge, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";

const PAGE_SIZE = 20;

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
    return <LoadingState />;
  }
  if (query.isError) {
    return <ErrorState message="Could not load attendance history." onRetry={() => query.refetch()} />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(r) => r.id}
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
      ListEmptyComponent={<EmptyListState icon="calendar" title="No attendance recorded yet" />}
      ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
      renderItem={({ item }) => <Row record={item} />}
    />
  );
}

function Row({ record }: { record: AttendanceRecordDto }) {
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.date}>{record.date}</Text>
        <Badge label={titleCase(record.status)} tone={ATTENDANCE_STATUS_TONE[record.status] ?? "neutral"} />
      </View>
      <View style={styles.rowBottom}>
        <Text style={styles.time}>In: {record.checkIn ?? "—"}</Text>
        <Text style={styles.time}>Out: {record.checkOut ?? "—"}</Text>
        {record.lateMinutes != null && record.lateMinutes > 0 ? (
          <Text style={styles.late}>Late {record.lateMinutes}m</Text>
        ) : null}
      </View>
    </ListItemCard>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.md },
  footerSpinner: { paddingVertical: spacing.lg },

  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
  rowBottom: { flexDirection: "row", gap: spacing.lg, alignItems: "center" },
  time: { fontSize: fontSize.base, color: colors.mutedForeground },
  late: { fontSize: fontSize.sm, color: colors.destructive, fontWeight: fontWeight.semibold },
});
