import { createNativeStackNavigator } from "@react-navigation/native-stack";
import InsuranceHomeScreen from "@/screens/insurance/InsuranceHomeScreen";
import PoliciesListScreen from "@/screens/insurance/PoliciesListScreen";
import RenewalsListScreen from "@/screens/insurance/RenewalsListScreen";
import ClaimsListScreen from "@/screens/insurance/ClaimsListScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { InsuranceStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<InsuranceStackParamList>();

export default function InsuranceStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="InsuranceHome" component={InsuranceHomeScreen} options={{ headerTitle: "Insurance" }} />
      <Stack.Screen name="PoliciesList" component={PoliciesListScreen} options={{ headerTitle: "Policies" }} />
      <Stack.Screen name="RenewalsList" component={RenewalsListScreen} options={{ headerTitle: "Renewals" }} />
      <Stack.Screen name="ClaimsList" component={ClaimsListScreen} options={{ headerTitle: "Claims" }} />
    </Stack.Navigator>
  );
}
