import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useOrders, useOrdersSummary } from "@/hooks/use-restaurant";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/types/restaurant";
import type { OrderDto } from "@/types/restaurant";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RestaurantStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RestaurantStackParamList, "OrdersList">;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "sent", label: "Sent" },
  { key: "ready", label: "Ready" },
  { key: "served", label: "Served" },
  { key: "held", label: "Held" },
  { key: "paid", label: "Paid" },
];

export default function OrdersListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [status, setStatus] = useState("all");

  const summary = useOrdersSummary();
  const orders = useOrders(status);

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Today" value={String(summary.data.todayOrders)} />
          <SummaryTile label="Revenue" value={formatCompactValue(summary.data.todayRevenue, currency)} />
          <SummaryTile label="Tips" value={formatCompactValue(summary.data.totalTips, currency)} />
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {orders.isError ? (
        <ErrorState message="Couldn't load orders." onRetry={() => orders.refetch()} />
      ) : orders.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={orders.data ?? []}
          keyExtractor={(o) => o.id}
          contentContainerStyle={(orders.data ?? []).length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => orders.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="list" title="No orders here" />}
          renderItem={({ item }) => (
            <OrderRow
              order={item}
              currency={currency}
              onPress={() => navigation.navigate("OrderDetail", { orderId: item.id, orderNumber: item.orderNumber })}
            />
          )}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function OrderRow({ order, currency, onPress }: { order: OrderDto; currency: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name}>Table {order.tableNumber}</Text>
        <Text style={styles.value}>{formatCompactValue(order.total, currency)}</Text>
      </View>
      <Text style={styles.meta}>
        {order.orderNumber} · {order.waiter} · {order.items.length} item{order.items.length === 1 ? "" : "s"}
      </Text>
      <Badge label={ORDER_STATUS_LABELS[order.status] ?? order.status} tone={ORDER_STATUS_TONE[order.status] ?? "neutral"} />
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
    list: { paddingVertical: spacing.md },

    summaryRow: { flexDirection: "row", justifyContent: "space-around", margin: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: spacing.md },
    summaryTile: { alignItems: "center" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    summaryLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
    value: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
  });
}
