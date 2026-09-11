import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useInvoice, useMarkInvoicePaid, useSendInvoice } from "@/hooks/use-finance";
import { FINANCE_INVOICING_EDIT } from "@/lib/finance.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasPermission } from "@/store/auth.store";
import { INVOICE_STATUS_LABELS } from "@/types/finance";
import { Button, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";
import type { FinanceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<FinanceStackParamList, "InvoiceDetail">;

const PAYABLE = new Set(["sent", "overdue", "partial"]);

export default function InvoiceDetailScreen({ route, navigation }: Props) {
  const { invoiceId, invoiceNumber } = route.params;
  navigation.setOptions({ headerTitle: invoiceNumber });
  const canEdit = hasPermission(FINANCE_INVOICING_EDIT);

  const invoice = useInvoice(invoiceId);
  const send = useSendInvoice();
  const markPaid = useMarkInvoicePaid();

  if (invoice.isLoading || !invoice.data) {
    return <LoadingState />;
  }
  if (invoice.isError) {
    return <ErrorState message="Couldn't load this invoice." onRetry={() => invoice.refetch()} />;
  }

  const inv = invoice.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{inv.customerName}</Text>
        <Text style={styles.subtitle}>{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</Text>
        <View style={styles.statsRow}>
          <Stat label="Subtotal" value={formatCompactValue(inv.subTotal, inv.currencyCode)} />
          <Stat label="Tax" value={formatCompactValue(inv.taxAmount, inv.currencyCode)} />
          <Stat label="Total" value={formatCompactValue(inv.total, inv.currencyCode)} tone="primary" />
          <Stat label="Due" value={inv.dueDate} />
        </View>
      </View>

      {inv.notes ? (
        <SectionCard title="Notes">
          <Text style={styles.bodyText}>{inv.notes}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title={`Items (${inv.items.length})`}>
        {inv.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemDescription} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.itemMeta}>
              {item.quantity} × {formatCompactValue(item.unitPrice, inv.currencyCode)} ·{" "}
              {formatCompactValue(item.lineTotal, inv.currencyCode)}
            </Text>
          </View>
        ))}
      </SectionCard>

      {canEdit && (inv.status === "draft" || PAYABLE.has(inv.status)) ? (
        <SectionCard title="Actions">
          <View style={styles.actionsRow}>
            {inv.status === "draft" ? (
              <Button label={send.isPending ? "..." : "Send"} disabled={send.isPending} onPress={() => send.mutate(inv.id)} />
            ) : null}
            {PAYABLE.has(inv.status) ? (
              <Button label={markPaid.isPending ? "..." : "Mark Paid"} disabled={markPaid.isPending} onPress={() => markPaid.mutate(inv.id)} />
            ) : null}
          </View>
          {send.isError || markPaid.isError ? <Text style={styles.errorText}>That didn&apos;t go through.</Text> : null}
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

  bodyText: { fontSize: fontSize.md, color: colors.foreground },

  itemRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: spacing.xs },
  itemDescription: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
  itemMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },

  actionsRow: { flexDirection: "row", gap: spacing.sm },
});
