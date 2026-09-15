import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTicketsList } from "@/hooks/use-b2b";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors, type Tone } from "@/theme";
import type { SupportTicketDto } from "@/types/b2b";

const PRIORITY_TONE: Record<string, Tone> = { critical: "destructive", high: "warning", medium: "info", low: "neutral" };

export default function TicketsListScreen() {
  const list = useTicketsList();

  const statusFilters: StatusFilterOption[] = useMemo(() => {
    const present = new Set(list.items.map((t) => t.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [list.items]);

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(t) => t.id}
      renderItem={(t) => <TicketRow ticket={t} />}
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
      searchPlaceholder="Search by client or subject…"
      status={list.status}
      onStatusChange={list.setStatus}
      statusFilters={statusFilters}
      emptyIcon="life-buoy"
      emptyTitle="No support tickets here"
    />
  );
}

function TicketRow({ ticket }: { ticket: SupportTicketDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {ticket.subject}
        </Text>
        <Badge label={titleCaseStatus(ticket.status)} tone={guessStatusTone(ticket.status)} />
      </View>
      <Text style={styles.meta}>
        {ticket.ticketNumber} · {ticket.clientName}
      </Text>
      <View style={styles.rowBottom}>
        <Badge label={titleCaseStatus(ticket.priority)} tone={PRIORITY_TONE[ticket.priority.toLowerCase()] ?? "neutral"} />
        {ticket.resolution ? <Text style={styles.stat}>Resolved</Text> : null}
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
    rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
