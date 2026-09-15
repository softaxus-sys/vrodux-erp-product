import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCompleteReview, useReview, useStartReview, useUpdateGoal } from "@/hooks/use-hr-performance";
import {
  GOAL_STATUS_LABELS,
  GOAL_STATUS_TONE,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_TONE,
  REVIEW_TYPE_LABELS,
  type CompleteReviewPayload,
  type GoalStatus,
  type PerformanceGoalDto,
  type Rating,
} from "@/types/hr-performance";
import type { HrStackParamList } from "@/navigation/types";
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<HrStackParamList, "PerformanceReviewDetail">;

const RATING_CATEGORIES: { key: keyof CompleteReviewPayload; label: string }[] = [
  { key: "overallRating", label: "Overall" },
  { key: "technicalRating", label: "Technical" },
  { key: "communicationRating", label: "Communication" },
  { key: "teamworkRating", label: "Teamwork" },
  { key: "leadershipRating", label: "Leadership" },
];

function StarPicker({ value, onChange, readOnly }: { value?: number | null; onChange?: (v: Rating) => void; readOnly?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={readOnly} onPress={() => onChange?.(n as Rating)} hitSlop={4}>
          <Feather name="star" size={20} color={value && n <= value ? colors.warning : colors.border} />
        </Pressable>
      ))}
    </View>
  );
}

