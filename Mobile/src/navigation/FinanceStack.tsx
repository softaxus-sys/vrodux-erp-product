import { createNativeStackNavigator } from "@react-navigation/native-stack";
import FinanceHomeScreen from "@/screens/finance/FinanceHomeScreen";
import InvoicesListScreen from "@/screens/finance/InvoicesListScreen";
import InvoiceDetailScreen from "@/screens/finance/InvoiceDetailScreen";
import ExpensesListScreen from "@/screens/finance/ExpensesListScreen";
import ExpenseDetailScreen from "@/screens/finance/ExpenseDetailScreen";
import NewExpenseScreen from "@/screens/finance/NewExpenseScreen";
import AccountsListScreen from "@/screens/finance/AccountsListScreen";
import BankAccountsListScreen from "@/screens/finance/BankAccountsListScreen";
import BankAccountDetailScreen from "@/screens/finance/BankAccountDetailScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { FinanceStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<FinanceStackParamList>();

export default function FinanceStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="FinanceHome" component={FinanceHomeScreen} options={{ headerTitle: "Finance" }} />
      <Stack.Screen name="InvoicesList" component={InvoicesListScreen} options={{ headerTitle: "Invoices" }} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
      <Stack.Screen name="ExpensesList" component={ExpensesListScreen} options={{ headerTitle: "Expenses" }} />
      <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
      <Stack.Screen name="NewExpense" component={NewExpenseScreen} options={{ headerTitle: "New Expense" }} />
      <Stack.Screen name="AccountsList" component={AccountsListScreen} options={{ headerTitle: "Chart of Accounts" }} />
      <Stack.Screen name="BankAccountsList" component={BankAccountsListScreen} options={{ headerTitle: "Bank Accounts" }} />
      <Stack.Screen name="BankAccountDetail" component={BankAccountDetailScreen} />
    </Stack.Navigator>
  );
}
