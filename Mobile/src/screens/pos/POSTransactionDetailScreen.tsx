import { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTransaction } from "@/hooks/use-pos";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import type { POSStackParamList } from "@/navigation/types";
import { Badge, DetailRow, ErrorState, LoadingState, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<POSStackParamList, "POSTransactionDetail">;

export default function POSTransactionDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const { transactionId, transactionNumber } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: transactionNumber });
  }, [navigation, transactionNumber]);

  const transaction = useTransaction(transactionId);

  if (transaction.isLoading || !transaction.data) {
    return <LoadingState />;
  }
  if (transaction.isError) {
    return <ErrorState message="Couldn't load this transaction." onRetry={() => transaction.refetch()} />;
  }

  const t = transaction.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.number}>{t.transactionNumber}</Text>
          <Badge label={t.status} tone={t.status.toLowerCase().includes("void") ? "destructive" : "success"} />
        </View>
        <Text style={styles.total}>{formatCompactValue(t.totalAmount, currency)}</Text>
        <Text style={styles.subtitle}>{t.customerName ?? "Walk-in"} · {t.completedAt}</Text>
      </View>

      <SectionCard title={`Items (${t.lineItems.length})`}>
        {t.lineItems.map((li) => (
          <View key={li.id} style={styles.lineItem}>
            <Text style={styles.lineName} numberOfLines={1}>{li.productName}</Text>
            <Text style={styles.lineMeta}>
              {li.quantity} × {formatCompactValue(li.unitPrice, currency)} = {formatCompactValue(li.lineTotal, currency)}
            </Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Totals">
        <DetailRow label="Subtotal" value={formatCompactValue(t.subTotal, currency)} />
        {t.discountAmount > 0 ? <DetailRow label="Discount" value={`-${formatCompactValue(t.discountAmount, currency)}`} /> : null}
        <DetailRow label="Tax" value={formatCompactValue(t.taxAmount, currency)} />
        <DetailRow label="Total" value={formatCompactValue(t.totalAmount, currency)} />
        <DetailRow label="Paid" value={formatCompactValue(t.amountPaid, currency)} />
        {t.changeGiven > 0 ? <DetailRow label="Change given" value={formatCompactValue(t.changeGiven, currency)} /> : null}
      </SectionCard>

      {t.payments.length > 0 ? (
        <SectionCard title="Payments">
          {t.payments.map((p) => (
            <DetailRow key={p.id} label={p.method} value={formatCompactValue(p.amount, currency)} />
          ))}
        </SectionCard>
      ) : null}

      {t.notes ? (
        <SectionCard title="Notes">
          <Text style={styles.notes}>{t.notes}</Text>
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: 4 },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    number: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
    total: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground, marginTop: 2 },
    subtitle: { fontSize: fontSize.sm, color: colors.mutedForeground },

    lineItem: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingVertical: spacing.sm, gap: 2 },
    lineName: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.foreground },
    lineMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },

    notes: { fontSize: fontSize.base, color: colors.foreground },
  });
}
