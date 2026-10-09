import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useDeliveryOrders, useDeliverySummary } from "@/hooks/use-restaurant";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_TONE } from "@/types/restaurant";
import type { DeliveryOrderDto } from "@/types/restaurant";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RestaurantStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RestaurantStackParamList, "DeliveryOrdersList">;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "assigned", label: "Assigned" },
  { key: "picked_up", label: "Picked up" },
  { key: "enroute", label: "En route" },
  { key: "delivered", label: "Delivered" },
  { key: "failed", label: "Failed" },
];

export default function DeliveryOrdersListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [status, setStatus] = useState("all");

  const summary = useDeliverySummary();
  const deliveries = useDeliveryOrders(status);

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Assigned" value={String(summary.data.assigned)} />
          <SummaryTile label="En route" value={String(summary.data.enroute)} />
          <SummaryTile label="Delivered" value={String(summary.data.delivered)} />
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {deliveries.isError ? (
        <ErrorState message="Couldn't load deliveries." onRetry={() => deliveries.refetch()} />
      ) : deliveries.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={deliveries.data ?? []}
          keyExtractor={(d) => d.id}
          contentContainerStyle={(deliveries.data ?? []).length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={deliveries.isRefetching} onRefresh={() => deliveries.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="truck" title="No deliveries here" />}
          renderItem={({ item }) => (
            <DeliveryRow
              delivery={item}
              currency={currency}
              onPress={() => navigation.navigate("DeliveryOrderDetail", { deliveryOrderId: item.id, orderNumber: item.orderNumber })}
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

function DeliveryRow({ delivery, currency, onPress }: { delivery: DeliveryOrderDto; currency: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name}>{delivery.customerName ?? delivery.orderNumber}</Text>
        <Badge label={DELIVERY_STATUS_LABELS[delivery.status] ?? delivery.status} tone={DELIVERY_STATUS_TONE[delivery.status] ?? "neutral"} />
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {delivery.address}
      </Text>
      <Text style={styles.stat}>
        {delivery.driverName ?? "No rider assigned"} · {formatCompactValue(delivery.amountToCollect, currency)} to collect
      </Text>
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
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