export default function PerformanceReviewDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { reviewId, employeeName } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: employeeName });
  }, [navigation, employeeName]);

  const review = useReview(reviewId);
  const startReview = useStartReview();
  const completeReview = useCompleteReview();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CompleteReviewPayload>({});

  if (review.isLoading || !review.data) {
    return <LoadingState />;
  }
  if (review.isError) {
    return <ErrorState message="Couldn't load this review." onRetry={() => review.refetch()} />;
  }

  const r = review.data;

  function beginComplete() {
    setDraft({
      overallRating: r.overallRating ?? undefined,
      technicalRating: r.technicalRating ?? undefined,
      communicationRating: r.communicationRating ?? undefined,
      teamworkRating: r.teamworkRating ?? undefined,
      leadershipRating: r.leadershipRating ?? undefined,
      strengths: r.strengths ?? "",
      improvements: r.improvements ?? "",
    });
    setEditing(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.name}>{r.employeeName}</Text>
          <Badge label={REVIEW_STATUS_LABELS[r.status]} tone={REVIEW_STATUS_TONE[r.status]} />
        </View>
        <Text style={styles.subtitle}>{[r.designation, r.department].filter(Boolean).join(" · ") || "—"}</Text>
      </View>

      <SectionCard title="Review">
        <DetailRow label="Period" value={r.reviewPeriod} />
        <DetailRow label="Type" value={REVIEW_TYPE_LABELS[r.reviewType]} />
        <DetailRow label="Due date" value={r.dueDate} />
        <DetailRow label="Reviewed by" value={r.reviewedBy} />
        {r.completedDate ? <DetailRow label="Completed" value={r.completedDate} /> : null}
      </SectionCard>

      {r.status === "pending" ? (
        <Button
          label={startReview.isPending ? "..." : "Start review"}
          icon="play"
          loading={startReview.isPending}
          onPress={() => startReview.mutate(r.id)}
        />
      ) : null}

      {r.status === "in_progress" && !editing ? (
        <Button label="Complete review" icon="check-circle" onPress={beginComplete} />
      ) : null}

      {editing ? (
        <SectionCard title="Ratings">
          {RATING_CATEGORIES.map((c) => (
            <View key={c.key} style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>{c.label}</Text>
              <StarPicker value={draft[c.key] as number | undefined} onChange={(v) => setDraft((d) => ({ ...d, [c.key]: v }))} />
            </View>
          ))}
          <Text style={styles.fieldLabel}>Strengths</Text>
          <TextInput
            style={styles.textArea}
            value={draft.strengths}
            onChangeText={(t) => setDraft((d) => ({ ...d, strengths: t }))}
            multiline
            placeholder="What went well…"
            placeholderTextColor={colors.subtleForeground}
          />
          <Text style={styles.fieldLabel}>Areas to improve</Text>
          <TextInput
            style={styles.textArea}
            value={draft.improvements}
            onChangeText={(t) => setDraft((d) => ({ ...d, improvements: t }))}
            multiline
            placeholder="What to work on…"
            placeholderTextColor={colors.subtleForeground}
          />
          <View style={styles.actionsRow}>
            <Button label="Cancel" variant="outline" onPress={() => setEditing(false)} style={styles.actionButton} />
            <Button
              label={completeReview.isPending ? "..." : "Submit"}
              loading={completeReview.isPending}
              disabled={!draft.overallRating}
              onPress={() => completeReview.mutate({ id: r.id, payload: draft }, { onSuccess: () => setEditing(false) })}
              style={styles.actionButton}
            />
          </View>
        </SectionCard>
      ) : r.status === "completed" ? (
        <SectionCard title="Ratings">
          {RATING_CATEGORIES.map((c) => {
            const v = r[c.key as keyof typeof r] as number | null | undefined;
            return v ? (
              <View key={c.key} style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>{c.label}</Text>
                <StarPicker value={v} readOnly />
              </View>
            ) : null;
          })}
          {r.strengths ? (
            <>
              <Text style={styles.fieldLabel}>Strengths</Text>
              <Text style={styles.bodyText}>{r.strengths}</Text>
            </>
          ) : null}
          {r.improvements ? (
            <>
              <Text style={styles.fieldLabel}>Areas to improve</Text>
              <Text style={styles.bodyText}>{r.improvements}</Text>
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {r.goals.length > 0 ? (
        <SectionCard title={`Goals (${r.goals.length})`}>
          {r.goals.map((g) => (
            <GoalRow key={g.id} reviewId={r.id} goal={g} />
          ))}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function GoalRow({ reviewId, goal }: { reviewId: string; goal: PerformanceGoalDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [progress, setProgress] = useState(goal.progress);
  const [status, setStatus] = useState<GoalStatus>(goal.status);
  const updateGoal = useUpdateGoal();

  return (
    <View style={styles.goal}>
      <View style={styles.goalTop}>
        <Text style={styles.goalTitle} numberOfLines={1}>{goal.title}</Text>
        <Badge label={GOAL_STATUS_LABELS[goal.status]} tone={GOAL_STATUS_TONE[goal.status]} />
      </View>
      <Text style={styles.goalTarget}>{goal.target}</Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, goal.progress))}%` }]} />
      </View>
      <View style={styles.goalBottom}>
        <Text style={styles.goalProgress}>{goal.progress}% · due {goal.dueDate}</Text>
        <Pressable onPress={() => setEditing((v) => !v)}>
          <Text style={styles.goalEditLink}>{editing ? "Cancel" : "Update"}</Text>
        </Pressable>
      </View>
      {editing ? (
        <View style={styles.goalEditRow}>
          <View style={styles.progressStepper}>
            <Pressable onPress={() => setProgress((p) => Math.max(0, p - 10))} style={styles.stepperButton}>
              <Feather name="minus" size={14} color={colors.foreground} />
            </Pressable>
            <Text style={styles.stepperValue}>{progress}%</Text>
            <Pressable onPress={() => setProgress((p) => Math.min(100, p + 10))} style={styles.stepperButton}>
              <Feather name="plus" size={14} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={styles.statusChipRow}>
            {(["on_track", "at_risk", "achieved", "missed"] as GoalStatus[]).map((s) => (
              <Pressable key={s} onPress={() => setStatus(s)} style={[styles.statusChip, status === s && styles.statusChipActive]}>
                <Text style={[styles.statusChipText, status === s && styles.statusChipTextActive]}>{GOAL_STATUS_LABELS[s]}</Text>
              </Pressable>
            ))}
          </View>
          <Button
            label={updateGoal.isPending ? "..." : "Save"}
            size="sm"
            loading={updateGoal.isPending}
            onPress={() =>
              updateGoal.mutate(
                { reviewId, goalId: goal.id, payload: { progress, status } },
                { onSuccess: () => setEditing(false) },
              )
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.xs },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground, flexShrink: 1 },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },

    ratingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
    ratingLabel: { fontSize: fontSize.base, color: colors.foreground },
    fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.mutedForeground, marginTop: spacing.sm },
    textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, minHeight: 70, fontSize: fontSize.base, color: colors.foreground, marginTop: 4, textAlignVertical: "top" },
    bodyText: { fontSize: fontSize.base, color: colors.foreground, marginTop: 2 },

    actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    actionButton: { flex: 1 },

    goal: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingVertical: spacing.sm, gap: 6 },
    goalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    goalTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    goalTarget: { fontSize: fontSize.sm, color: colors.mutedForeground },
    progressBar: { height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: colors.primary },
    goalBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    goalProgress: { fontSize: fontSize.xs, color: colors.subtleForeground },
    goalEditLink: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },

    goalEditRow: { gap: spacing.sm, marginTop: spacing.xs },
    progressStepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    stepperButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
    stepperValue: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, minWidth: 44, textAlign: "center" },
    statusChipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    statusChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.muted },
    statusChipActive: { backgroundColor: colors.primary },
    statusChipText: { fontSize: fontSize.xs, color: colors.foregroundSecondary },
    statusChipTextActive: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  });
}
