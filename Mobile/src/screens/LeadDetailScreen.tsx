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
import { useCreateActivity, useLead, useLeadActivities, useSetLeadStatus } from "@/hooks/use-leads";
import { buildLeadSummary, cleanPhone, formatCompactValue, leadHeat, urgencyLabel } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { LEAD_STATUS_LABELS, NEXT_STATUSES } from "@/types/crm";
import type { ActivityType } from "@/types/crm";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "LeadDetail">;

export default function LeadDetailScreen({ route, navigation }: Props) {
  const { leadId, leadName } = route.params;
  navigation.setOptions({ headerTitle: leadName });

  const lead = useLead(leadId);
  const activities = useLeadActivities(leadId);
  const setStatus = useSetLeadStatus();
  const createActivity = useCreateActivity();
  const userName = useAuthStore((s) => s.user?.fullName ?? "");

  const [confirmingStatus, setConfirmingStatus] = useState<string | null>(null);
  const [logType, setLogType] = useState<ActivityType | null>(null);
  const [logNote, setLogNote] = useState("");

  if (lead.isLoading || !lead.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (lead.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load this lead.</Text>
        <Pressable onPress={() => lead.refetch()}>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const l = lead.data;
  const heat = leadHeat(l.score);
  const urgency = urgencyLabel(l.purchaseUrgency);
  const nextStatuses = NEXT_STATUSES[l.status] ?? [];
  const phone = cleanPhone(l.phone);
  const whatsapp = cleanPhone(l.whatsApp || l.phone);

  function submitStatus(status: string) {
    setStatus.mutate({ id: l.id, status });
    setConfirmingStatus(null);
  }

  function submitLog() {
    if (!logType) return;
    createActivity.mutate(
      {
        type: logType,
        subject: logType === "call" ? "Phone call" : "Note",
        description: logNote.trim() || undefined,
        relatedToType: "lead",
        relatedToId: l.id,
        relatedToName: l.fullName,
        assignedTo: userName,
      },
      { onSuccess: () => setLogNote("") }
    );
    setLogType(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.name}>
          {heat.emoji} {l.fullName}
        </Text>
        {l.title || l.company ? (
          <Text style={styles.subtitle}>
            {[l.title, l.company].filter(Boolean).join(" @ ")}
          </Text>
        ) : null}
        <View style={styles.statsRow}>
          <Stat label="Heat" value={`${heat.label} (${l.score})`} />
          <Stat label="Value" value={formatCompactValue(l.estimatedValue, l.currency)} />
          <Stat label="Status" value={LEAD_STATUS_LABELS[l.status]} />
        </View>
      </View>

      {/* ── Contact actions ────────────────────────────────── */}
      <View style={styles.actionsRow}>
        <ActionButton
          label="Call"
          disabled={!phone}
          onPress={() => Linking.openURL(`tel:${phone}`)}
        />
        <ActionButton
          label="WhatsApp"
          disabled={!whatsapp}
          onPress={() => Linking.openURL(`https://wa.me/${whatsapp.replace(/^\+/, "")}`)}
        />
        <ActionButton
          label="Email"
          disabled={!l.email}
          onPress={() => Linking.openURL(`mailto:${l.email}`)}
        />
      </View>

      {/* ── Requirements ───────────────────────────────────── */}
      <Section title="Requirements">
        <Text style={styles.bodyText}>{buildLeadSummary(l)}</Text>
        {urgency ? <Text style={styles.badge}>Planning to buy: {urgency}</Text> : null}
        {l.message ? <Text style={styles.notes}>“{l.message.trim()}”</Text> : null}
      </Section>

      {/* ── Status ─────────────────────────────────────────── */}
      {nextStatuses.length > 0 ? (
        <Section title="Move status">
          <View style={styles.chipRow}>
            {nextStatuses.map((s) =>
              confirmingStatus === s ? (
                <View key={s} style={styles.confirmRow}>
                  <Text style={styles.confirmText}>Mark as {LEAD_STATUS_LABELS[s]}?</Text>
                  <Pressable style={styles.confirmYes} onPress={() => submitStatus(s)}>
                    <Text style={styles.confirmYesText}>Confirm</Text>
                  </Pressable>
                  <Pressable onPress={() => setConfirmingStatus(null)}>
                    <Text style={styles.confirmCancel}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable key={s} style={styles.statusChip} onPress={() => setConfirmingStatus(s)}>
                  <Text style={styles.statusChipText}>{LEAD_STATUS_LABELS[s]}</Text>
                </Pressable>
              )
            )}
          </View>
        </Section>
      ) : null}

      {/* ── Log activity ───────────────────────────────────── */}
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
                <Text style={styles.logSubmitText}>
                  {createActivity.isPending ? "Saving…" : "Save"}
                </Text>
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

      {/* ── Activity feed ──────────────────────────────────── */}
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
    <Pressable
      style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
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
  name: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },
  statsRow: { flexDirection: "row", gap: 20, marginTop: 8 },
  stat: {},
  statLabel: { fontSize: 11, color: "#9ca3af", textTransform: "uppercase" },
  statValue: { fontSize: 14, fontWeight: "600", color: "#111827" },

  actionsRow: { flexDirection: "row", gap: 8 },
  actionButton: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionButtonDisabled: { backgroundColor: "#e5e7eb" },
  actionButtonText: { color: "#fff", fontWeight: "600" },
  actionButtonTextDisabled: { color: "#9ca3af" },

  section: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase" },
  bodyText: { fontSize: 15, color: "#111827" },
  badge: { fontSize: 13, color: "#b45309", fontWeight: "600" },
  notes: { fontSize: 13, color: "#6b7280", fontStyle: "italic" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  statusChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },

  confirmRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  confirmText: { fontSize: 13, color: "#111827" },
  confirmYes: { backgroundColor: "#dc2626", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  confirmYesText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  confirmCancel: { color: "#6b7280", fontSize: 13 },

  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
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
