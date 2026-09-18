import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useEnrollmentsList } from "@/hooks/use-education";
import { formatCompactValue } from "@/lib/crm-helpers";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { useAuthStore } from "@/store/auth.store";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { EnrollmentDto } from "@/types/education";

export default function EnrollmentsListScreen() {
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const list = useEnrollmentsList();

  const statusFilters: StatusFilterOption[] = useMemo(() => {
    const present = new Set(list.items.map((e) => e.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [list.items]);

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(e) => e.id}
      renderItem={(e) => <EnrollmentRow enrollment={e} currency={currency} />}
      isLoading={list.isLoading}
      isError={list.isError}
      isFetching={list.isFetching}
      isRefetching={list.isRefetching}
      hasMore={list.hasMore}
      onRefresh={list.refresh}
      onLoadMore={list.loadMore}
      onRetry={list.refresh}
      search={list.search}
      onSearchChange={list.setSearch}
      searchPlaceholder="Search by student or course…"
      status={list.status}
      onStatusChange={list.setStatus}
      statusFilters={statusFilters}
      emptyIcon="book-open"
      emptyTitle="No enrollments here"
    />
  );
}

function EnrollmentRow({ enrollment, currency }: { enrollment: EnrollmentDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {enrollment.studentName}
        </Text>
        <Badge label={titleCaseStatus(enrollment.status)} tone={guessStatusTone(enrollment.status)} />
      </View>
      <Text style={styles.meta}>
        {enrollment.enrollmentNumber} · {enrollment.course} · {enrollment.term}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>{formatCompactValue(enrollment.feeTotal, currency)} total</Text>
        {enrollment.feeBalance > 0 ? (
          <Text style={styles.overdue}>{formatCompactValue(enrollment.feeBalance, currency)} due</Text>
        ) : (
          <Text style={styles.stat}>Paid in full</Text>
        )}
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
    rowBottom: { flexDirection: "row", justifyContent: "space-between" },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
    overdue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.destructive },
  });
}
