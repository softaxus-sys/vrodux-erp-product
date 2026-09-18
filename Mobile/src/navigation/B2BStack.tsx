import { createNativeStackNavigator } from "@react-navigation/native-stack";
import B2BHomeScreen from "@/screens/b2b/B2BHomeScreen";
import ProposalsListScreen from "@/screens/b2b/ProposalsListScreen";
import ContractsListScreen from "@/screens/b2b/ContractsListScreen";
import TicketsListScreen from "@/screens/b2b/TicketsListScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { B2BStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<B2BStackParamList>();

export default function B2BStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="B2BHome" component={B2BHomeScreen} options={{ headerTitle: "B2B Services" }} />
      <Stack.Screen name="ProposalsList" component={ProposalsListScreen} options={{ headerTitle: "Proposals" }} />
      <Stack.Screen name="ContractsList" component={ContractsListScreen} options={{ headerTitle: "Service Contracts" }} />
      <Stack.Screen name="TicketsList" component={TicketsListScreen} options={{ headerTitle: "Support Tickets" }} />
    </Stack.Navigator>
  );
}
