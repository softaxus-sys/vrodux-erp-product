import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTreatmentPlansList } from "@/hooks/use-healthcare";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { TreatmentPlanDto } from "@/types/healthcare";

export default function TreatmentPlansListScreen() {
  const list = useTreatmentPlansList();

  const statusFilters: StatusFilterOption[] = useMemo(() => {
    const present = new Set(list.items.map((p) => p.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [list.items]);

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(p) => p.id}
      renderItem={(p) => <PlanRow plan={p} />}
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
      searchPlaceholder="Search by patient or diagnosis…"
      status={list.status}
      onStatusChange={list.setStatus}
      statusFilters={statusFilters}
      emptyIcon="activity"
      emptyTitle="No treatment plans here"
    />
  );
}

function PlanRow({ plan }: { plan: TreatmentPlanDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {plan.patientName}
        </Text>
        <Badge label={titleCaseStatus(plan.status)} tone={guessStatusTone(plan.status)} />
      </View>
      <Text style={styles.meta} numberOfLines={2}>
        {plan.diagnosis} · Dr. {plan.doctor}
      </Text>
      <Text style={styles.stat}>
        Started {plan.startDate}
        {plan.followUpDate ? ` · Follow-up ${plan.followUpDate}` : ""}
      </Text>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
