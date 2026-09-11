import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useApplyLeave, useCancelLeave, useLeaveBalances, useMyLeaves } from "@/hooks/use-hr-self";
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_TONE, LEAVE_TYPE_LABELS } from "@/types/hr";
import type { LeaveRequestDto, LeaveType } from "@/types/hr";
import { Badge, Button, Card, Chip, EmptyState, LoadingState, SectionCard } from "@/components/ui";
import { colors, fontSize, fontWeight, radius, spacing } from "@/theme";

const LEAVE_TYPES: LeaveType[] = ["annual", "sick", "unpaid", "emergency", "maternity", "paternity", "hajj"];

/** Inclusive calendar-day count between two YYYY-MM-DD dates -- a simple default; the backend/HR
 *  is the source of truth for any working-day-only adjustment. */
function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
}

export default function LeaveScreen() {
  const balances = useLeaveBalances();
  const leaves = useMyLeaves({ pageSize: 30 });
  const applyLeave = useApplyLeave();
  const cancelLeave = useCancelLeave();

  const [applying, setApplying] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);

  const totalDays = daysBetween(startDate, endDate);
  const canSubmit = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && totalDays > 0;

  function submitApply() {
    applyLeave.mutate(
      { leaveType, startDate, endDate, totalDays, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setApplying(false);
          setStartDate("");
          setEndDate("");
          setReason("");
        },
      }
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Balances */}
      <SectionCard title="Balances">
        {balances.isLoading ? (
          <LoadingState size="small" />
        ) : !balances.data || balances.data.length === 0 ? (
          <Text style={styles.notes}>No leave policy configured.</Text>
        ) : (
          <View style={styles.balanceGrid}>
            {balances.data.map((b) => (
              <View key={b.leaveType} style={styles.balanceCard}>
                <Text style={styles.balanceType}>{b.leaveType}</Text>
                <Text style={styles.balanceRemaining}>{b.remainingDays}</Text>
                <Text style={styles.balanceOf}>of {b.entitlementDays} days</Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      {/* Apply */}
      <SectionCard title="Apply for leave">
        {applying ? (
          <View style={styles.applyForm}>
            <View style={styles.chipRow}>
              {LEAVE_TYPES.map((t) => (
                <Chip key={t} label={LEAVE_TYPE_LABELS[t]} active={leaveType === t} onPress={() => setLeaveType(t)} />
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Start date (YYYY-MM-DD)"
              placeholderTextColor={colors.subtleForeground}
              value={startDate}
              onChangeText={setStartDate}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="End date (YYYY-MM-DD)"
              placeholderTextColor={colors.subtleForeground}
              value={endDate}
              onChangeText={setEndDate}
              autoCapitalize="none"
            />
            {totalDays > 0 ? <Text style={styles.notes}>{totalDays} day(s)</Text> : null}
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.subtleForeground}
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <View style={styles.formButtons}>
              <Button label={applyLeave.isPending ? "Submitting..." : "Submit"} onPress={submitApply} disabled={!canSubmit || applyLeave.isPending} />
              <Button label="Cancel" variant="ghost" onPress={() => setApplying(false)} />
            </View>
            {applyLeave.isError ? <Text style={styles.errorText}>Could not submit this request.</Text> : null}
          </View>
        ) : (
          <Button label="Apply for leave" icon="plus" variant="secondary" onPress={() => setApplying(true)} />
        )}
      </SectionCard>

      {/* History */}
      <SectionCard title="Requests">
        {leaves.isLoading ? (
          <LoadingState size="small" />
        ) : !leaves.data || leaves.data.items.length === 0 ? (
          <EmptyState icon="sun" title="No leave requests yet" />
        ) : (
          leaves.data.items.map((l) => (
            <LeaveRow
              key={l.id}
              leave={l}
              confirming={cancelling === l.id}
              onRequestCancel={() => setCancelling(l.id)}
              onConfirmCancel={() => {
                cancelLeave.mutate(l.id);
                setCancelling(null);
              }}
              onDismissCancel={() => setCancelling(null)}
            />
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

function LeaveRow({
  leave,
  confirming,
  onRequestCancel,
  onConfirmCancel,
  onDismissCancel,
}: {
  leave: LeaveRequestDto;
  confirming: boolean;
  onRequestCancel: () => void;
  onConfirmCancel: () => void;
  onDismissCancel: () => void;
}) {
  return (
    <Card variant="flat" padding="md" style={styles.leaveRow}>
      <View style={styles.rowTop}>
        <Text style={styles.leaveTitle}>{LEAVE_TYPE_LABELS[leave.leaveType]}</Text>
        <Badge label={LEAVE_STATUS_LABELS[leave.status]} tone={LEAVE_STATUS_TONE[leave.status]} />
      </View>
      <Text style={styles.notes}>
        {leave.fromDate} → {leave.toDate} ({leave.days}d)
      </Text>
      {leave.reason ? <Text style={styles.notes}>{leave.reason}</Text> : null}
      {leave.rejectionReason ? <Text style={styles.errorText}>Rejected: {leave.rejectionReason}</Text> : null}
      {leave.status === "pending" ? (
        confirming ? (
          <View style={styles.formButtons}>
            <Text style={styles.notes}>Cancel this request?</Text>
            <Button label="Yes, cancel" size="sm" variant="destructive" onPress={onConfirmCancel} />
            <Button label="No" size="sm" variant="ghost" onPress={onDismissCancel} />
          </View>
        ) : (
          <Button label="Cancel request" size="sm" variant="ghost" onPress={onRequestCancel} style={styles.cancelLink} />
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  notes: { fontSize: fontSize.base, color: colors.mutedForeground },
  errorText: { fontSize: fontSize.sm, color: colors.destructive, fontWeight: fontWeight.semibold },

  balanceGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 2 },
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    minWidth: 92,
    alignItems: "center",
  },
  balanceType: { fontSize: fontSize.xs, color: colors.mutedForeground, textTransform: "capitalize" },
  balanceRemaining: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.primary },
  balanceOf: { fontSize: fontSize.xs, color: colors.subtleForeground },

  applyForm: { gap: spacing.sm + 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    backgroundColor: colors.card,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  multiline: { minHeight: 60, textAlignVertical: "top" },
  formButtons: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  cancelLink: { paddingHorizontal: 0 },

  leaveRow: { gap: spacing.xs, marginBottom: spacing.sm },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  leaveTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
});
