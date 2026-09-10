import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useInvoice, useMarkInvoicePaid, useSendInvoice } from "@/hooks/use-finance";
import { FINANCE_INVOICING_EDIT } from "@/lib/finance.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasPermission } from "@/store/auth.store";
import { INVOICE_STATUS_LABELS } from "@/types/finance";
import type { FinanceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<FinanceStackParamList, "InvoiceDetail">;

const PAYABLE = new Set(["sent", "overdue", "partial"]);

export default function InvoiceDetailScreen({ route, navigation }: Props) {
  const { invoiceId, invoiceNumber } = route.params;
  navigation.setOptions({ headerTitle: invoiceNumber });
  const canEdit = hasPermission(FINANCE_INVOICING_EDIT);

  const invoice = useInvoice(invoiceId);
  const send = useSendInvoice();
  const markPaid = useMarkInvoicePaid();

  if (invoice.isLoading || !invoice.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (invoice.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn&apos;t load this invoice.</Text>
        <Pressable onPress={() => invoice.refetch()}>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const inv = invoice.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{inv.customerName}</Text>
        <Text style={styles.subtitle}>{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</Text>
        <View style={styles.statsRow}>
          <Stat label="Subtotal" value={formatCompactValue(inv.subTotal, inv.currencyCode)} />
          <Stat label="Tax" value={formatCompactValue(inv.taxAmount, inv.currencyCode)} />
          <Stat label="Total" value={formatCompactValue(inv.total, inv.currencyCode)} />
          <Stat label="Due" value={inv.dueDate} />
        </View>
      </View>

      {inv.notes ? (
        <Section title="Notes">
          <Text style={styles.bodyText}>{inv.notes}</Text>
        </Section>
      ) : null}

      <Section title={`Items (${inv.items.length})`}>
        {inv.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemDescription} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.itemMeta}>
              {item.quantity} × {formatCompactValue(item.unitPrice, inv.currencyCode)} ·{" "}
              {formatCompactValue(item.lineTotal, inv.currencyCode)}
            </Text>
          </View>
        ))}
      </Section>

      {canEdit && (inv.status === "draft" || PAYABLE.has(inv.status)) ? (
        <Section title="Actions">
          <View style={styles.actionsRow}>
            {inv.status === "draft" ? (
              <Pressable style={styles.actionButton} disabled={send.isPending} onPress={() => send.mutate(inv.id)}>
                <Text style={styles.actionButtonText}>{send.isPending ? "..." : "Send"}</Text>
              </Pressable>
            ) : null}
            {PAYABLE.has(inv.status) ? (
              <Pressable style={styles.actionButton} disabled={markPaid.isPending} onPress={() => markPaid.mutate(inv.id)}>
                <Text style={styles.actionButtonText}>{markPaid.isPending ? "..." : "Mark Paid"}</Text>
              </Pressable>
            ) : null}
          </View>
          {send.isError || markPaid.isError ? <Text style={styles.errorText}>That didn&apos;t go through.</Text> : null}
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
  errorText: { color: "#dc2626", fontSize: 12 },
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

  actionsRow: { flexDirection: "row", gap: 10 },
  actionButton: { backgroundColor: "#111827", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  actionButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
