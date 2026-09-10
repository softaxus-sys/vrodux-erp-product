import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SalesHomeScreen from "@/screens/sales/SalesHomeScreen";
import OrdersListScreen from "@/screens/sales/OrdersListScreen";
import OrderDetailScreen from "@/screens/sales/OrderDetailScreen";
import QuotationsListScreen from "@/screens/sales/QuotationsListScreen";
import QuotationDetailScreen from "@/screens/sales/QuotationDetailScreen";
import type { SalesStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<SalesStackParamList>();

export default function SalesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SalesHome" component={SalesHomeScreen} options={{ headerTitle: "Sales" }} />
      <Stack.Screen name="OrdersList" component={OrdersListScreen} options={{ headerTitle: "Sales Orders" }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="QuotationsList" component={QuotationsListScreen} options={{ headerTitle: "Quotations" }} />
      <Stack.Screen name="QuotationDetail" component={QuotationDetailScreen} />
    </Stack.Navigator>
  );
}
