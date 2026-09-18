import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HospitalityHomeScreen from "@/screens/hospitality/HospitalityHomeScreen";
import RoomsListScreen from "@/screens/hospitality/RoomsListScreen";
import BookingsListScreen from "@/screens/hospitality/BookingsListScreen";
import HousekeepingListScreen from "@/screens/hospitality/HousekeepingListScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { HospitalityStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<HospitalityStackParamList>();

export default function HospitalityStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="HospitalityHome" component={HospitalityHomeScreen} options={{ headerTitle: "Hospitality" }} />
      <Stack.Screen name="RoomsList" component={RoomsListScreen} options={{ headerTitle: "Rooms" }} />
      <Stack.Screen name="BookingsList" component={BookingsListScreen} options={{ headerTitle: "Bookings" }} />
      <Stack.Screen name="HousekeepingList" component={HousekeepingListScreen} options={{ headerTitle: "Housekeeping" }} />
    </Stack.Navigator>
  );
}
