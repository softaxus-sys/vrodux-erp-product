import { createNativeStackNavigator } from "@react-navigation/native-stack";
import POSHomeScreen from "@/screens/pos/POSHomeScreen";
import POSSessionDetailScreen from "@/screens/pos/POSSessionDetailScreen";
import POSTransactionsListScreen from "@/screens/pos/POSTransactionsListScreen";
import POSTransactionDetailScreen from "@/screens/pos/POSTransactionDetailScreen";
import OpenShiftScreen from "@/screens/pos/OpenShiftScreen";
import CloseShiftScreen from "@/screens/pos/CloseShiftScreen";
import NewSaleScreen from "@/screens/pos/NewSaleScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { POSStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<POSStackParamList>();

export default function POSStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="POSHome" component={POSHomeScreen} options={{ headerTitle: "POS" }} />
      <Stack.Screen name="POSSessionDetail" component={POSSessionDetailScreen} />
      <Stack.Screen name="POSTransactionsList" component={POSTransactionsListScreen} options={{ headerTitle: "Transactions" }} />
      <Stack.Screen name="POSTransactionDetail" component={POSTransactionDetailScreen} />
      <Stack.Screen name="OpenShift" component={OpenShiftScreen} options={{ headerTitle: "Open Shift" }} />
      <Stack.Screen name="CloseShift" component={CloseShiftScreen} options={{ headerTitle: "Close Shift" }} />
      <Stack.Screen
        name="NewSale"
        component={NewSaleScreen}
        options={{ headerTitle: "New Sale", headerTintColor: "#fff", headerStyle: { backgroundColor: "#000" } }}
      />
    </Stack.Navigator>
  );
}
