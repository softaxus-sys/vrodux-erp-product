import { createNativeStackNavigator } from "@react-navigation/native-stack";
import VisaHomeScreen from "@/screens/visa/VisaHomeScreen";
import CasesListScreen from "@/screens/visa/CasesListScreen";
import CaseDetailScreen from "@/screens/visa/CaseDetailScreen";
import RenewalsListScreen from "@/screens/visa/RenewalsListScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { VisaStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<VisaStackParamList>();

export default function VisaStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="VisaHome" component={VisaHomeScreen} options={{ headerTitle: "Visa Services" }} />
      <Stack.Screen name="CasesList" component={CasesListScreen} options={{ headerTitle: "Cases" }} />
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
      <Stack.Screen name="RenewalsList" component={RenewalsListScreen} options={{ headerTitle: "Renewals" }} />
    </Stack.Navigator>
  );
}
