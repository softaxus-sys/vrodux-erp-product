import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useBankAccounts, useBankTransactions, useReconcileTransaction } from "@/hooks/use-finance";
import { formatCompactValue } from "@/lib/crm-helpers";
import type { BankTransactionDto } from "@/types/finance";
import type { FinanceStackParamList } from "@/navigation/types";
import { Badge, Button, DetailRow, EmptyListState, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<FinanceStackParamList, "BankAccountDetail">;

const PAGE_SIZE = 30;

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

export default function BankAccountDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { accountId, accountName } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: accountName });
  }, [navigation, accountName]);

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BankTransactionDto[]>([]);

  // No dedicated GET /banking/accounts/{id} on the backend -- the accounts list already has
  // everything the header needs, so find this one in it rather than adding a second endpoint.
  const accounts = useBankAccounts();
  const account = accounts.data?.find((a) => a.id === accountId);

  const query = useBankTransactions({ accountId, page, pageSize: PAGE_SIZE });
  const reconcile = useReconcileTransaction();

  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (query.data.page === 1 ? query.data.items : [...prev, ...query.data.items]));
  }, [query.data]);

  const hasMore = query.data ? query.data.page < query.data.totalPages : false;
  function loadMore() {
    if (hasMore && !query.isFetching) setPage((p) => p + 1);
  }

  return (
    <View style={styles.container}>
      {account ? (
        <SectionCard title="Account">
          <View style={styles.statsRow}>
            <Stat label="Balance" value={formatCompactValue(account.balance, account.currency)} tone="primary" />
            <Stat label="Available" value={formatCompactValue(account.availableBalance, account.currency)} />
          </View>
          <DetailRow label="Bank" value={account.bankName} />
          <DetailRow label="IBAN" value={account.iban} />
          <DetailRow label="Account number" value={account.accountNumber} />
        </SectionCard>
      ) : null}

      {query.isError ? (
        <ErrorState message="Couldn't load transactions." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="list" title="No transactions yet" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <TransactionRow
              tx={item}
              currency={account?.currency ?? ""}
              onReconcile={() => reconcile.mutate(item.id)}
              reconciling={reconcile.isPending && reconcile.variables === item.id}
            />
          )}
        />
      )}
    </View>
  );
}

function TransactionRow({
  tx,
  currency,
  onReconcile,
  reconciling,
}: {
  tx: BankTransactionDto;
  currency: string;
  onReconcile: () => void;
  reconciling: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCredit = tx.type === "credit";
  return (
    <View style={styles.txCard}>
      <View style={styles.txTop}>
        <Text style={styles.txDescription} numberOfLines={1}>{tx.description}</Text>
        <Text style={[styles.txAmount, isCredit ? styles.txAmountCredit : styles.txAmountDebit]}>
          {isCredit ? "+" : "-"}{formatCompactValue(Math.abs(tx.amount), currency)}
        </Text>
      </View>
      <Text style={styles.txMeta}>{formatDate(tx.date)} · {tx.category}{tx.reference ? ` · ${tx.reference}` : ""}</Text>
      <View style={styles.txBottom}>
        {tx.reconciled ? (
          <Badge label="Reconciled" tone="success" />
        ) : (
          <Button label={reconciling ? "..." : "Reconcile"} size="sm" variant="outline" loading={reconciling} onPress={onReconcile} />
        )}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    statsRow: { flexDirection: "row", gap: spacing.xl, marginBottom: spacing.xs },

    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
    emptyList: { flexGrow: 1 },
    footerSpinner: { paddingVertical: spacing.lg },

    txCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
    txTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    txDescription: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    txAmount: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
    txAmountCredit: { color: colors.success },
    txAmountDebit: { color: colors.destructive },
    txMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    txBottom: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  });
}
