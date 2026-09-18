import { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useProjects } from "@/hooks/use-project-management";
import type { ProjectSummaryDto } from "@/types/project-management";
import type { ProjectManagementStackParamList } from "@/navigation/types";
import { Badge, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<ProjectManagementStackParamList, "ProjectsList">;

/** The list is already scoped server-side to the caller's own project memberships (unless
 *  they're a super admin or hold projects.delete, the "admin bypass" -- ProjectAccessGuard.cs) --
 *  no "my projects" vs "all projects" toggle is needed here. */
export default function ProjectsListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const query = useProjects();

  return (
    <View style={styles.container}>
      {query.isError ? (
        <ErrorState message="Couldn't load projects." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={(query.data ?? []).length === 0 ? undefined : styles.list}
          ListEmptyComponent={<EmptyListState icon="trello" title="No projects yet" subtitle="You'll see projects here once you're added as a member." />}
          renderItem={({ item }) => (
            <ProjectRow project={item} onPress={() => navigation.navigate("ProjectDetail", { projectId: item.id, projectName: item.name })} />
          )}
        />
      )}
    </View>
  );
}

function ProjectRow({ project, onPress }: { project: ProjectSummaryDto; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <View style={styles.keyBadge}>
          <Text style={styles.keyText}>{project.key}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{project.name}</Text>
        {project.status === "archived" ? <Badge label="Archived" tone="neutral" /> : null}
      </View>
      {project.leadName ? <Text style={styles.lead}>Lead: {project.leadName}</Text> : null}
      <View style={styles.statsRow}>
        <Text style={styles.stat}>{project.totalIssues} issues</Text>
        <Text style={styles.stat}>{project.todoCount} to do</Text>
        <Text style={styles.stat}>{project.inProgressCount} in progress</Text>
        <Text style={styles.stat}>{project.doneCount} done</Text>
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list: { paddingVertical: spacing.md },

    rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    keyBadge: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: 2 },
    keyText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.primaryDark },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flex: 1 },
    lead: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: spacing.xs },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xs },
    stat: { fontSize: fontSize.xs, color: colors.foregroundSecondary },
  });
}
