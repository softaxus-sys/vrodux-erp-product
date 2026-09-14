import { useMemo } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useActiveSessions, usePosDashboard } from "@/hooks/use-pos";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import type { POSSessionSummaryDto } from "@/types/pos";
import type { POSStackParamList } from "@/navigation/types";
import { Badge, EmptyState, ErrorState, ListItemCard, LoadingState, MenuCard, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<POSStackParamList, "POSHome">;

/** "Manager visibility," not a checkout terminal -- see types/pos.ts's own top-of-file note for
 *  why sale/void/refund/session-open/close deliberately have no mobile screen at all. */
export default function POSHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const dashboard = usePosDashboard();
  const sessions = useActiveSessions();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Today</Text>
      {dashboard.isLoading ? (
        <LoadingState size="small" />
      ) : dashboard.isError ? (
        <ErrorState message="Couldn't load today's summary." onRetry={() => dashboard.refetch()} />
      ) : dashboard.data ? (
        <View style={styles.dashboardRow}>
          <View style={styles.dashboardTile}>
            <Text style={styles.dashboardValue}>{formatCompactValue(dashboard.data.totalSales, currency)}</Text>
            <Text style={styles.dashboardLabel}>Total sales</Text>
          </View>
          <View style={styles.dashboardTile}>
            <Text style={styles.dashboardValue}>{dashboard.data.totalTransactions}</Text>
            <Text style={styles.dashboardLabel}>Transactions</Text>
          </View>
        </View>
      ) : null}

      {dashboard.data && dashboard.data.methods.length > 0 ? (
        <SectionCard title="Payment methods">
          {dashboard.data.methods.map((m) => (
            <View key={m.method} style={styles.methodRow}>
              <Text style={styles.methodName}>{m.method}</Text>
              <Text style={styles.methodStats}>{m.count} · {formatCompactValue(m.total, currency)}</Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      <Text style={styles.sectionLabel}>Open shifts</Text>
      {sessions.isLoading ? (
        <LoadingState size="small" />
      ) : sessions.isError ? (
        <ErrorState message="Couldn't load active shifts." onRetry={() => sessions.refetch()} />
      ) : (sessions.data ?? []).length === 0 ? (
        <EmptyState icon="pause-circle" title="No open shifts right now" />
      ) : (
        <FlatList
          data={sessions.data}
          keyExtractor={(s) => s.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <SessionRow
              session={item}
              currency={currency}
              onPress={() => navigation.navigate("POSSessionDetail", { sessionId: item.id, registerId: item.registerId })}
            />
          )}
        />
      )}

      <View style={styles.menu}>
        <MenuCard
          icon="list"
          title="All Transactions"
          subtitle="Search and filter every sale"
          tint={colors.primary}
          onPress={() => navigation.navigate("POSTransactionsList")}
        />
      </View>
    </ScrollView>
  );
}

function SessionRow({ session, currency, onPress }: { session: POSSessionSummaryDto; currency: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.registerName}>Register {session.registerId}</Text>
        <Badge label="Open" tone="success" />
      </View>
      <Text style={styles.meta}>Opened {session.openedAt}</Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>{session.totalTransactions} transactions</Text>
        <Text style={styles.statValue}>{formatCompactValue(session.netSales, currency)}</Text>
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    sectionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 },

    dashboardRow: { flexDirection: "row", gap: spacing.md },
    dashboardTile: { flex: 1, backgroundColor: colors.cardMuted, borderRadius: 12, padding: spacing.md },
    dashboardValue: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    dashboardLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    methodRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    methodName: { fontSize: fontSize.base, color: colors.foreground, textTransform: "capitalize" },
    methodStats: { fontSize: fontSize.sm, color: colors.mutedForeground },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    registerName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    rowBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
    stat: { fontSize: fontSize.sm, color: colors.foregroundSecondary },
    statValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },

    menu: { marginTop: spacing.sm },
  });
}
