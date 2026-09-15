import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useKitchenSummary, useKitchenTickets, useMarkOrderReady, useUpdateKitchenItemStatus } from "@/hooks/use-restaurant";
import { RESTAURANT_KITCHEN_EDIT } from "@/lib/restaurant.api";
import { hasPermission } from "@/store/auth.store";
import {
  KITCHEN_ITEM_STATUS_LABELS,
  KITCHEN_ITEM_STATUS_TONE,
  nextKitchenItemStatus,
} from "@/types/restaurant";
import type { KitchenTicketDto, KitchenTicketItemDto } from "@/types/restaurant";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

/** The one screen in this module with real write actions -- marking a ticket item's prep status
 *  or a whole order ready doesn't touch cash or a physical drawer, so it doesn't fall under the
 *  same "belongs at the terminal" line the rest of Restaurant/POS draws. This is the kitchen's
 *  own KDS re-exposed for a phone/tablet on the pass, mirroring KitchenController's own comment
 *  ("the KDS marks orders ready without going through the order-drawer UI"). */
export default function KitchenTicketsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canEdit = hasPermission(RESTAURANT_KITCHEN_EDIT);

  const summary = useKitchenSummary();
  const tickets = useKitchenTickets();
  const updateItem = useUpdateKitchenItemStatus();
  const markReady = useMarkOrderReady();

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={tickets.isRefetching} onRefresh={() => tickets.refetch()} tintColor={colors.primary} />}
    >
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Active" value={summary.data.activeTickets} />
          <SummaryTile label="Pending" value={summary.data.pendingItems} />
          <SummaryTile label="Preparing" value={summary.data.preparingItems} />
          <SummaryTile label="Ready" value={summary.data.readyItems} />
        </View>
      ) : null}

      {tickets.isError ? (
        <ErrorState message="Couldn't load kitchen tickets." onRetry={() => tickets.refetch()} />
      ) : tickets.isLoading ? (
        <LoadingState />
      ) : (tickets.data ?? []).length === 0 ? (
        <EmptyState icon="check-circle" title="No active tickets" subtitle="The pass is clear." />
      ) : (
        (tickets.data ?? []).map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            canEdit={canEdit}
            onAdvanceItem={(item) => {
              const next = nextKitchenItemStatus(item.status);
              if (next) updateItem.mutate({ itemId: item.id, status: next });
            }}
            onMarkReady={() => markReady.mutate(ticket.id)}
            busy={updateItem.isPending || markReady.isPending}
          />
        ))
      )}
    </ScrollView>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function TicketCard({
  ticket,
  canEdit,
  busy,
  onAdvanceItem,
  onMarkReady,
}: {
  ticket: KitchenTicketDto;
  canEdit: boolean;
  busy: boolean;
  onAdvanceItem: (item: KitchenTicketItemDto) => void;
  onMarkReady: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const allReadyOrServed = ticket.items.every((i) => i.status === "ready" || i.status === "served");

  return (
    <Card variant="flat" style={styles.ticket}>
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketTitle}>
          Table {ticket.tableNumber} <Text style={styles.ticketNumber}>· {ticket.orderNumber}</Text>
        </Text>
        <Text style={styles.waitMinutes}>{ticket.waitMinutes}m</Text>
      </View>
      <Text style={styles.ticketMeta}>
        {ticket.waiter} · {ticket.covers} cover{ticket.covers === 1 ? "" : "s"}
      </Text>

      {ticket.items.map((item) => {
        const next = nextKitchenItemStatus(item.status);
        return (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.quantity}× {item.itemName}
              </Text>
              {item.modifiers ? <Text style={styles.itemModifiers}>{item.modifiers}</Text> : null}
            </View>
            <View style={styles.itemRight}>
              <Badge label={KITCHEN_ITEM_STATUS_LABELS[item.status] ?? item.status} tone={KITCHEN_ITEM_STATUS_TONE[item.status] ?? "neutral"} />
              {canEdit && next ? (
                <Button
                  label={`Mark ${KITCHEN_ITEM_STATUS_LABELS[next]}`}
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onPress={() => onAdvanceItem(item)}
                />
              ) : null}
            </View>
          </View>
        );
      })}

      {canEdit && !allReadyOrServed ? (
        <Button label="Mark whole order ready" size="sm" fullWidth style={styles.readyButton} disabled={busy} onPress={onMarkReady} />
      ) : null}
    </Card>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },

    summaryRow: { flexDirection: "row", justifyContent: "space-around", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: spacing.md, marginBottom: spacing.sm },
    summaryTile: { alignItems: "center" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    summaryLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    ticket: { gap: spacing.sm, backgroundColor: colors.cardMuted },
    ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    ticketTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    ticketNumber: { fontWeight: fontWeight.regular, color: colors.mutedForeground, fontSize: fontSize.base },
    waitMinutes: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.warning },
    ticketMeta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginBottom: spacing.xs },

    itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs },
    itemLeft: { flex: 1, gap: 2 },
    itemName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    itemModifiers: { fontSize: fontSize.sm, color: colors.mutedForeground },
    itemRight: { alignItems: "flex-end", gap: spacing.xs },

    readyButton: { marginTop: spacing.xs },
  });
}
