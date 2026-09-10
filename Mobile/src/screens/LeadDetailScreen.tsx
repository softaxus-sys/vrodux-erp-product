import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useConvertLead, useLead, useSetLeadStatus } from "@/hooks/use-leads";
import { useActivities, useCreateActivity } from "@/hooks/use-activities";
import { buildLeadSummary, cleanPhone, formatCompactValue, leadHeat, urgencyLabel } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { LEAD_STATUS_LABELS, NEXT_STATUSES } from "@/types/crm";
import type { ActivityType } from "@/types/crm";
import { Badge, Button, Chip, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { colors, fontSize, fontWeight, radius, spacing } from "@/theme";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "LeadDetail">;

export default function LeadDetailScreen({ route, navigation }: Props) {
  const { leadId, leadName } = route.params;
  navigation.setOptions({ headerTitle: leadName });

  const lead = useLead(leadId);
  const activities = useActivities("lead", leadId);
  const setStatus = useSetLeadStatus();
  const createActivity = useCreateActivity();
  const convertLead = useConvertLead();
  const userName = useAuthStore((s) => s.user?.fullName ?? "");

  const [confirmingStatus, setConfirmingStatus] = useState<string | null>(null);
  const [logType, setLogType] = useState<ActivityType | null>(null);
  const [logNote, setLogNote] = useState("");
  const [converting, setConverting] = useState(false);
  const [dealTitle, setDealTitle] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [converted, setConverted] = useState(false);

  if (lead.isLoading || !lead.data) {
    return <LoadingState />;
  }
  if (lead.isError) {
    return <ErrorState message="Could not load this lead." onRetry={() => lead.refetch()} />;
  }

  const l = lead.data;
  const heat = leadHeat(l.score);
  const urgency = urgencyLabel(l.purchaseUrgency);
  const nextStatuses = NEXT_STATUSES[l.status] ?? [];
  const phone = cleanPhone(l.phone);
  const whatsapp = cleanPhone(l.whatsApp || l.phone);
  // Convert is only offered pre-conversion -- convertedDealStage means it already happened.
  const canConvert = !l.convertedDealStage && (l.status === "qualified" || l.status === "contacted");

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

  function openConvert() {
    setDealTitle(`${l.company || l.fullName} — Opportunity`);
    setDealValue(l.estimatedValue > 0 ? String(l.estimatedValue) : "");
    setConverting(true);
  }

  function submitConvert() {
    const value = Number(dealValue);
    convertLead.mutate(
      {
        id: l.id,
        body: {
          dealTitle: dealTitle.trim() || undefined,
          dealValue: Number.isFinite(value) && value > 0 ? value : undefined,
        },
      },
      {
        onSuccess: () => {
          setConverting(false);
          setConverted(true);
        },
      }
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name}>
          {heat.emoji} {l.fullName}
        </Text>
        {l.title || l.company ? (
          <Text style={styles.subtitle}>{[l.title, l.company].filter(Boolean).join(" @ ")}</Text>
        ) : null}
        <View style={styles.statsRow}>
          <Stat label="Heat" value={`${heat.label} (${l.score})`} />
          <Stat label="Value" value={formatCompactValue(l.estimatedValue, l.currency)} tone="primary" />
          <Stat label="Status" value={LEAD_STATUS_LABELS[l.status]} />
        </View>
      </View>

      {/* Contact actions */}
      <View style={styles.actionsRow}>
        <Button icon="phone" label="Call" variant="outline" disabled={!phone} onPress={() => Linking.openURL(`tel:${phone}`)} fullWidth style={styles.actionButton} />
        <Button
          icon="message-circle"
          label="WhatsApp"
          variant="outline"
          disabled={!whatsapp}
          onPress={() => Linking.openURL(`https://wa.me/${whatsapp.replace(/^\+/, "")}`)}
          fullWidth
          style={styles.actionButton}
        />
        <Button icon="mail" label="Email" variant="outline" disabled={!l.email} onPress={() => Linking.openURL(`mailto:${l.email}`)} fullWidth style={styles.actionButton} />
      </View>

      {/* Requirements */}
      <SectionCard title="Requirements">
        <Text style={styles.bodyText}>{buildLeadSummary(l)}</Text>
        {urgency ? <Badge label={`Planning to buy: ${urgency}`} tone="warning" dot={false} /> : null}
        {l.message ? <Text style={styles.notes}>{l.message.trim()}</Text> : null}
      </SectionCard>

      {/* Convert to deal */}
      {l.convertedDealStage ? (
        <SectionCard title="Converted">
          <Text style={styles.bodyText}>
            This lead became an opportunity (stage: {l.convertedDealStage}). Find it in the Pipeline tab.
          </Text>
        </SectionCard>
      ) : converted ? (
        <SectionCard title="Converted">
          <Text style={styles.bodyText}>Opportunity created. View it in the Pipeline tab.</Text>
        </SectionCard>
      ) : canConvert ? (
        <SectionCard title="Convert to opportunity">
          {converting ? (
            <View style={styles.formGap}>
              <TextInput style={styles.input} placeholder="Deal title" placeholderTextColor={colors.subtleForeground} value={dealTitle} onChangeText={setDealTitle} />
              <TextInput
                style={styles.input}
                placeholder="Estimated value (optional)"
                placeholderTextColor={colors.subtleForeground}
                keyboardType="numeric"
                value={dealValue}
                onChangeText={setDealValue}
              />
              <View style={styles.buttonsRow}>
                <Button label={convertLead.isPending ? "Converting..." : "Create opportunity"} onPress={submitConvert} disabled={convertLead.isPending} />
                <Button label="Cancel" variant="ghost" onPress={() => setConverting(false)} />
              </View>
              {convertLead.isError ? <Text style={styles.errorText}>Could not convert this lead.</Text> : null}
            </View>
          ) : (
            <Button label="Convert to opportunity" icon="arrow-up-right" onPress={openConvert} />
          )}
        </SectionCard>
      ) : null}

      {/* Status */}
      {nextStatuses.length > 0 ? (
        <SectionCard title="Move status">
          <View style={styles.chipRow}>
            {nextStatuses.map((s) =>
              confirmingStatus === s ? (
                <View key={s} style={styles.confirmRow}>
                  <Text style={styles.confirmText}>Mark as {LEAD_STATUS_LABELS[s]}?</Text>
                  <Button label="Confirm" size="sm" variant={s === "lost" ? "destructive" : "primary"} onPress={() => submitStatus(s)} />
                  <Button label="Cancel" size="sm" variant="ghost" onPress={() => setConfirmingStatus(null)} />
                </View>
              ) : (
                <Chip key={s} label={LEAD_STATUS_LABELS[s]} onPress={() => setConfirmingStatus(s)} />
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
  statsRow: { flexDirection: "row", gap: spacing.xxl, marginTop: spacing.sm },

  actionsRow: { flexDirection: "row", gap: spacing.sm },
  actionButton: { flex: 1, paddingHorizontal: spacing.sm },

  bodyText: { fontSize: fontSize.lg, color: colors.foreground },
  notes: { fontSize: fontSize.base, color: colors.mutedForeground, fontStyle: "italic" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

  confirmRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  confirmText: { fontSize: fontSize.base, color: colors.foreground },

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
  errorText: { color: colors.destructive, fontSize: fontSize.sm },

  activityRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: 2 },
  activitySubject: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
  activityDate: { fontSize: fontSize.xs, color: colors.subtleForeground },
});
