import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useDeal, useMoveDealStage } from "@/hooks/use-deals";
import { useActivities, useCreateActivity } from "@/hooks/use-activities";
import { cleanPhone, formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { FORECAST_LABELS, NEXT_STAGES, PIPELINE_STAGES, STAGE_PROBABILITY } from "@/types/crm";
import type { ActivityType, DealStage } from "@/types/crm";
import { Button, Chip, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { colors, fontSize, fontWeight, radius, spacing } from "@/theme";
import type { DealsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<DealsStackParamList, "DealDetail">;

function stageLabel(stage: DealStage): string {
  return PIPELINE_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

export default function DealDetailScreen({ route, navigation }: Props) {
  const { dealId, dealTitle } = route.params;
  navigation.setOptions({ headerTitle: dealTitle });

  const deal = useDeal(dealId);
  const activities = useActivities("deal", dealId);
  const moveStage = useMoveDealStage();
  const createActivity = useCreateActivity();
  const userName = useAuthStore((s) => s.user?.fullName ?? "");

  const [movingTo, setMovingTo] = useState<DealStage | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [logType, setLogType] = useState<ActivityType | null>(null);
  const [logNote, setLogNote] = useState("");

  if (deal.isLoading || !deal.data) {
    return <LoadingState />;
  }
  if (deal.isError) {
    return <ErrorState message="Could not load this opportunity." onRetry={() => deal.refetch()} />;
  }

  const d = deal.data;
  const nextStages = NEXT_STAGES[d.stage] ?? [];
  const phone = cleanPhone(d.contact.phone);

  function submitStage(stage: DealStage) {
    moveStage.mutate(
      {
        id: d.id,
        stage,
        probability: STAGE_PROBABILITY[stage],
        lossReason: stage === "lost" ? lossReason.trim() || undefined : undefined,
      },
      { onSuccess: () => setMovingTo(null) }
    );
  }

  function submitLog() {
    if (!logType) return;
    createActivity.mutate(
      {
        type: logType,
        subject: logType === "call" ? "Phone call" : "Note",
        description: logNote.trim() || undefined,
        relatedToType: "deal",
        relatedToId: d.id,
        relatedToName: d.title,
        assignedTo: userName,
      },
      { onSuccess: () => setLogNote("") }
    );
    setLogType(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name}>{d.title}</Text>
        {d.company ? <Text style={styles.subtitle}>{d.company}</Text> : null}
        <View style={styles.statsRow}>
          <Stat label="Value" value={formatCompactValue(d.value, d.currency)} tone="primary" />
          <Stat label="Weighted" value={formatCompactValue(d.weightedValue, d.currency)} />
          <Stat label="Stage" value={stageLabel(d.stage)} />
          <Stat label="Forecast" value={FORECAST_LABELS[d.forecastCategory]} />
        </View>
        {d.lossReason ? <Text style={styles.lossReason}>Lost: {d.lossReason}</Text> : null}
      </View>

      {/* Contact actions */}
      {d.contact?.name ? (
        <SectionCard title={`Contact: ${d.contact.name}`}>
          <View style={styles.actionsRow}>
            <Button icon="phone" label="Call" variant="outline" disabled={!phone} onPress={() => Linking.openURL(`tel:${phone}`)} fullWidth style={styles.actionButton} />
            <Button
              icon="mail"
              label="Email"
              variant="outline"
              disabled={!d.contact.email}
              onPress={() => Linking.openURL(`mailto:${d.contact.email}`)}
              fullWidth
              style={styles.actionButton}
            />
          </View>
        </SectionCard>
      ) : null}

      {/* Description / next action */}
      {d.description || d.nextAction ? (
        <SectionCard title="Details">
          {d.description ? <Text style={styles.bodyText}>{d.description}</Text> : null}
          {d.nextAction ? (
            <Text style={styles.notes}>
              Next: {d.nextAction}
              {d.nextActionDate ? ` (${d.nextActionDate})` : ""}
            </Text>
          ) : null}
        </SectionCard>
      ) : null}

      {/* Move stage */}
      {nextStages.length > 0 ? (
        <SectionCard title="Move stage">
          <View style={styles.chipRow}>
            {nextStages.map((s) =>
              movingTo === s ? (
                s === "lost" ? (
                  <View key={s} style={styles.lostForm}>
                    <TextInput
                      style={styles.input}
                      placeholder="Reason lost (optional)"
                      placeholderTextColor={colors.subtleForeground}
                      value={lossReason}
                      onChangeText={setLossReason}
                      autoFocus
                    />
                    <View style={styles.buttonsRow}>
                      <Button label="Mark Lost" variant="destructive" onPress={() => submitStage(s)} />
                      <Button label="Cancel" variant="ghost" onPress={() => setMovingTo(null)} />
                    </View>
                  </View>
                ) : (
                  <View key={s} style={styles.confirmRow}>
                    <Text style={styles.confirmText}>Move to {stageLabel(s)}?</Text>
                    <Button label="Confirm" size="sm" onPress={() => submitStage(s)} />
                    <Button label="Cancel" size="sm" variant="ghost" onPress={() => setMovingTo(null)} />
                  </View>
                )
              ) : (
                <Chip key={s} label={stageLabel(s)} onPress={() => setMovingTo(s)} />
              )
            )}
          </View>
        </SectionCard>
      ) : null}

      {/* Log activity */}
      <SectionCard title="Log activity">
        {logType ? (
          <View style={styles.formGap}>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder={logType === "call" ? "What was discussed? (optional)" : "Note"}
              placeholderTextColor={colors.subtleForeground}
              value={logNote}
              onChangeText={setLogNote}
              multiline
              autoFocus
            />
            <View style={styles.buttonsRow}>
              <Button label={createActivity.isPending ? "Saving..." : "Save"} onPress={submitLog} disabled={createActivity.isPending} />
              <Button label="Cancel" variant="ghost" onPress={() => setLogType(null)} />
            </View>
          </View>
        ) : (
          <View style={styles.chipRow}>
            <Chip label="Log call" onPress={() => setLogType("call")} />
            <Chip label="Add note" onPress={() => setLogType("note")} />
          </View>
        )}
      </SectionCard>

      {/* Activity feed */}
      <SectionCard title="Recent activity">
        {activities.isLoading ? (
          <LoadingState size="small" />
        ) : !activities.data || activities.data.length === 0 ? (
          <Text style={styles.notes}>Nothing logged yet.</Text>
        ) : (
          activities.data.map((a) => (
            <View key={a.id} style={styles.activityRow}>
              <Text style={styles.activitySubject}>
                {a.type === "call" ? "☎️" : "📝"} {a.subject}
              </Text>
              {a.description ? <Text style={styles.notes}>{a.description}</Text> : null}
              <Text style={styles.activityDate}>{new Date(a.createdAt).toLocaleString()}</Text>
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },

  header: { gap: spacing.xs },
  name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
  subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },
  lossReason: { fontSize: fontSize.base, color: colors.destructive, marginTop: spacing.sm, fontWeight: fontWeight.medium },

  actionsRow: { flexDirection: "row", gap: spacing.sm },
  actionButton: { flex: 1, paddingHorizontal: spacing.sm },

  bodyText: { fontSize: fontSize.lg, color: colors.foreground },
  notes: { fontSize: fontSize.base, color: colors.mutedForeground, fontStyle: "italic" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

  confirmRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  confirmText: { fontSize: fontSize.base, color: colors.foreground },
  lostForm: { flex: 1, gap: spacing.sm + 2 },

  formGap: { gap: spacing.sm + 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    backgroundColor: colors.card,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  multiline: { minHeight: 44, textAlignVertical: "top" },
  buttonsRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },

  activityRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: 2 },
  activitySubject: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
  activityDate: { fontSize: fontSize.xs, color: colors.subtleForeground },
});
