import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useInsuranceSummary } from "@/hooks/use-insurance";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { ErrorState, LoadingState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { InsuranceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<InsuranceStackParamList, "InsuranceHome">;

/** Read-only browse for this pass -- see README's Insurance section for what's deferred. */
export default function InsuranceHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const summary = useInsuranceSummary();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Overview</Text>
      {summary.isLoading ? (
        <LoadingState size="small" />
      ) : summary.isError ? (
        <ErrorState message="Couldn't load the overview." onRetry={() => summary.refetch()} />
      ) : summary.data ? (
        <View style={styles.tileGrid}>
          <Tile label="Active policies" value={String(summary.data.activePolicies)} tone={colors.primary} />
          <Tile label="Premium in force" value={formatCompactValue(summary.data.premiumInForce, currency)} tone={colors.info} />
          <Tile label="Renewals due" value={String(summary.data.renewalsDue)} tone={colors.warning} />
          <Tile label="Open claims" value={String(summary.data.openClaims)} tone={colors.destructive} />
          <Tile label="Claims paid" value={formatCompactValue(summary.data.claimsPaid, currency)} tone={colors.success} />
        </View>
      ) : null}

      <View style={styles.menu}>
        <MenuCard icon="file-text" title="Policies" subtitle="Active and lapsed coverage" tint={colors.primary} onPress={() => navigation.navigate("PoliciesList")} />
        <MenuCard icon="refresh-cw" title="Renewals" subtitle="Policies coming up for renewal" tint={colors.warning} onPress={() => navigation.navigate("RenewalsList")} />
        <MenuCard icon="alert-circle" title="Claims" subtitle="Claims filed against a policy" tint={colors.destructive} onPress={() => navigation.navigate("ClaimsList")} />
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
