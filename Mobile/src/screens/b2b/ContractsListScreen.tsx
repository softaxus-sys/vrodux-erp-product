import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useContractsList } from "@/hooks/use-b2b";
import { formatCompactValue } from "@/lib/crm-helpers";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { useAuthStore } from "@/store/auth.store";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { ServiceContractDto } from "@/types/b2b";

export default function ContractsListScreen() {
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const list = useContractsList();

  const statusFilters: StatusFilterOption[] = useMemo(() => {
    const present = new Set(list.items.map((c) => c.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [list.items]);

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(c) => c.id}
      renderItem={(c) => <ContractRow contract={c} currency={currency} />}
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
      searchPlaceholder="Search by client or title…"
      status={list.status}
      onStatusChange={list.setStatus}
      statusFilters={statusFilters}
      emptyIcon="clipboard"
      emptyTitle="No service contracts here"
    />
  );
}

function ContractRow({ contract, currency }: { contract: ServiceContractDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {contract.title}
        </Text>
        <Badge label={titleCaseStatus(contract.status)} tone={guessStatusTone(contract.status)} />
      </View>
      <Text style={styles.meta}>
        {contract.contractNumber} · {contract.clientName} · {contract.contractType}
        {contract.slaTier ? ` · ${contract.slaTier}` : ""}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>
          {contract.startDate} → {contract.endDate}
        </Text>
        <Text style={styles.statValue}>{formatCompactValue(contract.value, currency)}</Text>
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
