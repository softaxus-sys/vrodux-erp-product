import { createNativeStackNavigator } from "@react-navigation/native-stack";
import EducationHomeScreen from "@/screens/education/EducationHomeScreen";
import AdmissionsListScreen from "@/screens/education/AdmissionsListScreen";
import StudentsListScreen from "@/screens/education/StudentsListScreen";
import EnrollmentsListScreen from "@/screens/education/EnrollmentsListScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { EducationStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<EducationStackParamList>();

export default function EducationStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="EducationHome" component={EducationHomeScreen} options={{ headerTitle: "Education" }} />
      <Stack.Screen name="AdmissionsList" component={AdmissionsListScreen} options={{ headerTitle: "Admissions" }} />
      <Stack.Screen name="StudentsList" component={StudentsListScreen} options={{ headerTitle: "Students" }} />
      <Stack.Screen name="EnrollmentsList" component={EnrollmentsListScreen} options={{ headerTitle: "Enrollments" }} />
    </Stack.Navigator>
  );
}
