import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HospitalityHomeScreen from "@/screens/hospitality/HospitalityHomeScreen";
import RoomsListScreen from "@/screens/hospitality/RoomsListScreen";
import BookingsListScreen from "@/screens/hospitality/BookingsListScreen";
import HousekeepingListScreen from "@/screens/hospitality/HousekeepingListScreen";
import NewBookingScreen from "@/screens/hospitality/NewBookingScreen";
import ToursHomeScreen from "@/screens/hospitality/ToursHomeScreen";
import TourBookingsListScreen from "@/screens/hospitality/TourBookingsListScreen";
import TourBookingDetailScreen from "@/screens/hospitality/TourBookingDetailScreen";
import TourPackagesScreen from "@/screens/hospitality/TourPackagesScreen";
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
      <Stack.Screen name="NewBooking" component={NewBookingScreen} options={{ headerTitle: "New booking" }} />
      <Stack.Screen name="ToursHome" component={ToursHomeScreen} options={{ headerTitle: "Tours" }} />
      <Stack.Screen name="TourBookingsList" component={TourBookingsListScreen} options={{ headerTitle: "Tour bookings" }} />
      <Stack.Screen name="TourBookingDetail" component={TourBookingDetailScreen} />
      <Stack.Screen name="TourPackages" component={TourPackagesScreen} options={{ headerTitle: "Packages & departures" }} />
    </Stack.Navigator>
  );
}
