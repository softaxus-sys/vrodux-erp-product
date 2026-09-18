import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ReportsHubScreen from "@/screens/reports/ReportsHubScreen";
import ReportRunnerScreen from "@/screens/reports/ReportRunnerScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { ReportsStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export default function ReportsStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ReportsHub" component={ReportsHubScreen} options={{ headerTitle: "Reports" }} />
      <Stack.Screen name="ReportRunner" component={ReportRunnerScreen} />
    </Stack.Navigator>
  );
}
