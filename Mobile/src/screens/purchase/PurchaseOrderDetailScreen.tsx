import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePurchaseOrder, useSetPurchaseOrderStatus } from "@/hooks/use-purchase";
import { PURCHASE_ORDERS_EDIT } from "@/lib/purchase.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { PURCHASE_ORDER_STATUS_LABELS } from "@/types/purchase";
import type { PurchaseStackParamList } from "@/navigation/types";
import { Button, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";

type Props = NativeStackScreenProps<PurchaseStackParamList, "PurchaseOrderDetail">;

export default function PurchaseOrderDetailScreen({ route, navigation }: Props) {
  const { orderId, orderNumber } = route.params;
  navigation.setOptions({ headerTitle: orderNumber });
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const canEdit = hasPermission(PURCHASE_ORDERS_EDIT);

  const order = usePurchaseOrder(orderId);
  const setStatus = useSetPurchaseOrderStatus();

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
        <Text style={styles.name}>{o.vendorName}</Text>
        <Text style={styles.subtitle}>{PURCHASE_ORDER_STATUS_LABELS[o.status] ?? o.status}</Text>
        <View style={styles.statsRow}>
          <Stat label="Subtotal" value={formatCompactValue(o.subTotal, currency)} />
          <Stat label="Tax" value={formatCompactValue(o.taxAmount, currency)} />
          <Stat label="Total" value={formatCompactValue(o.total, currency)} tone="primary" />
          {o.expectedDate ? <Stat label="Expected" value={o.expectedDate} /> : null}
        </View>
      </View>

      {o.notes ? (
        <SectionCard title="Notes">
          <Text style={styles.bodyText}>{o.notes}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title={`Items (${o.items.length})`}>
        {o.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemDescription} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.itemMeta}>
              {item.quantity} × {formatCompactValue(item.unitCost, currency)} · {formatCompactValue(item.lineTotal, currency)}
            </Text>
          </View>
        ))}
      </SectionCard>

      {canEdit && o.status === "draft" ? (
        <SectionCard title="Actions">
          <Button
            label={setStatus.isPending ? "Sending..." : "Send to Vendor"}
            icon="send"
            disabled={setStatus.isPending}
            onPress={() => setStatus.mutate({ id: o.id, status: "sent" })}
            fullWidth
          />
          {setStatus.isError ? <Text style={styles.errorText}>Couldn&apos;t send this order.</Text> : null}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  errorText: { color: colors.destructive, fontSize: fontSize.sm },

  header: { gap: spacing.xs },
  name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
  subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },

  bodyText: { fontSize: fontSize.md, color: colors.foreground },

  itemRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: spacing.xs },
  itemDescription: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
  itemMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },
});
