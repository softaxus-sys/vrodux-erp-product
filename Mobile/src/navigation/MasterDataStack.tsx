import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MasterDataHomeScreen from "@/screens/master-data/MasterDataHomeScreen";
import MasterDataListScreen from "@/screens/master-data/MasterDataListScreen";
import MasterDataFormScreen from "@/screens/master-data/MasterDataFormScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { MasterDataStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<MasterDataStackParamList>();

export default function MasterDataStack() {
  const { colors } = useAppTheme();
  const options = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={options}>
      <Stack.Screen name="MasterHome" component={MasterDataHomeScreen} options={{ headerTitle: "Master Data" }} />
      <Stack.Screen name="MasterList" component={MasterDataListScreen} options={({ route }) => ({ headerTitle: route.params.title })} />
      <Stack.Screen name="MasterForm" component={MasterDataFormScreen} options={{ headerTitle: "Record" }} />
    </Stack.Navigator>
  );
}
