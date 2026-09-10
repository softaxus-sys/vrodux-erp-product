import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useDeal, useMoveDealStage } from "@/hooks/use-deals";
import { useActivities, useCreateActivity } from "@/hooks/use-activities";
import { cleanPhone, formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { FORECAST_LABELS, NEXT_STAGES, PIPELINE_STAGES, STAGE_PROBABILITY } from "@/types/crm";
import type { ActivityType, DealStage } from "@/types/crm";
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (deal.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load this opportunity.</Text>
        <Pressable onPress={() => deal.refetch()}>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      </View>
    );
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
          <Stat label="Value" value={formatCompactValue(d.value, d.currency)} />
          <Stat label="Weighted" value={formatCompactValue(d.weightedValue, d.currency)} />
          <Stat label="Stage" value={stageLabel(d.stage)} />
          <Stat label="Forecast" value={FORECAST_LABELS[d.forecastCategory]} />
        </View>
        {d.lossReason ? <Text style={styles.lossReason}>Lost: {d.lossReason}</Text> : null}
      </View>

      {/* Contact actions */}
      {d.contact?.name ? (
        <Section title={`Contact: ${d.contact.name}`}>
          <View style={styles.actionsRow}>
            <ActionButton label="Call" disabled={!phone} onPress={() => Linking.openURL(`tel:${phone}`)} />
            <ActionButton
              label="Email"
              disabled={!d.contact.email}
              onPress={() => Linking.openURL(`mailto:${d.contact.email}`)}
            />
          </View>
        </Section>
      ) : null}

      {/* Description / next action */}
      {d.description || d.nextAction ? (
        <Section title="Details">
          {d.description ? <Text style={styles.bodyText}>{d.description}</Text> : null}
          {d.nextAction ? (
            <Text style={styles.notes}>
              Next: {d.nextAction}
              {d.nextActionDate ? ` (${d.nextActionDate})` : ""}
            </Text>
          ) : null}
        </Section>
      ) : null}

      {/* Move stage */}
      {nextStages.length > 0 ? (
        <Section title="Move stage">
          <View style={styles.chipRow}>
            {nextStages.map((s) =>
              movingTo === s ? (
                s === "lost" ? (
                  <View key={s} style={styles.lostForm}>
                    <TextInput
                      style={styles.input}
                      placeholder="Reason lost (optional)"
                      value={lossReason}
                      onChangeText={setLossReason}
                      autoFocus
                    />
                    <View style={styles.logButtonsRow}>
                      <Pressable style={styles.confirmYes} onPress={() => submitStage(s)}>
                        <Text style={styles.confirmYesText}>Mark Lost</Text>
                      </Pressable>
                      <Pressable onPress={() => setMovingTo(null)}>
                        <Text style={styles.confirmCancel}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View key={s} style={styles.confirmRow}>
                    <Text style={styles.confirmText}>Move to {stageLabel(s)}?</Text>
                    <Pressable style={styles.confirmYes} onPress={() => submitStage(s)}>
                      <Text style={styles.confirmYesText}>Confirm</Text>
                    </Pressable>
                    <Pressable onPress={() => setMovingTo(null)}>
                      <Text style={styles.confirmCancel}>Cancel</Text>
                    </Pressable>
                  </View>
                )
              ) : (
                <Pressable key={s} style={styles.statusChip} onPress={() => setMovingTo(s)}>
                  <Text style={styles.statusChipText}>{stageLabel(s)}</Text>
                </Pressable>
              )
            )}
          </View>
        </Section>
      ) : null}

      {/* Log activity */}
      <Section title="Log activity">
        {logType ? (
          <View>
            <TextInput
              style={styles.input}
              placeholder={logType === "call" ? "What was discussed? (optional)" : "Note"}
              value={logNote}
              onChangeText={setLogNote}
              multiline
              autoFocus
            />
            <View style={styles.logButtonsRow}>
              <Pressable style={styles.logSubmit} onPress={submitLog} disabled={createActivity.isPending}>
                <Text style={styles.logSubmitText}>{createActivity.isPending ? "Saving..." : "Save"}</Text>
              </Pressable>
              <Pressable onPress={() => setLogType(null)}>
                <Text style={styles.confirmCancel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.chipRow}>
            <Pressable style={styles.statusChip} onPress={() => setLogType("call")}>
              <Text style={styles.statusChipText}>Log call</Text>
            </Pressable>
            <Pressable style={styles.statusChip} onPress={() => setLogType("note")}>
              <Text style={styles.statusChipText}>Add note</Text>
            </Pressable>
          </View>
        )}
      </Section>

      {/* Activity feed */}
      <Section title="Recent activity">
        {activities.isLoading ? (
          <ActivityIndicator />
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
      </Section>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.actionButton, disabled && styles.actionButtonDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.actionButtonText, disabled && styles.actionButtonTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorText: { color: "#dc2626" },
  retry: { color: "#2563eb", fontWeight: "600" },

  header: { gap: 4 },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 8 },
  stat: {},
  statLabel: { fontSize: 11, color: "#9ca3af", textTransform: "uppercase" },
  statValue: { fontSize: 14, fontWeight: "600", color: "#111827" },
  lossReason: { fontSize: 13, color: "#dc2626", marginTop: 6 },

  actionsRow: { flexDirection: "row", gap: 8 },
  actionButton: { flex: 1, backgroundColor: "#111827", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  actionButtonDisabled: { backgroundColor: "#e5e7eb" },
  actionButtonText: { color: "#fff", fontWeight: "600" },
  actionButtonTextDisabled: { color: "#9ca3af" },

  section: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase" },
  bodyText: { fontSize: 15, color: "#111827" },
  notes: { fontSize: 13, color: "#6b7280", fontStyle: "italic" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#e5e7eb" },
  statusChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },

  confirmRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  confirmText: { fontSize: 13, color: "#111827" },
  confirmYes: { backgroundColor: "#dc2626", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  confirmYesText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  confirmCancel: { color: "#6b7280", fontSize: 13 },
  lostForm: { flex: 1, gap: 8 },

  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    minHeight: 44,
    backgroundColor: "#fff",
    textAlignVertical: "top",
  },
  logButtonsRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  logSubmit: { backgroundColor: "#111827", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  logSubmitText: { color: "#fff", fontWeight: "600" },

  activityRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8, marginTop: 4, gap: 2 },
  activitySubject: { fontSize: 14, fontWeight: "600", color: "#111827" },
  activityDate: { fontSize: 11, color: "#9ca3af" },
});
