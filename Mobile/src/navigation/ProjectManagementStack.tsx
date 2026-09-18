import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProjectsListScreen from "@/screens/project-management/ProjectsListScreen";
import ProjectDetailScreen from "@/screens/project-management/ProjectDetailScreen";
import BoardScreen from "@/screens/project-management/BoardScreen";
import BacklogScreen from "@/screens/project-management/BacklogScreen";
import IssuesListScreen from "@/screens/project-management/IssuesListScreen";
import IssueDetailScreen from "@/screens/project-management/IssueDetailScreen";
import ProjectMembersScreen from "@/screens/project-management/ProjectMembersScreen";
import { buildStackScreenOptions, useAppTheme } from "@/theme";
import type { ProjectManagementStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<ProjectManagementStackParamList>();

export default function ProjectManagementStack() {
  const { colors } = useAppTheme();
  const stackScreenOptions = buildStackScreenOptions(colors);
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ProjectsList" component={ProjectsListScreen} options={{ headerTitle: "Projects" }} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <Stack.Screen name="Board" component={BoardScreen} />
      <Stack.Screen name="Backlog" component={BacklogScreen} />
      <Stack.Screen name="IssuesList" component={IssuesListScreen} />
      <Stack.Screen name="IssueDetail" component={IssueDetailScreen} />
      <Stack.Screen name="ProjectMembers" component={ProjectMembersScreen} />
    </Stack.Navigator>
  );
}
