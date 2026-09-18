import { useEffect, useMemo } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSession, useSessionCashMovements, useSessionTransactions } from "@/hooks/use-pos";
import { formatCompactValue } from "@/lib/crm-helpers";
import { POS_SESSIONS_CREATE, POS_TRANSACTIONS_CREATE } from "@/lib/pos.api";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import type { POSTransactionSummaryDto } from "@/types/pos";
import type { POSStackParamList } from "@/navigation/types";
import { Badge, Button, DetailRow, ErrorState, ListItemCard, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<POSStackParamList, "POSSessionDetail">;

export default function POSSessionDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const canSell = hasPermission(POS_TRANSACTIONS_CREATE);
  const canCloseShift = hasPermission(POS_SESSIONS_CREATE);
  const { sessionId, registerId } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: `Register ${registerId}` });
  }, [navigation, `Register ${registerId}`]);

  const session = useSession(sessionId);
  const transactions = useSessionTransactions(sessionId, 1, 20);
  const cashMovements = useSessionCashMovements(sessionId);

  if (session.isLoading || !session.data) {
    return <LoadingState />;
  }
  if (session.isError) {
    return <ErrorState message="Couldn't load this shift." onRetry={() => session.refetch()} />;
  }

  const s = session.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Register {s.registerId}</Text>
          <Badge label={s.status === "Open" || s.status === "open" ? "Open" : s.status} tone={s.closedAt ? "neutral" : "success"} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Net sales" value={formatCompactValue(s.netSales, currency)} tone="primary" />
          <Stat label="Transactions" value={String(s.totalTransactions)} />
        </View>
      </View>

      {!s.closedAt && (canSell || canCloseShift) ? (
        <View style={styles.actionsRow}>
          {canSell ? (
            <Button
              label="New Sale"
              icon="shopping-cart"
              onPress={() => navigation.navigate("NewSale", { sessionId })}
              style={styles.actionButton}
            />
          ) : null}
          {canCloseShift ? (
            <Button
              label="Close Shift"
              icon="lock"
              variant="outline"
              onPress={() => navigation.navigate("CloseShift", { sessionId })}
              style={styles.actionButton}
            />
          ) : null}
        </View>
      ) : null}

      <SectionCard title="Cash">
        <DetailRow label="Opening cash" value={formatCompactValue(s.openingCash, currency)} />
        <DetailRow label="Expected cash" value={formatCompactValue(s.expectedCash, currency)} />
        {s.closedAt ? <DetailRow label="Closing cash" value={formatCompactValue(s.closingCash, currency)} /> : null}
        <DetailRow label="Variance" value={formatCompactValue(s.cashVariance, currency)} />
        <DetailRow label="Refunds" value={formatCompactValue(s.totalRefunds, currency)} />
      </SectionCard>

      <SectionCard title="Shift">
        <DetailRow label="Opened" value={s.openedAt} />
        {s.closedAt ? <DetailRow label="Closed" value={s.closedAt} /> : null}
        {s.notes ? <DetailRow label="Notes" value={s.notes} /> : null}
      </SectionCard>

      {(cashMovements.data ?? []).length > 0 ? (
        <SectionCard title="Cash movements">
          {(cashMovements.data ?? []).map((m) => (
            <View key={m.id} style={styles.movementRow}>
              <Text style={styles.movementReason} numberOfLines={1}>{m.reason}</Text>
              <Text style={[styles.movementAmount, m.type === "PayOut" && styles.movementAmountOut]}>
                {m.type === "PayOut" ? "-" : "+"}{formatCompactValue(m.amount, currency)}
              </Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      <SectionCard title={`Transactions (${transactions.data?.totalCount ?? s.totalTransactions})`}>
        {transactions.isLoading ? (
          <LoadingState size="small" />
        ) : (
          <FlatList
            data={transactions.data?.items ?? []}
            keyExtractor={(t) => t.id}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No transactions yet.</Text>}
            renderItem={({ item }) => (
              <TransactionRow
                tx={item}
                currency={currency}
                onPress={() => navigation.navigate("POSTransactionDetail", { transactionId: item.id, transactionNumber: item.transactionNumber })}
              />
            )}
          />
        )}
      </SectionCard>
    </ScrollView>
  );
}

function TransactionRow({ tx, currency, onPress }: { tx: POSTransactionSummaryDto; currency: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress} style={styles.txCard}>
      <View style={styles.rowTop}>
        <Text style={styles.txNumber} numberOfLines={1}>{tx.transactionNumber}</Text>
        <Text style={styles.txAmount}>{formatCompactValue(tx.totalAmount, currency)}</Text>
      </View>
      <Text style={styles.meta}>{tx.customerName ?? "Walk-in"} · {tx.primaryPaymentMethod}</Text>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.sm },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    statsRow: { flexDirection: "row", gap: spacing.xl },

    actionsRow: { flexDirection: "row", gap: spacing.sm },
    actionButton: { flex: 1 },

    movementRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    movementReason: { fontSize: fontSize.base, color: colors.foreground, flexShrink: 1 },
    movementAmount: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.success },
    movementAmountOut: { color: colors.destructive },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    txCard: { marginHorizontal: 0, marginBottom: spacing.sm },
    txNumber: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    txAmount: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    emptyText: { fontSize: fontSize.sm, color: colors.subtleForeground, textAlign: "center", paddingVertical: spacing.md },
  });
}
