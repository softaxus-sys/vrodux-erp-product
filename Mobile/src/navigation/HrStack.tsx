import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HrHomeScreen from "@/screens/hr/HrHomeScreen";
import AttendanceScreen from "@/screens/hr/AttendanceScreen";
import LeaveScreen from "@/screens/hr/LeaveScreen";
import PayslipsScreen from "@/screens/hr/PayslipsScreen";
import EmployeesListScreen from "@/screens/hr/EmployeesListScreen";
import EmployeeDetailScreen from "@/screens/hr/EmployeeDetailScreen";
import DepartmentsListScreen from "@/screens/hr/DepartmentsListScreen";
import JobPostingsListScreen from "@/screens/hr/JobPostingsListScreen";
import JobPostingDetailScreen from "@/screens/hr/JobPostingDetailScreen";
import ApplicantDetailScreen from "@/screens/hr/ApplicantDetailScreen";
import PerformanceReviewsListScreen from "@/screens/hr/PerformanceReviewsListScreen";
import PerformanceReviewDetailScreen from "@/screens/hr/PerformanceReviewDetailScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { HrStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<HrStackParamList>();

export default function HrStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="HrHome" component={HrHomeScreen} options={{ headerTitle: "HR" }} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ headerTitle: "Attendance" }} />
      <Stack.Screen name="Leave" component={LeaveScreen} options={{ headerTitle: "Leave" }} />
      <Stack.Screen name="Payslips" component={PayslipsScreen} options={{ headerTitle: "Payslips" }} />
      <Stack.Screen name="EmployeesList" component={EmployeesListScreen} options={{ headerTitle: "Employees" }} />
      <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} />
      <Stack.Screen name="DepartmentsList" component={DepartmentsListScreen} options={{ headerTitle: "Departments" }} />
      <Stack.Screen name="JobPostingsList" component={JobPostingsListScreen} options={{ headerTitle: "Job Postings" }} />
      <Stack.Screen name="JobPostingDetail" component={JobPostingDetailScreen} />
      <Stack.Screen name="ApplicantDetail" component={ApplicantDetailScreen} />
      <Stack.Screen name="PerformanceReviewsList" component={PerformanceReviewsListScreen} options={{ headerTitle: "Performance" }} />
      <Stack.Screen name="PerformanceReviewDetail" component={PerformanceReviewDetailScreen} />
    </Stack.Navigator>
  );
}
