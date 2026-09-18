import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RealEstateHomeScreen from "@/screens/real-estate/RealEstateHomeScreen";
import PropertiesListScreen from "@/screens/real-estate/PropertiesListScreen";
import PropertyDetailScreen from "@/screens/real-estate/PropertyDetailScreen";
import UnitsListScreen from "@/screens/real-estate/UnitsListScreen";
import TenantsListScreen from "@/screens/real-estate/TenantsListScreen";
import TenantDetailScreen from "@/screens/real-estate/TenantDetailScreen";
import ContractsListScreen from "@/screens/real-estate/ContractsListScreen";
import ContractDetailScreen from "@/screens/real-estate/ContractDetailScreen";
import RentDueScreen from "@/screens/real-estate/RentDueScreen";
import BrokersListScreen from "@/screens/real-estate/BrokersListScreen";
import BrokerDetailScreen from "@/screens/real-estate/BrokerDetailScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { RealEstateStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<RealEstateStackParamList>();

export default function RealEstateStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="RealEstateHome" component={RealEstateHomeScreen} options={{ headerTitle: "Real Estate" }} />
      <Stack.Screen name="PropertiesList" component={PropertiesListScreen} options={{ headerTitle: "Properties" }} />
      <Stack.Screen name="PropertyDetail" component={PropertyDetailScreen} />
      <Stack.Screen name="UnitsList" component={UnitsListScreen} options={{ headerTitle: "Units" }} />
      <Stack.Screen name="TenantsList" component={TenantsListScreen} options={{ headerTitle: "Tenants" }} />
      <Stack.Screen name="TenantDetail" component={TenantDetailScreen} />
      <Stack.Screen name="ContractsList" component={ContractsListScreen} options={{ headerTitle: "Contracts" }} />
      <Stack.Screen name="ContractDetail" component={ContractDetailScreen} />
      <Stack.Screen name="RentDue" component={RentDueScreen} options={{ headerTitle: "Rent Due" }} />
      <Stack.Screen name="BrokersList" component={BrokersListScreen} options={{ headerTitle: "Brokers" }} />
      <Stack.Screen name="BrokerDetail" component={BrokerDetailScreen} />
    </Stack.Navigator>
  );
}
