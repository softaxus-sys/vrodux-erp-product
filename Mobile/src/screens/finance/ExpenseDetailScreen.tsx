import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useExpense } from "@/hooks/use-finance";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_STATUS_LABELS } from "@/types/finance";
import type { ExpenseCategory } from "@/types/finance";
import type { FinanceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<FinanceStackParamList, "ExpenseDetail">;

export default function ExpenseDetailScreen({ route, navigation }: Props) {
  const { expenseId, expenseNumber } = route.params;
  navigation.setOptions({ headerTitle: expenseNumber });
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const expense = useExpense(expenseId);

  if (expense.isLoading || !expense.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (expense.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn&apos;t load this expense.</Text>
        <Pressable onPress={() => expense.refetch()}>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const e = expense.data;
  const categoryLabel = EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{e.title}</Text>
        <Text style={styles.subtitle}>{EXPENSE_STATUS_LABELS[e.status] ?? e.status}</Text>
        <View style={styles.statsRow}>
          <Stat label="Amount" value={formatCompactValue(e.amount, currency)} />
          <Stat label="Category" value={categoryLabel} />
          <Stat label="Date" value={e.expenseDate} />
        </View>
      </View>

      <Section title="Details">
        <Detail label="Paid by" value={e.paidBy ?? "—"} />
        <Detail label="Payment method" value={e.paymentMethod ?? "—"} />
        <Detail label="Reference" value={e.reference ?? "—"} />
        <Detail label="Receipt" value={e.hasReceipt ? e.receiptFileName ?? "Attached" : "None"} />
      </Section>

      {e.notes ? (
        <Section title="Notes">
          <Text style={styles.bodyText}>{e.notes}</Text>
        </Section>
      ) : null}

      {e.status === "approved" || e.status === "rejected" || e.status === "paid" ? (
        <Section title="Approval">
          <Detail label="Decided at" value={e.approvedAt ? new Date(e.approvedAt).toLocaleString() : "—"} />
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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

  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  detailLabel: { fontSize: 13, color: "#6b7280" },
  detailValue: { fontSize: 13, fontWeight: "600", color: "#111827", flexShrink: 1, textAlign: "right" },
});
