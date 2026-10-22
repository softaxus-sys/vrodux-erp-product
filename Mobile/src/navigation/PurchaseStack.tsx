import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PurchaseHomeScreen from "@/screens/purchase/PurchaseHomeScreen";
import PurchaseOrdersListScreen from "@/screens/purchase/PurchaseOrdersListScreen";
import PurchaseOrderDetailScreen from "@/screens/purchase/PurchaseOrderDetailScreen";
import ReceiveOrderScreen from "@/screens/purchase/ReceiveOrderScreen";
import VendorsListScreen from "@/screens/purchase/VendorsListScreen";
import VendorDetailScreen from "@/screens/purchase/VendorDetailScreen";
import NewPurchaseOrderScreen from "@/screens/purchase/NewPurchaseOrderScreen";
import VendorFormScreen from "@/screens/purchase/VendorFormScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { PurchaseStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<PurchaseStackParamList>();

export default function PurchaseStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="PurchaseHome" component={PurchaseHomeScreen} options={{ headerTitle: "Purchase" }} />
      <Stack.Screen name="PurchaseOrdersList" component={PurchaseOrdersListScreen} options={{ headerTitle: "Purchase Orders" }} />
      <Stack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} />
      <Stack.Screen
        name="ReceiveOrder"
        component={ReceiveOrderScreen}
        options={{ headerTintColor: "#fff", headerStyle: { backgroundColor: "#000" } }}
      />
      <Stack.Screen name="VendorsList" component={VendorsListScreen} options={{ headerTitle: "Vendors" }} />
      <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
      <Stack.Screen name="NewPurchaseOrder" component={NewPurchaseOrderScreen} options={{ headerTitle: "New purchase order" }} />
      <Stack.Screen name="VendorForm" component={VendorFormScreen} options={({ route }) => ({ headerTitle: route.params?.vendorId ? "Edit vendor" : "New vendor" })} />
    </Stack.Navigator>
  );
}
