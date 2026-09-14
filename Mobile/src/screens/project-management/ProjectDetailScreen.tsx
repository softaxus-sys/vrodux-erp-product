import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useProject } from "@/hooks/use-project-management";
import type { ProjectManagementStackParamList } from "@/navigation/types";
import { ErrorState, LoadingState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<ProjectManagementStackParamList, "ProjectDetail">;

export default function ProjectDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { projectId, projectName } = route.params;
  navigation.setOptions({ headerTitle: projectName });

  const project = useProject(projectId);

  if (project.isLoading || !project.data) {
    return <LoadingState />;
  }
  if (project.isError) {
    return <ErrorState message="Couldn't load this project." onRetry={() => project.refetch()} />;
  }

  const p = project.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{p.name}</Text>
        {p.description ? <Text style={styles.description}>{p.description}</Text> : null}
        {p.leadName ? <Text style={styles.lead}>Lead: {p.leadName}</Text> : null}
      </View>

      <View style={styles.menu}>
        <MenuCard
          icon="trello"
          title="Board"
          subtitle="Kanban view by column"
          tint={colors.primary}
          onPress={() => navigation.navigate("Board", { projectId, projectName })}
        />
        <MenuCard
          icon="layers"
          title="Backlog"
          subtitle="Sprints and unplanned work"
          tint={colors.info}
          onPress={() => navigation.navigate("Backlog", { projectId, projectName })}
        />
        <MenuCard
          icon="list"
          title="Issues"
          subtitle="Every issue, searchable"
          tint={colors.mutedForeground}
          onPress={() => navigation.navigate("IssuesList", { projectId, projectName })}
        />
        <MenuCard
          icon="users"
          title="Members"
          subtitle="Who's on this project"
          tint={colors.success}
          onPress={() => navigation.navigate("ProjectMembers", { projectId, projectName })}
        />
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    header: { gap: 4 },
    name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    description: { fontSize: fontSize.md, color: colors.mutedForeground },
    lead: { fontSize: fontSize.sm, color: colors.subtleForeground, marginTop: 2 },
    menu: { gap: spacing.sm + 2 },
  });
}
