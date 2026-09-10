import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProductsListScreen from "@/screens/inventory/ProductsListScreen";
import ProductDetailScreen from "@/screens/inventory/ProductDetailScreen";
import type { InventoryStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<InventoryStackParamList>();

export default function InventoryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ProductsList" component={ProductsListScreen} options={{ headerTitle: "Products" }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </Stack.Navigator>
  );
}
