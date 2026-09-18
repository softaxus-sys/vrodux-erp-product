import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HealthcareHomeScreen from "@/screens/healthcare/HealthcareHomeScreen";
import PatientsListScreen from "@/screens/healthcare/PatientsListScreen";
import AppointmentsListScreen from "@/screens/healthcare/AppointmentsListScreen";
import TreatmentPlansListScreen from "@/screens/healthcare/TreatmentPlansListScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { HealthcareStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<HealthcareStackParamList>();

export default function HealthcareStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="HealthcareHome" component={HealthcareHomeScreen} options={{ headerTitle: "Healthcare" }} />
      <Stack.Screen name="PatientsList" component={PatientsListScreen} options={{ headerTitle: "Patients" }} />
      <Stack.Screen name="AppointmentsList" component={AppointmentsListScreen} options={{ headerTitle: "Appointments" }} />
      <Stack.Screen name="TreatmentPlansList" component={TreatmentPlansListScreen} options={{ headerTitle: "Treatment Plans" }} />
    </Stack.Navigator>
  );
}
