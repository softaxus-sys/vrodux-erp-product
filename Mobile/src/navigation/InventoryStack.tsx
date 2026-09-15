import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProductsListScreen from "@/screens/inventory/ProductsListScreen";
import ProductDetailScreen from "@/screens/inventory/ProductDetailScreen";
import BarcodeScannerScreen from "@/screens/inventory/BarcodeScannerScreen";
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
    </Stack.Navigator>
  );
}
