import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useAccountingSummary, useAccounts } from "@/hooks/use-finance";
import { useAuthStore } from "@/store/auth.store";
import { formatCompactValue } from "@/lib/crm-helpers";
import type { AccountDto } from "@/types/finance";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

/** Read-only on mobile for this pass -- full create/edit/delete exists on the backend and web,
 *  but a chart-of-accounts editor is a desktop-appropriate task; a field accountant checking a
 *  balance is the mobile use case this serves. */
export default function AccountsListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const query = useAccounts();
  const summary = useAccountingSummary();

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const a of query.data ?? []) if (a.accountType) set.add(a.accountType);
    return Array.from(set).sort();
  }, [query.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? []).filter((a) => {
      if (!showInactive && !a.isActive) return false;
      if (type && a.accountType !== type) return false;
      if (!q) return true;
      return a.name.toLowerCase().includes(q) || a.accountNumber.toLowerCase().includes(q);
    });
  }, [query.data, search, type, showInactive]);

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryGrid}>
          <SummaryTile label="Assets" value={formatCompactValue(summary.data.totalAssets, currency)} />
          <SummaryTile label="Liabilities" value={formatCompactValue(summary.data.totalLiabilities, currency)} />
          <SummaryTile label="Equity" value={formatCompactValue(summary.data.totalEquity, currency)} />
          <SummaryTile
            label="Net profit"
            value={formatCompactValue(summary.data.netProfit, currency)}
            tone={summary.data.netProfit >= 0 ? "success" : "destructive"}
          />
        </View>
      ) : null}

      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name or account number…" />

      <View style={styles.filterRow}>
        <Chip label="Show inactive" active={showInactive} onPress={() => setShowInactive((v) => !v)} />
      </View>
      {types.length > 0 ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeRow}
          contentContainerStyle={styles.typeRowContent}
          data={["__all__", ...types]}
          keyExtractor={(t) => t}
          renderItem={({ item }) => (
            <Chip
              label={item === "__all__" ? "All types" : item}
              active={item === "__all__" ? type === null : type === item}
              onPress={() => setType(item === "__all__" ? null : item)}
            />
          )}
        />
      ) : null}

      {query.isError ? (
        <ErrorState message="Couldn't load accounts." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          contentContainerStyle={filtered.length === 0 ? undefined : styles.list}
          ListEmptyComponent={<EmptyListState icon="book" title="No accounts match" />}
          renderItem={({ item }) => <AccountRow account={item} currency={currency} />}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === "success" && { color: colors.success }, tone === "destructive" && { color: colors.destructive }]}>
        {value}
      </Text>
    </View>
  );
}

function AccountRow({ account, currency }: { account: AccountDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>{account.name}</Text>
        <Text style={[styles.balance, account.balance < 0 && styles.balanceNegative]}>
          {formatCompactValue(account.balance, currency)}
        </Text>
      </View>
      <View style={styles.rowBottom}>
        <Text style={styles.meta}>{account.accountNumber} · {account.accountType}</Text>
        {!account.isActive ? <Badge label="Inactive" tone="neutral" /> : null}
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    summaryGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
    summaryTile: { minWidth: "45%", flexGrow: 1 },
    summaryLabel: { fontSize: fontSize.xs, color: colors.subtleForeground, textTransform: "uppercase" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground, marginTop: 2 },

    filterRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.xs },
    typeRow: { maxHeight: 40 },
    typeRowContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },

    list: { paddingVertical: spacing.md },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    balance: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    balanceNegative: { color: colors.destructive },
    rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
