import { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTaxTransactions } from "@/hooks/use-finance-ledger";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import type { TaxTransactionDto } from "@/types/finance-ledger";
import type { FinanceStackParamList } from "@/navigation/types";
import { Badge, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<FinanceStackParamList, "TaxPeriodDetail">;

/** The transactions endpoint requires a period -- without it, every invoice/bill the tenant has
 *  ever issued gets read (a comment in the web client flags this explicitly). */
export default function TaxPeriodDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const { period, periodLabel } = route.params;
  navigation.setOptions({ headerTitle: periodLabel });

  const query = useTaxTransactions(period);

  return (
    <View style={styles.container}>
      {query.isError ? (
        <ErrorState message="Couldn't load transactions." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={(query.data ?? []).length === 0 ? undefined : styles.list}
          ListEmptyComponent={<EmptyListState icon="file-text" title="No transactions this period" />}
          renderItem={({ item }) => <TxRow tx={item} currency={currency} />}
        />
      )}
    </View>
  );
}

function TxRow({ tx, currency }: { tx: TaxTransactionDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.description} numberOfLines={1}>{tx.description}</Text>
        <Badge label={tx.type === "sale" ? "Sale" : "Purchase"} tone={tx.type === "sale" ? "success" : "info"} />
      </View>
      <Text style={styles.meta}>{tx.date} · {tx.reference}</Text>
      <View style={styles.figuresRow}>
        <Text style={styles.figure}>{formatCompactValue(tx.amount, currency)} net</Text>
        <Text style={styles.figure}>{formatCompactValue(tx.vatAmount, currency)} VAT ({tx.vatRate}%)</Text>
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list: { paddingVertical: spacing.md },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    description: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    figuresRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
    figure: { fontSize: fontSize.sm, color: colors.foregroundSecondary },
  });
}
