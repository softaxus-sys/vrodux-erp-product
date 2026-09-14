import { createNativeStackNavigator } from "@react-navigation/native-stack";
import POSHomeScreen from "@/screens/pos/POSHomeScreen";
import POSSessionDetailScreen from "@/screens/pos/POSSessionDetailScreen";
import POSTransactionsListScreen from "@/screens/pos/POSTransactionsListScreen";
import POSTransactionDetailScreen from "@/screens/pos/POSTransactionDetailScreen";
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
    </Stack.Navigator>
  );
}
