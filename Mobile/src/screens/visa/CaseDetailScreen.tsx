import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  useAddCaseNote,
  useAssignCase,
  useChangeCaseStatus,
  useUpdateCaseDocument,
  useVisaCase,
} from "@/hooks/use-visa";
import { formatCompactValue } from "@/lib/crm-helpers";
import { VISA_CASES_EDIT } from "@/lib/visa.api";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_TONE,
  CASE_TRANSITIONS,
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONE,
} from "@/types/visa";
import type { CaseDocumentDto, VisaCaseStatus } from "@/types/visa";
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { VisaStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<VisaStackParamList, "CaseDetail">;

// Dynamic, per the project's "never hardcode dates" rule.
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CaseDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { caseId, caseNumber } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: caseNumber });
  }, [navigation, caseNumber]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const myName = useAuthStore((s) => s.user?.fullName ?? "");
  const canEdit = hasPermission(VISA_CASES_EDIT);

  const visaCase = useVisaCase(caseId);
  const changeStatus = useChangeCaseStatus();
  const updateDocument = useUpdateCaseDocument();
  const addNote = useAddCaseNote();
  const assign = useAssignCase();

  const [statusTarget, setStatusTarget] = useState<VisaCaseStatus | null>(null);
  const [docPicking, setDocPicking] = useState<CaseDocumentDto | null>(null);
  const [note, setNote] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [assignee, setAssignee] = useState("");

  if (visaCase.isLoading || !visaCase.data) {
    return <LoadingState />;
  }
  if (visaCase.isError) {
    return <ErrorState message="Couldn't load this case." onRetry={() => visaCase.refetch()} />;
  }

  const c = visaCase.data;
  const status = c.status as VisaCaseStatus;
  const nextMoves = CASE_TRANSITIONS[status] ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={2}>
          {c.applicants[0]?.fullName ?? c.customerName ?? "Case"}
          {c.applicants.length > 1 ? ` +${c.applicants.length - 1}` : ""}
        </Text>
        <View style={styles.subtitleRow}>
          <Badge label={CASE_STATUS_LABELS[status] ?? c.status} tone={CASE_STATUS_TONE[status] ?? "neutral"} />
          <Text style={styles.subtitle}>
            {c.visaTypeName} · {c.emirate}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <Stat label="Service Fee" value={formatCompactValue(c.serviceFee, currency)} />
          <Stat label="Govt Fee" value={formatCompactValue(c.govtFee, currency)} />
          {c.slaDueDate ? <Stat label="SLA Due" value={c.slaDueDate} /> : null}
          {c.visaExpiryDate ? <Stat label="Visa Expiry" value={c.visaExpiryDate} tone="primary" /> : null}
        </View>
      </View>

      {c.rejectionReason ? (
        <View style={styles.rejectionBanner}>
          <Feather name="alert-triangle" size={16} color={colors.destructive} />
          <Text style={styles.rejectionText}>{c.rejectionReason}</Text>
        </View>
      ) : null}

      <SectionCard
        title="Assignment"
        right={
          canEdit ? (
            <Pressable onPress={() => setReassigning((v) => !v)} hitSlop={8}>
              <Text style={styles.linkText}>{reassigning ? "Cancel" : "Reassign"}</Text>
            </Pressable>
          ) : undefined
        }
      >
        {reassigning ? (
          <View style={styles.assignRow}>
            <TextInput
              style={styles.assignInput}
              value={assignee}
              onChangeText={setAssignee}
              placeholder="Assignee name"
              placeholderTextColor={colors.subtleForeground}
              autoFocus
            />
            <Button
              label={assign.isPending ? "..." : "Save"}
              size="sm"
              disabled={assign.isPending || !assignee.trim()}
              onPress={() => {
                assign.mutate({ id: caseId, assignedTo: assignee.trim(), byName: myName });
                setReassigning(false);
                setAssignee("");
              }}
            />
          </View>
        ) : (
          <DetailRow label="Assigned to" value={c.assignedTo || "Unassigned"} />
        )}
        {c.customerName ? <DetailRow label="Client" value={c.customerName} /> : null}
        <DetailRow label="Priority" value={c.priority} />
      </SectionCard>

      <SectionCard title={`Applicants (${c.applicants.length})`}>
        {c.applicants.map((a) => (
          <View key={a.id} style={styles.applicantRow}>
            <Text style={styles.applicantName}>{a.fullName}</Text>
            <Text style={styles.applicantMeta}>
              {a.relationship} · {a.nationality} · {a.passportNumber}
              {a.passportExpiry ? ` (exp. ${a.passportExpiry})` : ""}
            </Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard title={`Documents (${c.documents.length - c.documents.filter((d) => d.status === "pending").length}/${c.documents.length})`}>
        {c.documents.length === 0 ? (
          <Text style={styles.emptyText}>No document checklist yet.</Text>
        ) : (
          c.documents.map((d) => (
            <Pressable key={d.id} style={styles.docRow} disabled={!canEdit} onPress={() => setDocPicking(d)}>
              <Text style={styles.docName} numberOfLines={1}>
                {d.name}
              </Text>
              <Badge label={DOCUMENT_STATUS_LABELS[d.status as keyof typeof DOCUMENT_STATUS_LABELS] ?? d.status} tone={DOCUMENT_STATUS_TONE[d.status as keyof typeof DOCUMENT_STATUS_TONE] ?? "neutral"} />
            </Pressable>
          ))
        )}
      </SectionCard>

      <SectionCard title="Notes & Timeline">
        {canEdit ? (
          <View style={styles.noteRow}>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note…"
              placeholderTextColor={colors.subtleForeground}
              multiline
            />
            <Button
              label={addNote.isPending ? "..." : "Add"}
              size="sm"
              disabled={addNote.isPending || !note.trim()}
              onPress={() => {
                addNote.mutate({ caseId, note: note.trim(), byName: myName });
                setNote("");
              }}
            />
          </View>
        ) : null}
        {c.notes ? <Text style={styles.bodyText}>{c.notes}</Text> : null}
        {[...c.timeline].reverse().map((e) => (
          <View key={e.id} style={styles.timelineRow}>
            <Text style={styles.timelineText}>
              {e.note ?? (e.toStatus ? `→ ${CASE_STATUS_LABELS[e.toStatus as VisaCaseStatus] ?? e.toStatus}` : e.eventType)}
            </Text>
            <Text style={styles.timelineMeta}>
              {e.byName} · {e.createdAt}
            </Text>
          </View>
        ))}
      </SectionCard>

      {canEdit && nextMoves.length > 0 ? (
        <SectionCard title="Move Case">
          <View style={styles.movesRow}>
            {nextMoves.map((m) => (
              <Button
                key={m}
                label={CASE_STATUS_LABELS[m]}
                size="sm"
                variant={m === "rejected" || m === "cancelled" ? "outline" : "primary"}
                disabled={changeStatus.isPending}
                onPress={() => setStatusTarget(m)}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      <StatusChangeModal
        visible={Boolean(statusTarget)}
        target={statusTarget}
        busy={changeStatus.isPending}
        onCancel={() => setStatusTarget(null)}
        onConfirm={(extra) => {
          if (!statusTarget) return;
          changeStatus.mutate({ id: caseId, body: { status: statusTarget, byName: myName, ...extra } });
          setStatusTarget(null);
        }}
      />

      <DocumentStatusModal
        visible={Boolean(docPicking)}
        document={docPicking}
        busy={updateDocument.isPending}
        onCancel={() => setDocPicking(null)}
        onSelect={(status) => {
          if (!docPicking) return;
          updateDocument.mutate({ caseId, documentId: docPicking.id, body: { status, byName: myName } });
          setDocPicking(null);
        }}
      />
    </ScrollView>
  );
}

function StatusChangeModal({
  visible,
  target,
  busy,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  target: VisaCaseStatus | null;
  busy: boolean;
  onConfirm: (extra: { rejectionReason?: string; govtReference?: string; visaExpiryDate?: string }) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState("");

  if (!target) return null;
  const needsReason = target === "rejected";
  const needsGovtRef = target === "submitted";
  const needsExpiry = target === "issued";
  const placeholder = needsReason ? "Reason for rejection (required)" : needsGovtRef ? "Government reference (optional)" : needsExpiry ? `Visa expiry date (YYYY-MM-DD, e.g. ${today()})` : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Move to {CASE_STATUS_LABELS[target]}</Text>
          {placeholder ? (
            <TextInput
              style={styles.sheetInput}
              value={text}
              onChangeText={setText}
              placeholder={placeholder}
              placeholderTextColor={colors.subtleForeground}
              autoFocus
              multiline={needsReason}
            />
          ) : (
            <Text style={styles.sheetBody}>Confirm this case moves to "{CASE_STATUS_LABELS[target]}".</Text>
          )}
          <View style={styles.sheetActions}>
            <Button
              label={busy ? "..." : "Confirm"}
              disabled={busy || (needsReason && !text.trim())}
              onPress={() => {
                onConfirm(
                  needsReason ? { rejectionReason: text.trim() } : needsGovtRef ? { govtReference: text.trim() || undefined } : needsExpiry ? { visaExpiryDate: text.trim() || undefined } : {},
                );
                setText("");
              }}
            />
            <Button label="Cancel" variant="ghost" onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DocumentStatusModal({
  visible,
  document,
  busy,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  document: CaseDocumentDto | null;
  busy: boolean;
  onSelect: (status: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!document) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>{document.name}</Text>
          {DOCUMENT_STATUSES.map((s) => (
            <Pressable key={s} style={styles.option} disabled={busy} onPress={() => onSelect(s)}>
              <Text style={[styles.optionText, document.status === s && styles.optionTextCurrent]}>{DOCUMENT_STATUS_LABELS[s]}</Text>
              {document.status === s ? <Feather name="check" size={16} color={colors.primary} /> : null}
            </Pressable>
          ))}
          <Pressable style={styles.cancelRow} onPress={onCancel}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.xs },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },

    rejectionBanner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.destructiveLight, borderRadius: 10, padding: spacing.md },
    rejectionText: { flex: 1, fontSize: fontSize.base, color: colors.destructive },

    linkText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },
    assignRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    assignInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.card },

    applicantRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: 2 },
    applicantName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    applicantMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },

    docRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm },
    docName: { flex: 1, fontSize: fontSize.base, color: colors.foreground, marginRight: spacing.sm },
    emptyText: { fontSize: fontSize.base, color: colors.mutedForeground },

    noteRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" },
    noteInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm + 2, minHeight: 40, backgroundColor: colors.card, textAlignVertical: "top", fontSize: fontSize.base, color: colors.foreground },
    bodyText: { fontSize: fontSize.base, color: colors.foreground, fontStyle: "italic" },

    timelineRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: 2 },
    timelineText: { fontSize: fontSize.base, color: colors.foreground },
    timelineMeta: { fontSize: fontSize.xs, color: colors.subtleForeground },

    movesRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
    sheetTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    sheetBody: { fontSize: fontSize.base, color: colors.mutedForeground },
    sheetInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm + 2, minHeight: 44, backgroundColor: colors.background, textAlignVertical: "top", fontSize: fontSize.base, color: colors.foreground },
    sheetActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },

    option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.border },
    optionText: { fontSize: fontSize.base, color: colors.foreground },
    optionTextCurrent: { fontWeight: fontWeight.semibold, color: colors.primary },
    cancelRow: { paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xs },
    cancelText: { fontSize: fontSize.base, color: colors.mutedForeground, fontWeight: fontWeight.medium },
  });
}
