import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LgHomeScreen from "@/screens/leadgen/LgHomeScreen";
import LgProspectsScreen from "@/screens/leadgen/LgProspectsScreen";
import LgProspectScreen from "@/screens/leadgen/LgProspectScreen";
import LgSearchesScreen from "@/screens/leadgen/LgSearchesScreen";
import LgNewSearchScreen from "@/screens/leadgen/LgNewSearchScreen";
import LgCampaignsScreen from "@/screens/leadgen/LgCampaignsScreen";
import LgCampaignScreen from "@/screens/leadgen/LgCampaignScreen";
import LgInboxScreen from "@/screens/leadgen/LgInboxScreen";
import LgThreadScreen from "@/screens/leadgen/LgThreadScreen";
import LgCreditsScreen from "@/screens/leadgen/LgCreditsScreen";
import LgMailboxesScreen from "@/screens/leadgen/LgMailboxesScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { LeadGenStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<LeadGenStackParamList>();

export default function LeadGenStack() {
  const { colors } = useAppTheme();
  const options = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={options}>
      <Stack.Screen name="LgHome" component={LgHomeScreen} options={{ headerTitle: "Lead Generation" }} />
      <Stack.Screen name="LgProspects" component={LgProspectsScreen} options={{ headerTitle: "Prospects" }} />
      <Stack.Screen name="LgProspect" component={LgProspectScreen} options={{ headerTitle: "Prospect" }} />
      <Stack.Screen name="LgSearches" component={LgSearchesScreen} options={{ headerTitle: "Find businesses" }} />
      <Stack.Screen name="LgNewSearch" component={LgNewSearchScreen} options={{ headerTitle: "New search" }} />
      <Stack.Screen name="LgCampaigns" component={LgCampaignsScreen} options={{ headerTitle: "Campaigns" }} />
      <Stack.Screen name="LgCampaign" component={LgCampaignScreen} options={{ headerTitle: "Campaign" }} />
      <Stack.Screen name="LgInbox" component={LgInboxScreen} options={{ headerTitle: "Inbox" }} />
      <Stack.Screen name="LgThread" component={LgThreadScreen} options={{ headerTitle: "Conversation" }} />
      <Stack.Screen name="LgCredits" component={LgCreditsScreen} options={{ headerTitle: "Credits" }} />
      <Stack.Screen name="LgMailboxes" component={LgMailboxesScreen} options={{ headerTitle: "Mailboxes" }} />
    </Stack.Navigator>
  );
}
