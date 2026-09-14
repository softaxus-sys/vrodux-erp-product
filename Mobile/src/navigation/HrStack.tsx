import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HrHomeScreen from "@/screens/hr/HrHomeScreen";
import AttendanceScreen from "@/screens/hr/AttendanceScreen";
import LeaveScreen from "@/screens/hr/LeaveScreen";
import PayslipsScreen from "@/screens/hr/PayslipsScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { HrStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<HrStackParamList>();

export default function HrStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="HrHome" component={HrHomeScreen} options={{ headerTitle: "My HR" }} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ headerTitle: "Attendance" }} />
      <Stack.Screen name="Leave" component={LeaveScreen} options={{ headerTitle: "Leave" }} />
      <Stack.Screen name="Payslips" component={PayslipsScreen} options={{ headerTitle: "Payslips" }} />
    </Stack.Navigator>
  );
}
