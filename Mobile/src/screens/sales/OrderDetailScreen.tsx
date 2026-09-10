import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSalesOrder, useSetSalesOrderStatus } from "@/hooks/use-sales";
import { SALES_ORDERS_EDIT } from "@/lib/sales.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { SALES_ORDER_STATUS_LABELS } from "@/types/sales";
import type { SalesStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<SalesStackParamList, "OrderDetail">;

export default function OrderDetailScreen({ route, navigation }: Props) {
  const { orderId, orderNumber } = route.params;
  navigation.setOptions({ headerTitle: orderNumber });
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const canEdit = hasPermission(SALES_ORDERS_EDIT);

  const order = useSalesOrder(orderId);
  const setStatus = useSetSalesOrderStatus();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

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
        <Text style={styles.name}>{o.customerName ?? "—"}</Text>
        <Text style={styles.subtitle}>{SALES_ORDER_STATUS_LABELS[o.status] ?? o.status}</Text>
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
              {item.quantity} × {formatCompactValue(item.unitPrice, currency)} · {formatCompactValue(item.lineTotal, currency)}
            </Text>
          </View>
        ))}
      </Section>

      {canEdit && o.status === "pending" ? (
        <Section title="Actions">
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.approveButton}
              disabled={setStatus.isPending}
              onPress={() => setStatus.mutate({ id: o.id, status: "confirmed" })}
            >
              <Text style={styles.approveButtonText}>{setStatus.isPending ? "..." : "Confirm"}</Text>
            </Pressable>
            {confirmingCancel ? (
              <>
                <Pressable
                  style={styles.rejectConfirm}
                  disabled={setStatus.isPending}
                  onPress={() => {
                    setStatus.mutate({ id: o.id, status: "cancelled" });
                    setConfirmingCancel(false);
                  }}
                >
                  <Text style={styles.rejectConfirmText}>Yes, cancel</Text>
                </Pressable>
                <Pressable onPress={() => setConfirmingCancel(false)}>
                  <Text style={styles.cancelLink}>No</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.rejectButton} onPress={() => setConfirmingCancel(true)}>
                <Text style={styles.rejectButtonText}>Cancel order</Text>
              </Pressable>
            )}
          </View>
          {setStatus.isError ? <Text style={styles.errorText}>Couldn&apos;t update this order.</Text> : null}
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

  actionsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  approveButton: { backgroundColor: "#111827", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  approveButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  rejectButton: { paddingHorizontal: 8, paddingVertical: 10 },
  rejectButtonText: { color: "#dc2626", fontWeight: "600", fontSize: 13 },
  rejectConfirm: { backgroundColor: "#dc2626", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  rejectConfirmText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cancelLink: { color: "#6b7280", fontSize: 13 },
});
