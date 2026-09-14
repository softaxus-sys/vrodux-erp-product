import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { FINANCE_EXPENSES_VIEW, FINANCE_INVOICING_VIEW } from "@/lib/finance.api";
import { MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { FinanceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<FinanceStackParamList, "FinanceHome">;

export default function FinanceHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

      {/*
        No confirmed dedicated `.view` permission key exists for these two on the real backend
        (see finance.api.ts's FINANCE_ACCOUNTING_VIEW/FINANCE_BANKING_VIEW comment) -- and web's
        own actual behavior is to gate reads here by module only, not by a granular permission.
        Reaching this screen already proves `hasModuleAccess("finance")` (tab-config.ts's Finance
        tab gate), so no separate check is needed to match that same real behavior.
      */}
      <Text style={styles.sectionLabel}>Accounting</Text>
      <View style={styles.menu}>
        <MenuCard
          icon="book-open"
          title="Chart of Accounts"
          subtitle="Balances by account"
          tint={colors.info}
          onPress={() => navigation.navigate("AccountsList")}
        />
        <MenuCard
          icon="credit-card"
          title="Bank Accounts"
          subtitle="Balances and transactions"
          tint={colors.success}
          onPress={() => navigation.navigate("BankAccountsList")}
        />
        <MenuCard
          icon="pie-chart"
          title="Budgets"
          subtitle="Planned vs. actual by period"
          tint={colors.warning}
          onPress={() => navigation.navigate("BudgetsList")}
        />
        <MenuCard
          icon="book"
          title="Journals"
          subtitle="Debit/credit entries"
          tint={colors.mutedForeground}
          onPress={() => navigation.navigate("JournalsList")}
        />
        <MenuCard
          icon="percent"
          title="VAT / Tax"
          subtitle="Filing periods and returns"
          tint={colors.destructive}
          onPress={() => navigation.navigate("TaxPeriodsList")}
        />
        <MenuCard
          icon="repeat"
          title="Recurring Invoices"
          subtitle="Templates and schedules"
          tint={colors.primary}
          onPress={() => navigation.navigate("RecurringInvoicesList")}
        />
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    menu: { gap: spacing.sm + 2 },
    sectionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: -spacing.sm },
  });
}
