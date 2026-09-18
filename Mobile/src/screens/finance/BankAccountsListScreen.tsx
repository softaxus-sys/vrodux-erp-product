import { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useBankAccounts, useBankingSummary } from "@/hooks/use-finance";
import { formatCompactValue } from "@/lib/crm-helpers";
import type { BankAccountDto } from "@/types/finance";
import type { FinanceStackParamList } from "@/navigation/types";
import { Badge, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<FinanceStackParamList, "BankAccountsList">;

export default function BankAccountsListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const query = useBankAccounts();
  const summary = useBankingSummary();

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Total balance" value={formatCompactValue(summary.data.totalBalance, "")} />
          <SummaryTile label="Accounts" value={String(summary.data.totalAccounts)} />
          <SummaryTile label="Unreconciled" value={String(summary.data.unreconciled)} tone={summary.data.unreconciled > 0 ? "warning" : undefined} />
        </View>
      ) : null}

      {query.isError ? (
        <ErrorState message="Couldn't load bank accounts." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={(query.data ?? []).length === 0 ? undefined : styles.list}
          ListEmptyComponent={<EmptyListState icon="credit-card" title="No bank accounts yet" />}
          renderItem={({ item }) => (
            <BankAccountRow account={item} onPress={() => navigation.navigate("BankAccountDetail", { accountId: item.id, accountName: item.accountName })} />
          )}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === "warning" && { color: colors.warning }]}>{value}</Text>
    </View>
  );
}

function BankAccountRow({ account, onPress }: { account: BankAccountDto; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>{account.accountName}</Text>
        <Badge label={account.status === "active" ? "Active" : "Inactive"} tone={account.status === "active" ? "success" : "neutral"} />
      </View>
      <Text style={styles.meta}>{account.bankName} · {account.accountType === "current" ? "Current" : "Savings"}</Text>
      <View style={styles.rowBottom}>
        <Text style={styles.balance}>{formatCompactValue(account.balance, account.currency)}</Text>
        {account.availableBalance !== account.balance ? (
          <Text style={styles.available}>{formatCompactValue(account.availableBalance, account.currency)} available</Text>
        ) : null}
      </View>
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
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
    balance: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    available: { fontSize: fontSize.xs, color: colors.mutedForeground },
  });
}
