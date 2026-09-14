import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePerformanceSummary, useReviews } from "@/hooks/use-hr-performance";
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_TONE, REVIEW_TYPE_LABELS, type PerformanceReviewDto, type ReviewStatus } from "@/types/hr-performance";
import type { HrStackParamList } from "@/navigation/types";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<HrStackParamList, "PerformanceReviewsList">;

const PAGE_SIZE = 20;

const STATUS_FILTERS: { key: ReviewStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

export default function PerformanceReviewsListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState<ReviewStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PerformanceReviewDto[]>([]);

  const query = useReviews({ page, pageSize: PAGE_SIZE, status: status === "all" ? undefined : status });
  const summary = usePerformanceSummary();

  useEffect(() => {
    setPage(1);
  }, [status]);

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
          <SummaryTile label="Total" value={String(summary.data.totalReviews)} />
          <SummaryTile label="Pending" value={String(summary.data.pending)} />
          <SummaryTile label="Overdue" value={String(summary.data.overdue)} tone={summary.data.overdue > 0 ? "destructive" : undefined} />
          <SummaryTile label="Avg rating" value={summary.data.avgRating.toFixed(1)} />
        </View>
      ) : null}

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
        <ErrorState message="Couldn't load performance reviews." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="star" title="No reviews match" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <ReviewRow review={item} onPress={() => navigation.navigate("PerformanceReviewDetail", { reviewId: item.id, employeeName: item.employeeName })} />
          )}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "destructive" }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={[styles.summaryValue, tone === "destructive" && { color: colors.destructive }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ReviewRow({ review, onPress }: { review: PerformanceReviewDto; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>{review.employeeName}</Text>
        <Badge label={REVIEW_STATUS_LABELS[review.status]} tone={REVIEW_STATUS_TONE[review.status]} />
      </View>
      <Text style={styles.meta}>
        {[review.designation, review.department].filter(Boolean).join(" · ") || "—"} · {REVIEW_TYPE_LABELS[review.reviewType]}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.due}>Due {review.dueDate}</Text>
        {review.overallRating ? <Text style={styles.rating}>{"★".repeat(review.overallRating)}</Text> : null}
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    summaryRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
    summaryTile: { minWidth: "22%" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    summaryLabel: { fontSize: fontSize.xs, color: colors.subtleForeground },

    filterRow: { maxHeight: 40 },
    filterRowContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },

    list: { paddingVertical: spacing.md },
    footerSpinner: { paddingVertical: spacing.lg },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
    due: { fontSize: fontSize.sm, color: colors.foregroundSecondary },
    rating: { fontSize: fontSize.sm, color: colors.warning },
  });
}
