import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCompleteSprint, useIssues, useMoveIssueToSprint, useSprints, useStartSprint } from "@/hooks/use-project-management";
import { IssueCard } from "@/components/project-management/IssueCard";
import { MovePickerModal } from "@/components/project-management/MovePickerModal";
import { SPRINT_STATUS_LABELS, SPRINT_STATUS_TONE, type IssueSummaryDto, type SprintDto } from "@/types/project-management";
import type { ProjectManagementStackParamList } from "@/navigation/types";
import { Badge, Button, ErrorState, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<ProjectManagementStackParamList, "Backlog">;

const BACKLOG_KEY = "__backlog__";

export default function BacklogScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { projectId, projectName } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: `${projectName} · Backlog` });
  }, [navigation, `${projectName} · Backlog`]);

  const [moveFor, setMoveFor] = useState<IssueSummaryDto | null>(null);

  const sprintsQuery = useSprints(projectId);
  const issuesQuery = useIssues({ projectId });
  const startSprint = useStartSprint();
  const completeSprint = useCompleteSprint();
  const moveToSprint = useMoveIssueToSprint();

  if (sprintsQuery.isLoading || issuesQuery.isLoading) {
    return <LoadingState />;
  }
  if (sprintsQuery.isError || issuesQuery.isError) {
    return <ErrorState message="Couldn't load the backlog." onRetry={() => { sprintsQuery.refetch(); issuesQuery.refetch(); }} />;
  }

  // Completed sprints are excluded entirely, same as the web app -- no sprint-history view exists.
  const sprints = (sprintsQuery.data ?? []).filter((s) => s.status !== "completed").sort((a, b) => a.sortOrder - b.sortOrder);
  const issuesBySprint = new Map<string, IssueSummaryDto[]>();
  for (const issue of issuesQuery.data ?? []) {
    const key = issue.sprintId ?? BACKLOG_KEY;
    const list = issuesBySprint.get(key) ?? [];
    list.push(issue);
    issuesBySprint.set(key, list);
  }
  for (const list of issuesBySprint.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  const moveOptions = [
    { key: BACKLOG_KEY, label: "Backlog", current: moveFor?.sprintId == null },
    ...sprints.map((s) => ({ key: s.id, label: s.name, current: s.id === moveFor?.sprintId })),
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.container_content}>
        {sprints.map((sprint) => (
          <SprintSection
            key={sprint.id}
            sprint={sprint}
            issues={issuesBySprint.get(sprint.id) ?? []}
            onOpenIssue={(id, key) => navigation.navigate("IssueDetail", { issueId: id, issueKey: key })}
            onMoveIssue={setMoveFor}
            onStart={() => startSprint.mutate({ projectId, id: sprint.id })}
            onComplete={() => completeSprint.mutate({ projectId, id: sprint.id })}
            busy={(startSprint.isPending && startSprint.variables?.id === sprint.id) || (completeSprint.isPending && completeSprint.variables?.id === sprint.id)}
          />
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backlog ({(issuesBySprint.get(BACKLOG_KEY) ?? []).length})</Text>
          <View style={styles.issueList}>
            {(issuesBySprint.get(BACKLOG_KEY) ?? []).map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onPress={() => navigation.navigate("IssueDetail", { issueId: issue.id, issueKey: issue.issueKey })}
                onMove={() => setMoveFor(issue)}
              />
            ))}
            {(issuesBySprint.get(BACKLOG_KEY) ?? []).length === 0 ? <Text style={styles.emptyText}>Nothing in the backlog.</Text> : null}
          </View>
        </View>
      </ScrollView>

      <MovePickerModal
        visible={moveFor != null}
        title="Move to sprint"
        options={moveOptions}
        onSelect={(key) => {
          if (!moveFor) return;
          moveToSprint.mutate({ id: moveFor.id, payload: { sprintId: key === BACKLOG_KEY ? null : key, sortOrder: 0 } });
        }}
        onClose={() => setMoveFor(null)}
      />
    </View>
  );
}

function SprintSection({
  sprint,
  issues,
  onOpenIssue,
  onMoveIssue,
  onStart,
  onComplete,
  busy,
}: {
  sprint: SprintDto;
  issues: IssueSummaryDto[];
  onOpenIssue: (id: string, key: string) => void;
  onMoveIssue: (issue: IssueSummaryDto) => void;
  onStart: () => void;
  onComplete: () => void;
  busy: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <View style={styles.sprintHeader}>
        <View style={styles.sprintTitleRow}>
          <Text style={styles.sectionTitle}>{sprint.name} ({issues.length})</Text>
          <Badge label={SPRINT_STATUS_LABELS[sprint.status]} tone={SPRINT_STATUS_TONE[sprint.status]} />
        </View>
        {sprint.goal ? <Text style={styles.sprintGoal}>{sprint.goal}</Text> : null}
        {sprint.status === "planned" ? (
          <Button label={busy ? "..." : "Start sprint"} size="sm" loading={busy} onPress={onStart} />
        ) : sprint.status === "active" ? (
          <Button label={busy ? "..." : "Complete sprint"} size="sm" variant="outline" loading={busy} onPress={onComplete} />
        ) : null}
      </View>
      <View style={styles.issueList}>
        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} onPress={() => onOpenIssue(issue.id, issue.issueKey)} onMove={() => onMoveIssue(issue)} />
        ))}
        {issues.length === 0 ? <Text style={styles.emptyText}>No issues in this sprint yet.</Text> : null}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    container_content: { padding: spacing.lg, gap: spacing.lg },

    section: { gap: spacing.sm },
    sprintHeader: { gap: spacing.xs },
    sprintTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    sprintGoal: { fontSize: fontSize.sm, color: colors.mutedForeground },

    issueList: { gap: spacing.sm },
    emptyText: { fontSize: fontSize.sm, color: colors.subtleForeground, paddingVertical: spacing.sm },
  });
}
