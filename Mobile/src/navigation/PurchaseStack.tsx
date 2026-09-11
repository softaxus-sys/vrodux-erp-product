import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PurchaseHomeScreen from "@/screens/purchase/PurchaseHomeScreen";
import PurchaseOrdersListScreen from "@/screens/purchase/PurchaseOrdersListScreen";
import PurchaseOrderDetailScreen from "@/screens/purchase/PurchaseOrderDetailScreen";
import VendorsListScreen from "@/screens/purchase/VendorsListScreen";
import VendorDetailScreen from "@/screens/purchase/VendorDetailScreen";
import { stackScreenOptions } from "@/theme";
import type { PurchaseStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<PurchaseStackParamList>();

export default function PurchaseStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="PurchaseHome" component={PurchaseHomeScreen} options={{ headerTitle: "Purchase" }} />
      <Stack.Screen name="PurchaseOrdersList" component={PurchaseOrdersListScreen} options={{ headerTitle: "Purchase Orders" }} />
      <Stack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} />
      <Stack.Screen name="VendorsList" component={VendorsListScreen} options={{ headerTitle: "Vendors" }} />
      <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
    </Stack.Navigator>
  );
}
