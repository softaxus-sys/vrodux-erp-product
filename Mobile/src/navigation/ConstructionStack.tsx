import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ConstructionHomeScreen from "@/screens/construction/ConstructionHomeScreen";
import ProjectsListScreen from "@/screens/construction/ProjectsListScreen";
import SitesListScreen from "@/screens/construction/SitesListScreen";
import ContractorsListScreen from "@/screens/construction/ContractorsListScreen";
import BoqsListScreen from "@/screens/construction/BoqsListScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { ConstructionStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<ConstructionStackParamList>();

export default function ConstructionStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ConstructionHome" component={ConstructionHomeScreen} options={{ headerTitle: "Construction" }} />
      <Stack.Screen name="ProjectsList" component={ProjectsListScreen} options={{ headerTitle: "Projects" }} />
      <Stack.Screen name="SitesList" component={SitesListScreen} options={{ headerTitle: "Sites" }} />
      <Stack.Screen name="ContractorsList" component={ContractorsListScreen} options={{ headerTitle: "Contractors" }} />
      <Stack.Screen name="BoqsList" component={BoqsListScreen} options={{ headerTitle: "BOQs" }} />
    </Stack.Navigator>
  );
}
