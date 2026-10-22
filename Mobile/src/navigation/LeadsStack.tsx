import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LeadsListScreen from "@/screens/LeadsListScreen";
import LeadDetailScreen from "@/screens/LeadDetailScreen";
import LeadFormScreen from "@/screens/crm/LeadFormScreen";
import LeadReassignScreen from "@/screens/crm/LeadReassignScreen";
import AccountsListScreen from "@/screens/crm/AccountsListScreen";
import AccountFormScreen from "@/screens/crm/AccountFormScreen";
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
      <Stack.Screen name="LeadForm" component={LeadFormScreen} options={({ route }) => ({ headerTitle: route.params?.leadId ? "Edit lead" : "New lead" })} />
      <Stack.Screen name="LeadReassign" component={LeadReassignScreen} options={{ headerTitle: "Reassign lead" }} />
      <Stack.Screen name="AccountsList" component={AccountsListScreen} options={{ headerTitle: "Accounts" }} />
      <Stack.Screen name="AccountForm" component={AccountFormScreen} options={({ route }) => ({ headerTitle: route.params?.accountId ? "Edit account" : "New account" })} />
    </Stack.Navigator>
  );
}
