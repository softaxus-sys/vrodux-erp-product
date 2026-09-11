import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useExpense } from "@/hooks/use-finance";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_STATUS_LABELS } from "@/types/finance";
import type { ExpenseCategory } from "@/types/finance";
import { DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";
import type { FinanceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<FinanceStackParamList, "ExpenseDetail">;

export default function ExpenseDetailScreen({ route, navigation }: Props) {
  const { expenseId, expenseNumber } = route.params;
  navigation.setOptions({ headerTitle: expenseNumber });
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const expense = useExpense(expenseId);

  if (expense.isLoading || !expense.data) {
    return <LoadingState />;
  }
  if (expense.isError) {
    return <ErrorState message="Couldn't load this expense." onRetry={() => expense.refetch()} />;
  }

  const e = expense.data;
  const categoryLabel = EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{e.title}</Text>
        <Text style={styles.subtitle}>{EXPENSE_STATUS_LABELS[e.status] ?? e.status}</Text>
        <View style={styles.statsRow}>
          <Stat label="Amount" value={formatCompactValue(e.amount, currency)} tone="primary" />
          <Stat label="Category" value={categoryLabel} />
          <Stat label="Date" value={e.expenseDate} />
        </View>
      </View>

      <SectionCard title="Details">
        <DetailRow label="Paid by" value={e.paidBy ?? "—"} />
        <DetailRow label="Payment method" value={e.paymentMethod ?? "—"} />
        <DetailRow label="Reference" value={e.reference ?? "—"} />
        <DetailRow label="Receipt" value={e.hasReceipt ? e.receiptFileName ?? "Attached" : "None"} />
      </SectionCard>

      {e.notes ? (
        <SectionCard title="Notes">
          <Text style={styles.bodyText}>{e.notes}</Text>
        </SectionCard>
      ) : null}

      {e.status === "approved" || e.status === "rejected" || e.status === "paid" ? (
        <SectionCard title="Approval">
          <DetailRow label="Decided at" value={e.approvedAt ? new Date(e.approvedAt).toLocaleString() : "—"} />
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },

  header: { gap: spacing.xs },
  name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
  subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },

  bodyText: { fontSize: fontSize.md, color: colors.foreground },
});
