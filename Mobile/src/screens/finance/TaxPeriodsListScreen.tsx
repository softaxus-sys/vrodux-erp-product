import { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFileTaxPeriod, usePayTaxPeriod, useTaxPeriods, useTaxSummary } from "@/hooks/use-finance-ledger";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { TAX_PERIOD_STATUS_LABELS, TAX_PERIOD_STATUS_TONE, type TaxPeriodDto } from "@/types/finance-ledger";
import type { FinanceStackParamList } from "@/navigation/types";
import { Badge, Button, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<FinanceStackParamList, "TaxPeriodsList">;

export default function TaxPeriodsListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const query = useTaxPeriods();
  const summary = useTaxSummary();
  const fileMut = useFileTaxPeriod();
  const payMut = usePayTaxPeriod();

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Net VAT" value={formatCompactValue(summary.data.currentNetVat, currency)} />
          <SummaryTile label="YTD paid" value={formatCompactValue(summary.data.ytdVatPaid, currency)} />
          <SummaryTile label="Next due" value={summary.data.nextDueDate} />
        </View>
      ) : null}

      {query.isError ? (
        <ErrorState message="Couldn't load VAT periods." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={(query.data ?? []).length === 0 ? undefined : styles.list}
          ListEmptyComponent={<EmptyListState icon="percent" title="No VAT periods yet" />}
          renderItem={({ item }) => (
            <PeriodRow
              period={item}
              currency={currency}
              onPress={() => navigation.navigate("TaxPeriodDetail", { period: item.period, periodLabel: item.period })}
              onFile={item.status === "open" ? () => fileMut.mutate(item.id) : undefined}
              onPay={item.status === "filed" ? () => payMut.mutate(item.id) : undefined}
              busy={(fileMut.isPending && fileMut.variables === item.id) || (payMut.isPending && payMut.variables === item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function PeriodRow({
  period,
  currency,
  onPress,
  onFile,
  onPay,
  busy,
}: {
  period: TaxPeriodDto;
  currency: string;
  onPress: () => void;
  onFile?: () => void;
  onPay?: () => void;
  busy: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.period}>{period.period}</Text>
        <Badge label={TAX_PERIOD_STATUS_LABELS[period.status]} tone={TAX_PERIOD_STATUS_TONE[period.status]} />
      </View>
      <Text style={styles.meta}>{period.from} → {period.to} · due {period.dueDate}</Text>
      <View style={styles.figuresRow}>
        <Text style={styles.figure}>Output {formatCompactValue(period.outputVat, currency)}</Text>
        <Text style={styles.figure}>Input {formatCompactValue(period.inputVat, currency)}</Text>
        <Text style={styles.netFigure}>Net {formatCompactValue(period.netVat, currency)}</Text>
      </View>
      {(onFile || onPay) ? (
        <View style={styles.actionsRow}>
          {onFile ? <Button label={busy ? "..." : "File return"} size="sm" loading={busy} onPress={onFile} /> : null}
          {onPay ? <Button label={busy ? "..." : "Mark paid"} size="sm" variant="outline" loading={busy} onPress={onPay} /> : null}
        </View>
      ) : null}
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    summaryRow: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.lg },
    summaryTile: { flex: 1 },
    summaryLabel: { fontSize: fontSize.xs, color: colors.subtleForeground, textTransform: "uppercase" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground, marginTop: 2 },

    list: { paddingVertical: spacing.md },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    period: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    figuresRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xs },
    figure: { fontSize: fontSize.sm, color: colors.foregroundSecondary },
    netFigure: { fontSize: fontSize.sm, color: colors.foreground, fontWeight: fontWeight.semibold },
    actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  });
}
