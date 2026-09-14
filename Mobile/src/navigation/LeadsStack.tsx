import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LeadsListScreen from "@/screens/LeadsListScreen";
import LeadDetailScreen from "@/screens/LeadDetailScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { LeadsStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<LeadsStackParamList>();

export default function LeadsStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="LeadsList" component={LeadsListScreen} options={{ headerTitle: "Leads" }} />
      <Stack.Screen name="LeadDetail" component={LeadDetailScreen} options={{ headerTitle: "Lead" }} />
    </Stack.Navigator>
  );
}
