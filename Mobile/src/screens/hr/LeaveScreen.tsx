import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useApplyLeave, useCancelLeave, useLeaveBalances, useMyLeaves } from "@/hooks/use-hr-self";
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS } from "@/types/hr";
import type { LeaveRequestDto, LeaveType } from "@/types/hr";

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
      <Section title="Balances">
        {balances.isLoading ? (
          <ActivityIndicator />
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
      </Section>

      {/* Apply */}
      <Section title="Apply for leave">
        {applying ? (
          <View>
            <View style={styles.chipRow}>
              {LEAVE_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.chip, leaveType === t && styles.chipActive]}
                  onPress={() => setLeaveType(t)}
                >
                  <Text style={[styles.chipText, leaveType === t && styles.chipTextActive]}>
                    {LEAVE_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, styles.inputSpaced]}
              placeholder="Start date (YYYY-MM-DD)"
              value={startDate}
              onChangeText={setStartDate}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.inputSpaced]}
              placeholder="End date (YYYY-MM-DD)"
              value={endDate}
              onChangeText={setEndDate}
              autoCapitalize="none"
            />
            {totalDays > 0 ? <Text style={styles.notes}>{totalDays} day(s)</Text> : null}
            <TextInput
              style={[styles.input, styles.inputSpaced]}
              placeholder="Reason (optional)"
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <View style={styles.logButtonsRow}>
              <Pressable
                style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                disabled={!canSubmit || applyLeave.isPending}
                onPress={submitApply}
              >
                <Text style={styles.submitButtonText}>{applyLeave.isPending ? "Submitting..." : "Submit"}</Text>
              </Pressable>
              <Pressable onPress={() => setApplying(false)}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </Pressable>
            </View>
            {applyLeave.isError ? <Text style={styles.errorText}>Could not submit this request.</Text> : null}
          </View>
        ) : (
          <Pressable style={styles.chip} onPress={() => setApplying(true)}>
            <Text style={styles.chipText}>+ Apply for leave</Text>
          </Pressable>
        )}
      </Section>

      {/* History */}
      <Section title="Requests">
        {leaves.isLoading ? (
          <ActivityIndicator />
        ) : !leaves.data || leaves.data.items.length === 0 ? (
          <Text style={styles.notes}>No leave requests yet.</Text>
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
      </Section>
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
    <View style={styles.leaveRow}>
      <View style={styles.rowTop}>
        <Text style={styles.leaveTitle}>{LEAVE_TYPE_LABELS[leave.leaveType]}</Text>
        <Text style={styles.leaveStatus}>{LEAVE_STATUS_LABELS[leave.status]}</Text>
      </View>
      <Text style={styles.notes}>
        {leave.fromDate} → {leave.toDate} ({leave.days}d)
      </Text>
      {leave.reason ? <Text style={styles.notes}>{leave.reason}</Text> : null}
      {leave.rejectionReason ? <Text style={styles.errorText}>Rejected: {leave.rejectionReason}</Text> : null}
      {leave.status === "pending" ? (
        confirming ? (
          <View style={styles.logButtonsRow}>
            <Text style={styles.notes}>Cancel this request?</Text>
            <Pressable onPress={onConfirmCancel}>
              <Text style={styles.errorText}>Yes, cancel</Text>
            </Pressable>
            <Pressable onPress={onDismissCancel}>
              <Text style={styles.cancelLink}>No</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onRequestCancel}>
            <Text style={styles.cancelLink}>Cancel request</Text>
          </Pressable>
        )
      ) : null}
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

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase" },
  notes: { fontSize: 13, color: "#6b7280" },
  errorText: { fontSize: 12, color: "#dc2626", fontWeight: "600" },

  balanceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  balanceCard: { backgroundColor: "#fff", borderRadius: 10, padding: 10, minWidth: 90, alignItems: "center" },
  balanceType: { fontSize: 11, color: "#6b7280", textTransform: "capitalize" },
  balanceRemaining: { fontSize: 20, fontWeight: "700", color: "#111827" },
  balanceOf: { fontSize: 11, color: "#9ca3af" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#e5e7eb" },
  chipActive: { backgroundColor: "#111827" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  chipTextActive: { color: "#fff" },

  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
  },
  inputSpaced: { marginTop: 8 },
  logButtonsRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  submitButton: { backgroundColor: "#111827", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  submitButtonDisabled: { backgroundColor: "#e5e7eb" },
  submitButtonText: { color: "#fff", fontWeight: "600" },
  cancelLink: { color: "#6b7280", fontSize: 13 },

  leaveRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8, marginTop: 4, gap: 4 },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  leaveTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  leaveStatus: { fontSize: 12, fontWeight: "600", color: "#374151" },
});
