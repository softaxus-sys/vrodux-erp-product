import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useOrder } from "@/hooks/use-restaurant";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/types/restaurant";
import { Badge, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RestaurantStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RestaurantStackParamList, "OrderDetail">;

/** Read-only, by design -- see lib/restaurant.api.ts's top-of-file note. Everything that could
 *  change an order (add items, apply a discount, take payment, split the bill) needs the
 *  order-taking terminal's own screen; this is "what's the state of this order right now." */
export default function OrderDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { orderId, orderNumber } = route.params;
  navigation.setOptions({ headerTitle: orderNumber });
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const order = useOrder(orderId);

  if (order.isLoading || !order.data) {
    return <LoadingState />;
  }
  if (order.isError) {
    return <ErrorState message="Couldn't load this order." onRetry={() => order.refetch()} />;
  }

  const o = order.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>Table {o.tableNumber}</Text>
        <View style={styles.subtitleRow}>
          <Badge label={ORDER_STATUS_LABELS[o.status] ?? o.status} tone={ORDER_STATUS_TONE[o.status] ?? "neutral"} />
          <Text style={styles.subtitle}>
            {o.waiter} · {o.covers} cover{o.covers === 1 ? "" : "s"} · {o.orderType}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <Stat label="Subtotal" value={formatCompactValue(o.subTotal, currency)} />
          {o.discountAmount > 0 ? <Stat label="Discount" value={`-${formatCompactValue(o.discountAmount, currency)}`} /> : null}
          <Stat label="Tax" value={formatCompactValue(o.taxAmount, currency)} />
          {o.tipAmount > 0 ? <Stat label="Tip" value={formatCompactValue(o.tipAmount, currency)} /> : null}
          <Stat label="Total" value={formatCompactValue(o.total + o.tipAmount, currency)} tone="primary" />
        </View>
        {o.outstanding > 0.01 ? (
          <Text style={styles.outstanding}>Outstanding: {formatCompactValue(o.outstanding, currency)}</Text>
        ) : null}
      </View>

      {o.notes ? (
        <SectionCard title="Notes">
          <Text style={styles.bodyText}>{o.notes}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title={`Items (${o.items.length})`}>
        {o.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemTop}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.quantity}× {item.itemName}
              </Text>
              <Text style={styles.itemTotal}>{formatCompactValue(item.lineTotal, currency)}</Text>
            </View>
            {item.selectedModifiers.length > 0 ? (
              <Text style={styles.itemMeta}>{item.selectedModifiers.map((m) => m.name).join(", ")}</Text>
            ) : item.modifiers ? (
              <Text style={styles.itemMeta}>{item.modifiers}</Text>
            ) : null}
            <Text style={styles.itemStatus}>{item.status}</Text>
          </View>
        ))}
      </SectionCard>

      {o.payments.length > 0 ? (
        <SectionCard title="Payments">
          {o.payments.map((p) => (
            <DetailRow key={p.id} label={p.method} value={formatCompactValue(p.amount, currency)} />
          ))}
        </SectionCard>
      ) : null}

      {o.discounts.filter((d) => !d.isVoided).length > 0 ? (
        <SectionCard title="Discounts">
          {o.discounts
            .filter((d) => !d.isVoided)
            .map((d) => (
              <DetailRow key={d.id} label={d.reason} value={`-${formatCompactValue(d.amount, currency)}`} />
            ))}
        </SectionCard>
      ) : null}

      {o.refunds.length > 0 ? (
        <SectionCard title="Refunds">
          {o.refunds.map((r) => (
            <DetailRow key={r.id} label={r.reason} value={formatCompactValue(r.amount, currency)} />
          ))}
        </SectionCard>
      ) : null}

      {o.splits.length > 0 ? (
        <SectionCard title={`Split into ${o.splits.length}`}>
          {o.splits.map((s) => (
            <DetailRow
              key={s.id}
              label={`${s.orderNumber} · ${s.status}`}
              value={s.outstanding > 0.01 ? `${formatCompactValue(s.outstanding, currency)} due` : "Paid"}
            />
          ))}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.xs },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },
    outstanding: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.warning, marginTop: spacing.xs },

    bodyText: { fontSize: fontSize.md, color: colors.foreground },

    itemRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: 2 },
    itemTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
    itemName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    itemTotal: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    itemMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    itemStatus: { fontSize: fontSize.xs, color: colors.subtleForeground, textTransform: "uppercase", letterSpacing: 0.3 },
  });
}
