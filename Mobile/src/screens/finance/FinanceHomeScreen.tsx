import { ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { FINANCE_EXPENSES_VIEW, FINANCE_INVOICING_VIEW } from "@/lib/finance.api";
import { MenuCard } from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { FinanceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<FinanceStackParamList, "FinanceHome">;

export default function FinanceHomeScreen({ navigation }: Props) {
  const canInvoices = hasPermission(FINANCE_INVOICING_VIEW);
  const canExpenses = hasPermission(FINANCE_EXPENSES_VIEW);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.menu}>
        {canInvoices ? (
          <MenuCard
            icon="file-text"
            title="Invoices"
            subtitle="Send and mark invoices paid"
            tint={colors.primary}
            onPress={() => navigation.navigate("InvoicesList")}
          />
        ) : null}
        {canExpenses ? (
          <MenuCard
            icon="credit-card"
            title="Expenses"
            subtitle="Submit and track expense claims"
            tint={colors.warning}
            onPress={() => navigation.navigate("ExpensesList")}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  menu: { gap: spacing.sm + 2 },
});
