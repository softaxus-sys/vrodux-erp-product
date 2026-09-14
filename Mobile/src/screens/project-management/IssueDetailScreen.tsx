import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  useAddComment,
  useComments,
  useIssue,
  useMoveIssueToSprint,
  useSprints,
  useUpdateIssue,
} from "@/hooks/use-project-management";
import { MovePickerModal } from "@/components/project-management/MovePickerModal";
import { hasPermission } from "@/store/auth.store";
import { PM_ISSUES_CREATE, PM_ISSUES_EDIT } from "@/lib/project-management.api";
import {
  ISSUE_PRIORITY_LABELS,
  ISSUE_PRIORITY_TONE,
  ISSUE_TYPE_LABELS,
  type IssuePriority,
  type IssueType,
  type UpdateIssueRequest,
} from "@/types/project-management";
import type { ProjectManagementStackParamList } from "@/navigation/types";
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<ProjectManagementStackParamList, "IssueDetail">;

const TYPES: IssueType[] = ["story", "task", "bug", "epic"];
const PRIORITIES: IssuePriority[] = ["lowest", "low", "medium", "high", "highest"];

export default function IssueDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { issueId, issueKey } = route.params;
  navigation.setOptions({ headerTitle: issueKey });

  const canEdit = hasPermission(PM_ISSUES_EDIT);
  const canComment = hasPermission(PM_ISSUES_CREATE);

  const issue = useIssue(issueId);
  const updateIssue = useUpdateIssue();
  const comments = useComments(issueId);
  const addComment = useAddComment();
  const sprints = useSprints(issue.data?.projectId ?? "");
  const moveToSprint = useMoveIssueToSprint();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UpdateIssueRequest | null>(null);
  const [commentText, setCommentText] = useState("");
  const [showSprintPicker, setShowSprintPicker] = useState(false);

  if (issue.isLoading || !issue.data) {
    return <LoadingState />;
  }
  if (issue.isError) {
    return <ErrorState message="Couldn't load this issue." onRetry={() => issue.refetch()} />;
  }

  const i = issue.data;

  function beginEdit() {
    setDraft({
      title: i.title,
      description: i.description ?? "",
      type: i.type,
      priority: i.priority,
      assigneeName: i.assigneeName ?? "",
      storyPoints: i.storyPoints,
      dueDate: i.dueDate ?? "",
    });
    setEditing(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.key}>{i.issueKey}</Text>
          <Badge label={ISSUE_TYPE_LABELS[i.type]} tone="neutral" />
          <Badge label={ISSUE_PRIORITY_LABELS[i.priority]} tone={ISSUE_PRIORITY_TONE[i.priority]} />
        </View>
        {editing ? (
          <TextInput style={styles.titleInput} value={draft?.title} onChangeText={(t) => setDraft((d) => (d ? { ...d, title: t } : d))} multiline />
        ) : (
          <Text style={styles.title}>{i.title}</Text>
        )}
        {i.labels.length > 0 ? (
          <View style={styles.labelRow}>
            {i.labels.map((l) => (
              <View key={l.id} style={[styles.labelChip, { backgroundColor: `${l.color}22` }]}>
                <Text style={[styles.labelText, { color: l.color }]}>{l.name}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {editing && draft ? (
        <SectionCard title="Edit">
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={styles.textArea}
            value={draft.description ?? ""}
            onChangeText={(t) => setDraft((d) => (d ? { ...d, description: t } : d))}
            multiline
            placeholder="Describe the issue…"
            placeholderTextColor={colors.subtleForeground}
          />

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.chipRow}>
            {TYPES.map((t) => (
              <Pressable key={t} onPress={() => setDraft((d) => (d ? { ...d, type: t } : d))} style={[styles.chip, draft.type === t && styles.chipActive]}>
                <Text style={[styles.chipText, draft.type === t && styles.chipTextActive]}>{ISSUE_TYPE_LABELS[t]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Priority</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map((p) => (
              <Pressable key={p} onPress={() => setDraft((d) => (d ? { ...d, priority: p } : d))} style={[styles.chip, draft.priority === p && styles.chipActive]}>
                <Text style={[styles.chipText, draft.priority === p && styles.chipTextActive]}>{ISSUE_PRIORITY_LABELS[p]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Assignee</Text>
          <TextInput
            style={styles.input}
            value={draft.assigneeName ?? ""}
            onChangeText={(t) => setDraft((d) => (d ? { ...d, assigneeName: t } : d))}
            placeholder="Name"
            placeholderTextColor={colors.subtleForeground}
          />

          <View style={styles.row2}>
            <View style={styles.row2Col}>
              <Text style={styles.fieldLabel}>Story points</Text>
              <TextInput
                style={styles.input}
                value={draft.storyPoints != null ? String(draft.storyPoints) : ""}
                onChangeText={(t) => setDraft((d) => (d ? { ...d, storyPoints: t.trim() ? Number(t) : null } : d))}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={colors.subtleForeground}
              />
            </View>
            <View style={styles.row2Col}>
              <Text style={styles.fieldLabel}>Due date</Text>
              <TextInput
                style={styles.input}
                value={draft.dueDate ?? ""}
                onChangeText={(t) => setDraft((d) => (d ? { ...d, dueDate: t } : d))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.subtleForeground}
              />
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Button label="Cancel" variant="outline" onPress={() => setEditing(false)} style={styles.actionButton} />
            <Button
              label={updateIssue.isPending ? "..." : "Save"}
              loading={updateIssue.isPending}
              onPress={() => draft && updateIssue.mutate({ id: i.id, payload: draft }, { onSuccess: () => setEditing(false) })}
              style={styles.actionButton}
            />
          </View>
        </SectionCard>
      ) : (
        <SectionCard title="Details" right={canEdit ? <Pressable onPress={beginEdit}><Feather name="edit-2" size={16} color={colors.primary} /></Pressable> : undefined}>
          {i.description ? <Text style={styles.description}>{i.description}</Text> : null}
          <DetailRow label="Assignee" value={i.assigneeName ?? "Unassigned"} />
          <DetailRow label="Reporter" value={i.reporterName} />
          <DetailRow label="Column" value={i.boardColumnName} />
          {i.storyPoints != null ? <DetailRow label="Story points" value={String(i.storyPoints)} /> : null}
          {i.dueDate ? <DetailRow label="Due date" value={i.dueDate} /> : null}
          {i.epicTitle ? <DetailRow label="Epic" value={`${i.epicKey} · ${i.epicTitle}`} /> : null}
        </SectionCard>
      )}

      <SectionCard title="Sprint">
        <View style={styles.sprintRow}>
          <Text style={styles.sprintText}>{i.sprintName ?? "Backlog (no sprint)"}</Text>
          {canEdit ? (
            <Pressable onPress={() => setShowSprintPicker(true)}>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          ) : null}
        </View>
      </SectionCard>

      <SectionCard title="Info">
        <DetailRow label="Created" value={i.createdAt} />
        {i.updatedAt ? <DetailRow label="Updated" value={i.updatedAt} /> : null}
        {i.resolvedAt ? <DetailRow label="Resolved" value={i.resolvedAt} /> : null}
      </SectionCard>

      <SectionCard title={`Comments (${comments.data?.length ?? i.commentCount})`}>
        {comments.isLoading ? (
          <LoadingState size="small" />
        ) : (
          (comments.data ?? []).map((c) => (
            <View key={c.id} style={styles.comment}>
              <Text style={styles.commentAuthor}>{c.authorName}</Text>
              <Text style={styles.commentBody}>{c.body}</Text>
              <Text style={styles.commentDate}>{c.createdAt}</Text>
            </View>
          ))
        )}
        {canComment ? (
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment…"
              placeholderTextColor={colors.subtleForeground}
              multiline
            />
            <Button
              label={addComment.isPending ? "..." : "Send"}
              size="sm"
              loading={addComment.isPending}
              disabled={!commentText.trim()}
              onPress={() => addComment.mutate({ issueId: i.id, body: commentText.trim() }, { onSuccess: () => setCommentText("") })}
            />
          </View>
        ) : null}
      </SectionCard>

      <MovePickerModal
        visible={showSprintPicker}
        title="Move to sprint"
        options={[
          { key: "__backlog__", label: "Backlog", current: i.sprintId == null },
          ...(sprints.data ?? []).filter((s) => s.status !== "completed").map((s) => ({ key: s.id, label: s.name, current: s.id === i.sprintId })),
        ]}
        onSelect={(key) => moveToSprint.mutate({ id: i.id, payload: { sprintId: key === "__backlog__" ? null : key, sortOrder: 0 } })}
        onClose={() => setShowSprintPicker(false)}
      />
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.sm },
    headerTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    key: { fontSize: fontSize.sm, color: colors.mutedForeground, fontWeight: fontWeight.semibold },
    title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    titleInput: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm },
    labelRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    labelChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
    labelText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

    description: { fontSize: fontSize.base, color: colors.foreground, lineHeight: 20 },

    fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.mutedForeground, marginTop: spacing.sm },
    textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, minHeight: 70, fontSize: fontSize.base, color: colors.foreground, marginTop: 4, textAlignVertical: "top" },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: fontSize.base, color: colors.foreground, marginTop: 4 },
    row2: { flexDirection: "row", gap: spacing.md },
    row2Col: { flex: 1 },

    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: 4 },
    chip: { paddingHorizontal: spacing.sm + 2, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.muted },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: fontSize.sm, color: colors.foregroundSecondary },
    chipTextActive: { color: colors.onPrimary, fontWeight: fontWeight.semibold },

    actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    actionButton: { flex: 1 },

    sprintRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sprintText: { fontSize: fontSize.base, color: colors.foreground },
    changeLink: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },

    comment: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingVertical: spacing.sm, gap: 2 },
    commentAuthor: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
    commentBody: { fontSize: fontSize.base, color: colors.foreground },
    commentDate: { fontSize: fontSize.xs, color: colors.subtleForeground },
    commentInputRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end", marginTop: spacing.sm },
    commentInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: fontSize.base, color: colors.foreground, minHeight: 40 },
  });
}
