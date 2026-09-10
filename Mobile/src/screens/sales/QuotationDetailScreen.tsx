import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { colors, fontSize, fontWeight, radius, spacing } from "@/theme";
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
    return <LoadingState />;
  }
  if (quotation.isError) {
    return <ErrorState message="Couldn't load this quotation." onRetry={() => quotation.refetch()} />;
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
          <Stat label="Total" value={formatCompactValue(q.total, q.currencyCode)} tone="primary" />
          {q.optionalTotal > 0 ? (
            <Stat label="+ Optional" value={formatCompactValue(q.optionalTotal, q.currencyCode)} />
          ) : null}
          {q.validUntil ? <Stat label="Valid until" value={q.validUntil} /> : null}
        </View>
      </View>

      <SectionCard title="Delivery">
        <DetailRow label="Sent" value={q.sentAt ? new Date(q.sentAt).toLocaleString() : "Not yet sent"} />
        <DetailRow label="Viewed" value={q.viewedAt ? new Date(q.viewedAt).toLocaleString() : "—"} />
        <DetailRow
          label="Responded"
          value={q.respondedAt ? `${new Date(q.respondedAt).toLocaleString()}${q.respondedByName ? ` by ${q.respondedByName}` : ""}` : "—"}
        />
        {q.responseComment ? <Text style={styles.bodyText}>&quot;{q.responseComment}&quot;</Text> : null}
      </SectionCard>

      {q.convertedOrderId ? (
        <SectionCard title="Converted">
          <Text style={styles.bodyText}>This quotation has been converted to a sales order.</Text>
        </SectionCard>
      ) : null}

      <SectionCard title={`Line items (${q.items.length})`}>
        {q.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemTop}>
              <Text style={styles.itemDescription} numberOfLines={2}>
                {item.description}
              </Text>
              {item.isOptional ? <Badge label="Optional" tone="neutral" dot={false} /> : null}
            </View>
            <Text style={styles.itemMeta}>
              {item.quantity} {item.unit ?? ""} × {formatCompactValue(item.unitPrice, q.currencyCode)} ·{" "}
              {formatCompactValue(item.lineTotal, q.currencyCode)}
            </Text>
          </View>
        ))}
      </SectionCard>

      {canEdit ? (
        <SectionCard title="Actions">
          <View style={styles.actionsRow}>
            {SENDABLE.has(q.status) ? (
              <Button
                label={send.isPending ? "..." : q.sentAt ? "Resend" : "Send"}
                disabled={send.isPending}
                onPress={() => send.mutate({ id: q.id })}
              />
            ) : null}
            {q.status === "accepted" && !q.convertedOrderId ? (
              <Button
                label={convert.isPending ? "..." : "Convert to Order"}
                disabled={convert.isPending}
                onPress={() => convert.mutate(q.id)}
              />
            ) : null}
          </View>

          {RESPONDABLE.has(q.status) ? (
            respondingType ? (
              <View style={styles.respondForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Comment (optional)"
                  placeholderTextColor={colors.subtleForeground}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  autoFocus
                />
                <View style={styles.actionsRow}>
                  <Button
                    label={respond.isPending ? "..." : `Confirm ${respondingType === "accept" ? "accepted" : "declined"}`}
                    variant={respondingType === "accept" ? "primary" : "destructive"}
                    disabled={respond.isPending}
                    onPress={() => submitRespond(respondingType === "accept")}
                  />
                  <Button label="Cancel" variant="ghost" onPress={() => { setRespondingType(null); setComment(""); }} />
                </View>
              </View>
            ) : (
              <View style={[styles.actionsRow, styles.respondRow]}>
                <Text style={styles.notes}>Record the customer&apos;s off-platform decision:</Text>
                <Button label="Accepted" variant="secondary" onPress={() => setRespondingType("accept")} />
                <Button label="Declined" variant="outline" onPress={() => setRespondingType("decline")} />
              </View>
            )
          ) : null}

          {send.isError || respond.isError || convert.isError ? (
            <Text style={styles.errorText}>That action didn&apos;t go through. Try again.</Text>
          ) : null}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  errorText: { color: colors.destructive, fontSize: fontSize.sm },

  header: { gap: spacing.xs },
  name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
  subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },

  bodyText: { fontSize: fontSize.sm, color: colors.foreground, fontStyle: "italic" },
  notes: { fontSize: fontSize.sm, color: colors.mutedForeground },

  itemRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: spacing.xs },
  itemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  itemDescription: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
  itemMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },

  actionsRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  respondRow: { marginTop: spacing.sm },

  respondForm: { gap: spacing.sm, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    minHeight: 44,
    backgroundColor: colors.card,
    textAlignVertical: "top",
    fontSize: fontSize.base,
    color: colors.foreground,
  },
});
