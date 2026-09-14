import { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIssues } from "@/hooks/use-project-management";
import { IssueCard } from "@/components/project-management/IssueCard";
import { ISSUE_TYPE_LABELS, type IssueType } from "@/types/project-management";
import type { ProjectManagementStackParamList } from "@/navigation/types";
import { Chip, EmptyListState, ErrorState, LoadingState, SearchInput } from "@/components/ui";
import { spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<ProjectManagementStackParamList, "IssuesList">;

const TYPE_FILTERS: { key: IssueType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "story", label: ISSUE_TYPE_LABELS.story },
  { key: "task", label: ISSUE_TYPE_LABELS.task },
  { key: "bug", label: ISSUE_TYPE_LABELS.bug },
  { key: "epic", label: ISSUE_TYPE_LABELS.epic },
];

export default function IssuesListScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { projectId, projectName } = route.params;
  navigation.setOptions({ headerTitle: `${projectName} · Issues` });

  const [search, setSearch] = useState("");
  const [type, setType] = useState<IssueType | "all">("all");

  const query = useIssues({ projectId, search: search.trim() || undefined, type: type === "all" ? undefined : type });

  return (
    <View style={styles.container}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search issues…" />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
        data={TYPE_FILTERS}
        keyExtractor={(f) => f.key}
        renderItem={({ item }) => <Chip label={item.label} active={type === item.key} onPress={() => setType(item.key)} />}
      />

      {query.isError ? (
        <ErrorState message="Couldn't load issues." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyListState icon="list" title="No issues match" />}
          renderItem={({ item }) => (
            <IssueCard issue={item} onPress={() => navigation.navigate("IssueDetail", { issueId: item.id, issueKey: item.issueKey })} />
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterRow: { maxHeight: 40 },
    filterRowContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
    list: { padding: spacing.lg, gap: spacing.sm },
  });
}
