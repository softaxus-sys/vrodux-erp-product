import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLgLedger, useLgWallet } from "@/hooks/use-leadgen";
import { lgLabel } from "@/lib/leadgen.api";
import { Button, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

export default function LgCreditsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [page, setPage] = useState(1);
  const wallet = useLgWallet();
  const ledger = useLgLedger(page);

  if (wallet.isLoading) return <LoadingState />;
  if (wallet.isError || !wallet.data) return <ErrorState message="Could not load your credits." onRetry={() => wallet.refetch()} />;
  const w = wallet.data;
  const pages = ledger.data ? Math.max(1, Math.ceil(ledger.data.total / ledger.data.pageSize)) : 1;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.balance}>{w.balance}</Text>
        <Text style={styles.sub}>credits available</Text>
        <View style={styles.stats}>
          <Stat label="Bought" value={String(w.lifetimePurchased)} />
          <Stat label="Used" value={String(w.lifetimeSpent)} />
          <Stat label="Refunded" value={String(w.lifetimeRefunded)} />
        </View>
      </View>
      <Text style={styles.sub}>
        Revealing a contact costs {w.revealCost} credit(s)
        {w.verifiedEmailBonus ? `, plus ${w.verifiedEmailBonus} for a verified email` : ""}. To buy more, open Billing in the web app.
      </Text>

      <SectionCard title="History">
        {ledger.isLoading ? (
          <LoadingState size="small" />
        ) : (ledger.data?.items ?? []).length === 0 ? (
          <Text style={styles.sub}>No activity yet.</Text>
        ) : (
          ledger.data!.items.map((e) => (
            <View key={e.id} style={styles.entry}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reason}>{lgLabel(e.type)} · {e.reason}</Text>
                <Text style={styles.sub}>{new Date(e.createdAt).toLocaleString()}</Text>
              </View>
              <Text style={[styles.amount, { color: e.amount >= 0 ? colors.success : colors.foreground }]}>
                {e.amount > 0 ? "+" : ""}{e.amount}
              </Text>
            </View>
          ))
        )}
        {pages > 1 ? (
          <View style={styles.pager}>
            <Button label="Newer" size="sm" variant="outline" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
            <Text style={styles.sub}>{page} / {pages}</Text>
            <Button label="Older" size="sm" variant="outline" disabled={page >= pages} onPress={() => setPage((p) => p + 1)} />
          </View>
        ) : null}
      </SectionCard>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    hero: { alignItems: "center", gap: spacing.xs },
    balance: { fontSize: 44, fontWeight: fontWeight.bold, color: colors.primary },
    stats: { flexDirection: "row", gap: spacing.xxl, marginTop: spacing.md },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
    entry: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
    reason: { fontSize: fontSize.base, color: colors.foreground },
    amount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  });
}
