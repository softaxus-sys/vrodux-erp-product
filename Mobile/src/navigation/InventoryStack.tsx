import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProductsListScreen from "@/screens/inventory/ProductsListScreen";
import ProductDetailScreen from "@/screens/inventory/ProductDetailScreen";
import BarcodeScannerScreen from "@/screens/inventory/BarcodeScannerScreen";
import StockAdjustScreen from "@/screens/inventory/StockAdjustScreen";
import NewProductScreen from "@/screens/inventory/NewProductScreen";
import TransfersListScreen from "@/screens/inventory/TransfersListScreen";
import NewTransferScreen from "@/screens/inventory/NewTransferScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { InventoryStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<InventoryStackParamList>();

export default function InventoryStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ProductsList" component={ProductsListScreen} options={{ headerTitle: "Products" }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      {/* Dark header to match the full-bleed camera view underneath -- the only screen in the app
          that departs from the shared light chrome, deliberately, since the camera preview fills
          the screen edge-to-edge. */}
      <Stack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{ headerTitle: "Scan Barcode", headerTintColor: "#fff", headerStyle: { backgroundColor: "#000" } }}
      />
      <Stack.Screen name="StockAdjust" component={StockAdjustScreen} options={{ headerTitle: "Adjust stock" }} />
      <Stack.Screen name="NewProduct" component={NewProductScreen} options={{ headerTitle: "New product" }} />
      <Stack.Screen name="TransfersList" component={TransfersListScreen} options={{ headerTitle: "Stock transfers" }} />
      <Stack.Screen name="NewTransfer" component={NewTransferScreen} options={{ headerTitle: "New transfer" }} />
    </Stack.Navigator>
  );
}
