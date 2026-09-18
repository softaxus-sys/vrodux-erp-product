import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useB2BSummary } from "@/hooks/use-b2b";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { ErrorState, LoadingState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { B2BStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<B2BStackParamList, "B2BHome">;

/** Read-only browse for this pass -- see README's B2B section for what's deferred. */
export default function B2BHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const summary = useB2BSummary();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Overview</Text>
      {summary.isLoading ? (
        <LoadingState size="small" />
      ) : summary.isError ? (
        <ErrorState message="Couldn't load the overview." onRetry={() => summary.refetch()} />
      ) : summary.data ? (
        <View style={styles.tileGrid}>
          <Tile label="Open proposals" value={String(summary.data.openProposals)} tone={colors.primary} />
          <Tile label="Proposals value" value={formatCompactValue(summary.data.proposalsValue, currency)} tone={colors.info} />
          <Tile label="Active contracts" value={String(summary.data.activeContracts)} tone={colors.success} />
          <Tile label="Recurring revenue" value={formatCompactValue(summary.data.recurringRevenue, currency)} tone={colors.success} />
          <Tile label="Open tickets" value={String(summary.data.openTickets)} tone={colors.warning} />
          <Tile label="Critical tickets" value={String(summary.data.criticalTickets)} tone={colors.destructive} />
        </View>
      ) : null}

      <View style={styles.menu}>
        <MenuCard icon="file-text" title="Proposals" subtitle="Quotes sent to prospective clients" tint={colors.primary} onPress={() => navigation.navigate("ProposalsList")} />
        <MenuCard icon="clipboard" title="Service Contracts" subtitle="AMC, SLA, and retainer agreements" tint={colors.info} onPress={() => navigation.navigate("ContractsList")} />
        <MenuCard icon="life-buoy" title="Support Tickets" subtitle="Client issues raised under contract" tint={colors.warning} onPress={() => navigation.navigate("TicketsList")} />
      </View>
    </ScrollView>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color: tone }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    sectionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 },

    tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.cardMuted, borderRadius: 12, padding: spacing.md },
    tileValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    tileLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    menu: { gap: spacing.sm, marginTop: spacing.sm },
  });
}
