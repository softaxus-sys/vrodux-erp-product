import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useGenerateRecurringNow, usePauseRecurring, useResumeRecurring } from "@/hooks/use-finance-ledger";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { RECURRENCE_FREQUENCY_LABELS } from "@/types/finance-ledger";
import type { FinanceStackParamList } from "@/navigation/types";
import { ApiError } from "@/lib/api-client";
import { Badge, Button, DetailRow, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<FinanceStackParamList, "RecurringInvoiceDetail">;

/** No `GET /recurring-invoices/{id}` exists on the backend -- the list DTO already carries
 *  `lines[]` in full, so the whole row is passed through navigation params. */
export default function RecurringInvoiceDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [recurring, setRecurring] = useState(route.params.recurring);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  useEffect(() => {
    navigation.setOptions({ headerTitle: recurring.templateName });
  }, [navigation, recurring.templateName]);

  const pause = usePauseRecurring();
  const resume = useResumeRecurring();
  const generateNow = useGenerateRecurringNow();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.name}>{recurring.templateName}</Text>
          <Badge label={recurring.isActive ? "Active" : "Paused"} tone={recurring.isActive ? "success" : "neutral"} />
        </View>
        <Text style={styles.customer}>{recurring.customerName}</Text>
        <View style={styles.statsRow}>
          <Stat label="Total" value={formatCompactValue(recurring.total, currency)} tone="primary" />
          <Stat label="Frequency" value={RECURRENCE_FREQUENCY_LABELS[recurring.frequency]} />
          <Stat label="Generated" value={String(recurring.generatedCount)} />
        </View>
      </View>

      <SectionCard title="Schedule">
        <DetailRow label="Next run" value={recurring.nextRunDate} />
        <DetailRow label="Start date" value={recurring.startDate} />
        {recurring.endDate ? <DetailRow label="End date" value={recurring.endDate} /> : null}
        <DetailRow label="Due days" value={`${recurring.dueDays} days`} />
        {recurring.lastGeneratedDate ? <DetailRow label="Last generated" value={recurring.lastGeneratedDate} /> : null}
        <DetailRow label="Auto-send" value={recurring.autoSend ? "Yes" : "No"} />
      </SectionCard>

      <SectionCard title={`Lines (${recurring.lines.length})`}>
        {recurring.lines.map((line) => (
          <View key={line.id} style={styles.line}>
            <Text style={styles.lineDescription} numberOfLines={1}>{line.description}</Text>
            <Text style={styles.lineAmount}>
              {line.quantity} × {formatCompactValue(line.unitPrice, currency)} = {formatCompactValue(line.quantity * line.unitPrice, currency)}
            </Text>
          </View>
        ))}
      </SectionCard>

      {recurring.notes ? (
        <SectionCard title="Notes">
          <Text style={styles.bodyText}>{recurring.notes}</Text>
        </SectionCard>
      ) : null}

      {generateResult ? (
        <View style={styles.resultBanner}>
          <Text style={styles.resultText}>{generateResult}</Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        {recurring.isActive ? (
          <Button
            label={pause.isPending ? "..." : "Pause"}
            variant="outline"
            loading={pause.isPending}
            onPress={() => pause.mutate(recurring.id, { onSuccess: () => setRecurring((r) => ({ ...r, isActive: false })) })}
            style={styles.actionButton}
          />
        ) : (
          <Button
            label={resume.isPending ? "..." : "Resume"}
            loading={resume.isPending}
            onPress={() => resume.mutate(recurring.id, { onSuccess: () => setRecurring((r) => ({ ...r, isActive: true })) })}
            style={styles.actionButton}
          />
        )}
        <Button
          label={generateNow.isPending ? "..." : "Generate now"}
          icon="zap"
          variant="secondary"
          loading={generateNow.isPending}
          onPress={() =>
            generateNow.mutate(recurring.id, {
              onSuccess: (res) => {
                const r = res as { invoiceNumber: string; emailed: boolean };
                setGenerateResult(`Generated ${r.invoiceNumber}${r.emailed ? " and emailed the customer." : "."}`);
              },
              onError: (err) => setGenerateResult(err instanceof ApiError ? err.message : "Could not generate an invoice."),
            })
          }
          style={styles.actionButton}
        />
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.sm },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground, flexShrink: 1 },
    customer: { fontSize: fontSize.md, color: colors.mutedForeground },
    statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.xs },

    line: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingVertical: spacing.sm, gap: 2 },
    lineDescription: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.foreground },
    lineAmount: { fontSize: fontSize.sm, color: colors.mutedForeground },

    bodyText: { fontSize: fontSize.md, color: colors.foreground },

    resultBanner: { backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.successLight, borderRadius: 10, padding: spacing.md },
    resultText: { fontSize: fontSize.sm, color: colors.success },

    actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    actionButton: { flex: 1, minWidth: 100 },
  });
}
