import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useClaimsList } from "@/hooks/use-insurance";
import { formatCompactValue } from "@/lib/crm-helpers";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { useAuthStore } from "@/store/auth.store";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { InsuranceClaimDto } from "@/types/insurance";

export default function ClaimsListScreen() {
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const list = useClaimsList();

  const statusFilters: StatusFilterOption[] = useMemo(() => {
    const present = new Set(list.items.map((c) => c.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [list.items]);

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(c) => c.id}
      renderItem={(c) => <ClaimRow claim={c} currency={currency} />}
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
      searchPlaceholder="Search by holder or policy #…"
      status={list.status}
      onStatusChange={list.setStatus}
      statusFilters={statusFilters}
      emptyIcon="alert-circle"
      emptyTitle="No claims here"
    />
  );
}

function ClaimRow({ claim, currency }: { claim: InsuranceClaimDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {claim.holderName}
        </Text>
        <Badge label={titleCaseStatus(claim.status)} tone={guessStatusTone(claim.status)} />
      </View>
      <Text style={styles.meta}>
        {claim.claimNumber} · Policy {claim.policyNumber}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>Filed {claim.claimDate}</Text>
        <Text style={styles.statValue}>
          {formatCompactValue(claim.claimAmount, currency)}
          {claim.approvedAmount > 0 ? ` (${formatCompactValue(claim.approvedAmount, currency)} approved)` : ""}
        </Text>
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
