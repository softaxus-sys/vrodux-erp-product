import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DealsListScreen from "@/screens/DealsListScreen";
import DealDetailScreen from "@/screens/DealDetailScreen";
import { stackScreenOptions } from "@/theme";
import type { DealsStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<DealsStackParamList>();

export default function DealsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="DealsList" component={DealsListScreen} options={{ headerTitle: "Pipeline" }} />
      <Stack.Screen name="DealDetail" component={DealDetailScreen} options={{ headerTitle: "Opportunity" }} />
    </Stack.Navigator>
  );
}
