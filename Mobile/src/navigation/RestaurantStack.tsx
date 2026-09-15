import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RestaurantHomeScreen from "@/screens/restaurant/RestaurantHomeScreen";
import TablesListScreen from "@/screens/restaurant/TablesListScreen";
import OrdersListScreen from "@/screens/restaurant/OrdersListScreen";
import OrderDetailScreen from "@/screens/restaurant/OrderDetailScreen";
import KitchenTicketsScreen from "@/screens/restaurant/KitchenTicketsScreen";
import ReservationsListScreen from "@/screens/restaurant/ReservationsListScreen";
import WaitlistScreen from "@/screens/restaurant/WaitlistScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { RestaurantStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<RestaurantStackParamList>();

export default function RestaurantStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="RestaurantHome" component={RestaurantHomeScreen} options={{ headerTitle: "Restaurant" }} />
      <Stack.Screen name="TablesList" component={TablesListScreen} options={{ headerTitle: "Tables" }} />
      <Stack.Screen name="OrdersList" component={OrdersListScreen} options={{ headerTitle: "Live Orders" }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="KitchenTickets" component={KitchenTicketsScreen} options={{ headerTitle: "Kitchen" }} />
      <Stack.Screen name="ReservationsList" component={ReservationsListScreen} options={{ headerTitle: "Reservations" }} />
      <Stack.Screen name="WaitlistList" component={WaitlistScreen} options={{ headerTitle: "Waitlist" }} />
    </Stack.Navigator>
  );
}
