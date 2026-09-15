import { useEffect, useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useProjectMembers } from "@/hooks/use-project-management";
import type { ProjectMemberDto } from "@/types/project-management";
import type { ProjectManagementStackParamList } from "@/navigation/types";
import { Badge, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<ProjectManagementStackParamList, "ProjectMembers">;

/** Read-only on mobile for this pass -- add/remove/role-change are admin tasks better suited to
 *  the web app's own members modal; this is "who's on this project", a context lookup. */
export default function ProjectMembersScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { projectId, projectName } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: `${projectName} · Members` });
  }, [navigation, `${projectName} · Members`]);

  const query = useProjectMembers(projectId);

  return (
    <View style={styles.container}>
      {query.isError ? (
        <ErrorState message="Couldn't load members." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={(query.data ?? []).length === 0 ? undefined : styles.list}
          ListEmptyComponent={<EmptyListState icon="users" title="No members yet" />}
          renderItem={({ item }) => <MemberRow member={item} />}
        />
      )}
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function MemberRow({ member }: { member: ProjectMemberDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(member.userName)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{member.userName}</Text>
          {member.userEmail ? <Text style={styles.email}>{member.userEmail}</Text> : null}
        </View>
        <Badge label={member.role} tone={member.role === "owner" ? "primary" : member.role === "member" ? "info" : "neutral"} dot={false} />
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list: { paddingVertical: spacing.md },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    avatarText: { color: colors.onPrimary, fontSize: fontSize.base, fontWeight: fontWeight.bold },
    info: { flex: 1 },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    email: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
  });
}
