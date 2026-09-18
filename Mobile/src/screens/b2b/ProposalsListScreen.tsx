import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useProposalsList } from "@/hooks/use-b2b";
import { formatCompactValue } from "@/lib/crm-helpers";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { useAuthStore } from "@/store/auth.store";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { ProposalDto } from "@/types/b2b";

export default function ProposalsListScreen() {
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const list = useProposalsList();

  const statusFilters: StatusFilterOption[] = useMemo(() => {
    const present = new Set(list.items.map((p) => p.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [list.items]);

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(p) => p.id}
      renderItem={(p) => <ProposalRow proposal={p} currency={currency} />}
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
      emptyIcon="file-text"
      emptyTitle="No proposals here"
    />
  );
}

function ProposalRow({ proposal, currency }: { proposal: ProposalDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {proposal.title}
        </Text>
        <Badge label={titleCaseStatus(proposal.status)} tone={guessStatusTone(proposal.status)} />
      </View>
      <Text style={styles.meta}>
        {proposal.proposalNumber} · {proposal.clientName}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>Valid until {proposal.validUntil}</Text>
        <Text style={styles.statValue}>{formatCompactValue(proposal.amount, currency)}</Text>
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
