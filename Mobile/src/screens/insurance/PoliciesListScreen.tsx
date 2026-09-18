import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { usePoliciesList } from "@/hooks/use-insurance";
import { formatCompactValue } from "@/lib/crm-helpers";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { useAuthStore } from "@/store/auth.store";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { PolicyDto } from "@/types/insurance";

export default function PoliciesListScreen() {
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const list = usePoliciesList();

  const statusFilters: StatusFilterOption[] = useMemo(() => {
    const present = new Set(list.items.map((p) => p.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [list.items]);

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(p) => p.id}
      renderItem={(p) => <PolicyRow policy={p} currency={currency} />}
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
      searchPlaceholder="Search by holder or product…"
      status={list.status}
      onStatusChange={list.setStatus}
      statusFilters={statusFilters}
      emptyIcon="file-text"
      emptyTitle="No policies here"
    />
  );
}

function PolicyRow({ policy, currency }: { policy: PolicyDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {policy.holderName}
        </Text>
        <Badge label={titleCaseStatus(policy.status)} tone={guessStatusTone(policy.status)} />
      </View>
      <Text style={styles.meta}>
        {policy.policyNumber} · {policy.productType}
        {policy.agent ? ` · ${policy.agent}` : ""}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>
          {policy.startDate} → {policy.endDate}
        </Text>
        <Text style={styles.statValue}>{formatCompactValue(policy.premium, currency)}/yr</Text>
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
    statValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
  });
}
