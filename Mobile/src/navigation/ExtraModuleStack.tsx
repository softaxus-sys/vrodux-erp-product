import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ModuleHomeScreen from "@/screens/modules/ModuleHomeScreen";
import ModuleListScreen from "@/screens/modules/ModuleListScreen";
import RecordDetailScreen from "@/screens/modules/RecordDetailScreen";
import LibraryDeskScreen from "@/screens/modules/LibraryDeskScreen";
import NewEventScreen from "@/screens/modules/NewEventScreen";
import VerticalFormScreen from "@/screens/verticals/VerticalFormScreen";
import { MODULES } from "@/lib/module-browser";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { ExtraStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<ExtraStackParamList>();

/** One navigator shape for every generic module; only the first screen's module differs. */
function makeStack(moduleKey: string) {
  return function ExtraModuleStack() {
    const { colors } = useAppTheme();
    const options = buildStackScreenOptions(colors);
    return (
      <Stack.Navigator screenOptions={options}>
        <Stack.Screen name="ModuleHome" component={ModuleHomeScreen} initialParams={{ moduleKey }} options={{ headerTitle: MODULES[moduleKey].title }} />
        <Stack.Screen name="ModuleList" component={ModuleListScreen} />
        <Stack.Screen name="RecordDetail" component={RecordDetailScreen} />
        <Stack.Screen name="VerticalForm" component={VerticalFormScreen} options={{ headerTitle: "New" }} />
        <Stack.Screen name="LibraryDesk" component={LibraryDeskScreen} options={{ headerTitle: "Issue / return" }} />
        <Stack.Screen name="NewEvent" component={NewEventScreen} options={{ headerTitle: "New event" }} />
      </Stack.Navigator>
    );
  };
}

export const LibraryStack = makeStack("library");
export const ManufacturingStack = makeStack("manufacturing");
export const TradeStack = makeStack("trade");
export const RecipeStack = makeStack("recipe");
export const CalendarStack = makeStack("calendar");
export const SupportStack = makeStack("support");
