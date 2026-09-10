import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePurchaseOrder, useSetPurchaseOrderStatus } from "@/hooks/use-purchase";
import { PURCHASE_ORDERS_EDIT } from "@/lib/purchase.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { PURCHASE_ORDER_STATUS_LABELS } from "@/types/purchase";
import type { PurchaseStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<PurchaseStackParamList, "PurchaseOrderDetail">;

export default function PurchaseOrderDetailScreen({ route, navigation }: Props) {
  const { orderId, orderNumber } = route.params;
  navigation.setOptions({ headerTitle: orderNumber });
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const canEdit = hasPermission(PURCHASE_ORDERS_EDIT);

  const order = usePurchaseOrder(orderId);
  const setStatus = useSetPurchaseOrderStatus();

  if (order.isLoading || !order.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (order.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn&apos;t load this order.</Text>
        <Pressable onPress={() => order.refetch()}>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      </View>
    );
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
          <Stat label="Total" value={formatCompactValue(o.total, currency)} />
          {o.expectedDate ? <Stat label="Expected" value={o.expectedDate} /> : null}
        </View>
      </View>

      {o.notes ? (
        <Section title="Notes">
          <Text style={styles.bodyText}>{o.notes}</Text>
        </Section>
      ) : null}

      <Section title={`Items (${o.items.length})`}>
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
      </Section>

      {canEdit && o.status === "draft" ? (
        <Section title="Actions">
          <Pressable
            style={styles.actionButton}
            disabled={setStatus.isPending}
            onPress={() => setStatus.mutate({ id: o.id, status: "sent" })}
          >
            <Text style={styles.actionButtonText}>{setStatus.isPending ? "Sending..." : "Send to Vendor"}</Text>
          </Pressable>
          {setStatus.isError ? <Text style={styles.errorText}>Couldn&apos;t send this order.</Text> : null}
        </Section>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorText: { color: "#dc2626" },
  retry: { color: "#2563eb", fontWeight: "600" },

  header: { gap: 4 },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 8 },
  stat: {},
  statLabel: { fontSize: 11, color: "#9ca3af", textTransform: "uppercase" },
  statValue: { fontSize: 14, fontWeight: "600", color: "#111827" },

  section: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase" },
  bodyText: { fontSize: 14, color: "#111827" },

  itemRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8, marginTop: 4, gap: 2 },
  itemDescription: { fontSize: 14, fontWeight: "600", color: "#111827" },
  itemMeta: { fontSize: 12, color: "#6b7280" },

  actionButton: { backgroundColor: "#111827", paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  actionButtonText: { color: "#fff", fontWeight: "600" },
});
