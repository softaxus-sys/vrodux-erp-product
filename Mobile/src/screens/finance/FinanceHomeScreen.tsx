import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { FINANCE_EXPENSES_VIEW, FINANCE_INVOICING_VIEW } from "@/lib/finance.api";
import type { FinanceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<FinanceStackParamList, "FinanceHome">;

export default function FinanceHomeScreen({ navigation }: Props) {
  const canInvoices = hasPermission(FINANCE_INVOICING_VIEW);
  const canExpenses = hasPermission(FINANCE_EXPENSES_VIEW);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.menu}>
        {canInvoices ? (
          <MenuCard title="Invoices" subtitle="Send and mark invoices paid" onPress={() => navigation.navigate("InvoicesList")} />
        ) : null}
        {canExpenses ? (
          <MenuCard title="Expenses" subtitle="Submit and track expense claims" onPress={() => navigation.navigate("ExpensesList")} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function MenuCard({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.menuCard, pressed && styles.menuCardPressed]} onPress={onPress}>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  menu: { gap: 10 },
  menuCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 16 },
  menuCardPressed: { backgroundColor: "#f9fafb" },
  menuTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  menuSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
});
