import { useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useBoardColumns, useIssues, useMoveIssue } from "@/hooks/use-project-management";
import { IssueCard } from "@/components/project-management/IssueCard";
import { MovePickerModal } from "@/components/project-management/MovePickerModal";
import type { IssueSummaryDto } from "@/types/project-management";
import type { ProjectManagementStackParamList } from "@/navigation/types";
import { ErrorState, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<ProjectManagementStackParamList, "Board">;

const COLUMN_WIDTH = 260;

export default function BoardScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { projectId, projectName } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: `${projectName} · Board` });
  }, [navigation, `${projectName} · Board`]);

  const [moveFor, setMoveFor] = useState<IssueSummaryDto | null>(null);

  const columnsQuery = useBoardColumns(projectId);
  const issuesQuery = useIssues({ projectId });
  const moveIssue = useMoveIssue();

  if (columnsQuery.isLoading || issuesQuery.isLoading) {
    return <LoadingState />;
  }
  if (columnsQuery.isError || issuesQuery.isError) {
    return <ErrorState message="Couldn't load the board." onRetry={() => { columnsQuery.refetch(); issuesQuery.refetch(); }} />;
  }

  // Board deliberately excludes the "backlog" category column -- it's the Backlog screen's own
  // target, hidden from Kanban here, same as the web app.
  const columns = (columnsQuery.data ?? []).filter((c) => c.category !== "backlog").sort((a, b) => a.sortOrder - b.sortOrder);
  const issuesByColumn = new Map<string, IssueSummaryDto[]>();
  for (const issue of issuesQuery.data ?? []) {
    const list = issuesByColumn.get(issue.boardColumnId) ?? [];
    list.push(issue);
    issuesByColumn.set(issue.boardColumnId, list);
  }
  for (const list of issuesByColumn.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
        {columns.map((col) => {
          const items = issuesByColumn.get(col.id) ?? [];
          return (
            <View key={col.id} style={styles.column}>
              <View style={styles.columnHeader}>
                <Text style={styles.columnTitle} numberOfLines={1}>{col.name}</Text>
                <Text style={styles.columnCount}>{items.length}</Text>
              </View>
              <FlatList
                data={items}
                keyExtractor={(i) => i.id}
                contentContainerStyle={styles.columnList}
                renderItem={({ item }) => (
                  <IssueCard
                    issue={item}
                    onPress={() => navigation.navigate("IssueDetail", { issueId: item.id, issueKey: item.issueKey })}
                    onMove={() => setMoveFor(item)}
                  />
                )}
                ListEmptyComponent={<Text style={styles.emptyColumn}>Nothing here</Text>}
              />
            </View>
          );
        })}
      </ScrollView>

      <MovePickerModal
        visible={moveFor != null}
        title="Move to column"
        options={columns.map((c) => ({ key: c.id, label: c.name, current: c.id === moveFor?.boardColumnId }))}
        onSelect={(columnId) => {
          if (!moveFor) return;
          moveIssue.mutate({ id: moveFor.id, payload: { boardColumnId: columnId, sortOrder: 0 } });
        }}
        onClose={() => setMoveFor(null)}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    board: { padding: spacing.md, gap: spacing.md },

    column: { width: COLUMN_WIDTH, backgroundColor: colors.cardMuted, borderRadius: radius.lg, padding: spacing.sm, maxHeight: "100%" },
    columnHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
    columnTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.foreground, textTransform: "uppercase", letterSpacing: 0.3, flexShrink: 1 },
    columnCount: { fontSize: fontSize.xs, color: colors.subtleForeground, fontWeight: fontWeight.semibold },
    columnList: { gap: spacing.sm },
    emptyColumn: { fontSize: fontSize.xs, color: colors.subtleForeground, textAlign: "center", paddingVertical: spacing.md },
  });
}
