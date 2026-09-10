import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  useConvertQuotation,
  useQuotation,
  useRespondToQuotation,
  useSendQuotation,
} from "@/hooks/use-sales";
import { SALES_QUOTATIONS_EDIT } from "@/lib/sales.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { QUOTATION_STATUS_LABELS } from "@/types/sales";
import type { SalesStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<SalesStackParamList, "QuotationDetail">;

const RESPONDABLE = new Set(["sent", "viewed"]);
const SENDABLE = new Set(["draft", "sent", "viewed"]);

export default function QuotationDetailScreen({ route, navigation }: Props) {
  const { quotationId, quotationNumber } = route.params;
  navigation.setOptions({ headerTitle: quotationNumber });
  const userName = useAuthStore((s) => s.user?.fullName ?? "");
  const canEdit = hasPermission(SALES_QUOTATIONS_EDIT);

  const quotation = useQuotation(quotationId);
  const send = useSendQuotation();
  const respond = useRespondToQuotation();
  const convert = useConvertQuotation();

  const [respondingType, setRespondingType] = useState<"accept" | "decline" | null>(null);
  const [comment, setComment] = useState("");

  if (quotation.isLoading || !quotation.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (quotation.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn&apos;t load this quotation.</Text>
        <Pressable onPress={() => quotation.refetch()}>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const q = quotation.data;

  function submitRespond(accepted: boolean) {
    respond.mutate(
      { id: q.id, accepted, byName: userName, comment: comment.trim() || undefined },
      { onSuccess: () => { setRespondingType(null); setComment(""); } }
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{q.title || q.customerName || q.quotationNumber}</Text>
        <Text style={styles.subtitle}>
          {q.customerName ? `${q.customerName} · ` : ""}
          {QUOTATION_STATUS_LABELS[q.status] ?? q.status}
          {q.isExpired ? " · Expired" : ""}
        </Text>
        <View style={styles.statsRow}>
          <Stat label="Subtotal" value={formatCompactValue(q.subTotal, q.currencyCode)} />
          <Stat label="Tax" value={formatCompactValue(q.taxAmount, q.currencyCode)} />
          <Stat label="Total" value={formatCompactValue(q.total, q.currencyCode)} />
          {q.optionalTotal > 0 ? (
            <Stat label="+ Optional" value={formatCompactValue(q.optionalTotal, q.currencyCode)} />
          ) : null}
          {q.validUntil ? <Stat label="Valid until" value={q.validUntil} /> : null}
        </View>
      </View>

      <Section title="Delivery">
        <Detail label="Sent" value={q.sentAt ? new Date(q.sentAt).toLocaleString() : "Not yet sent"} />
        <Detail label="Viewed" value={q.viewedAt ? new Date(q.viewedAt).toLocaleString() : "—"} />
        <Detail
          label="Responded"
          value={q.respondedAt ? `${new Date(q.respondedAt).toLocaleString()}${q.respondedByName ? ` by ${q.respondedByName}` : ""}` : "—"}
        />
        {q.responseComment ? <Text style={styles.bodyText}>&quot;{q.responseComment}&quot;</Text> : null}
      </Section>

      {q.convertedOrderId ? (
        <Section title="Converted">
          <Text style={styles.bodyText}>This quotation has been converted to a sales order.</Text>
        </Section>
      ) : null}

      <Section title={`Line items (${q.items.length})`}>
        {q.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemTop}>
              <Text style={styles.itemDescription} numberOfLines={2}>
                {item.description}
              </Text>
              {item.isOptional ? <Text style={styles.optionalBadge}>Optional</Text> : null}
            </View>
            <Text style={styles.itemMeta}>
              {item.quantity} {item.unit ?? ""} × {formatCompactValue(item.unitPrice, q.currencyCode)} ·{" "}
              {formatCompactValue(item.lineTotal, q.currencyCode)}
            </Text>
          </View>
        ))}
      </Section>

      {canEdit ? (
        <Section title="Actions">
          <View style={styles.actionsRow}>
            {SENDABLE.has(q.status) ? (
              <Pressable style={styles.approveButton} disabled={send.isPending} onPress={() => send.mutate({ id: q.id })}>
                <Text style={styles.approveButtonText}>{send.isPending ? "..." : q.sentAt ? "Resend" : "Send"}</Text>
              </Pressable>
            ) : null}
            {q.status === "accepted" && !q.convertedOrderId ? (
              <Pressable style={styles.approveButton} disabled={convert.isPending} onPress={() => convert.mutate(q.id)}>
                <Text style={styles.approveButtonText}>{convert.isPending ? "..." : "Convert to Order"}</Text>
              </Pressable>
            ) : null}
          </View>

          {RESPONDABLE.has(q.status) ? (
            respondingType ? (
              <View style={styles.respondForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Comment (optional)"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  autoFocus
                />
                <View style={styles.actionsRow}>
                  <Pressable
                    style={respondingType === "accept" ? styles.approveButton : styles.rejectConfirm}
                    disabled={respond.isPending}
                    onPress={() => submitRespond(respondingType === "accept")}
                  >
                    <Text style={respondingType === "accept" ? styles.approveButtonText : styles.rejectConfirmText}>
                      {respond.isPending ? "..." : `Confirm ${respondingType === "accept" ? "accepted" : "declined"}`}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => { setRespondingType(null); setComment(""); }}>
                    <Text style={styles.cancelLink}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={[styles.actionsRow, styles.respondRow]}>
                <Text style={styles.notes}>Record the customer&apos;s off-platform decision:</Text>
                <Pressable style={styles.approveButton} onPress={() => setRespondingType("accept")}>
                  <Text style={styles.approveButtonText}>Accepted</Text>
                </Pressable>
                <Pressable style={styles.rejectButton} onPress={() => setRespondingType("decline")}>
                  <Text style={styles.rejectButtonText}>Declined</Text>
                </Pressable>
              </View>
            )
          ) : null}

          {send.isError || respond.isError || convert.isError ? (
            <Text style={styles.errorText}>That action didn&apos;t go through. Try again.</Text>
          ) : null}
        </Section>
      ) : null}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorText: { color: "#dc2626", fontSize: 12 },
  retry: { color: "#2563eb", fontWeight: "600" },

  header: { gap: 4 },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 8 },
  stat: {},
  statLabel: { fontSize: 11, color: "#9ca3af", textTransform: "uppercase" },
  statValue: { fontSize: 14, fontWeight: "600", color: "#111827" },

  section: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase" },
  bodyText: { fontSize: 13, color: "#111827", fontStyle: "italic" },
  notes: { fontSize: 13, color: "#6b7280" },

  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  detailLabel: { fontSize: 13, color: "#6b7280" },
  detailValue: { fontSize: 13, fontWeight: "600", color: "#111827" },

  itemRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8, marginTop: 4, gap: 2 },
  itemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  itemDescription: { fontSize: 14, fontWeight: "600", color: "#111827", flexShrink: 1 },
  itemMeta: { fontSize: 12, color: "#6b7280" },
  optionalBadge: { fontSize: 11, color: "#6b7280", backgroundColor: "#f3f4f6", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },

  actionsRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  respondRow: { marginTop: 8 },
  approveButton: { backgroundColor: "#111827", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  approveButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  rejectButton: { paddingHorizontal: 8, paddingVertical: 10 },
  rejectButtonText: { color: "#dc2626", fontWeight: "600", fontSize: 13 },
  rejectConfirm: { backgroundColor: "#dc2626", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  rejectConfirmText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cancelLink: { color: "#6b7280", fontSize: 13 },

  respondForm: { gap: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    minHeight: 44,
    backgroundColor: "#fff",
    textAlignVertical: "top",
    fontSize: 13,
  },
});
