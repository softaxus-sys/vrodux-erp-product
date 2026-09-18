import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useVisaDashboard, useVisaRenewals } from "@/hooks/use-visa";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { ErrorState, LoadingState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { VisaStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<VisaStackParamList, "VisaHome">;

export default function VisaHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const dashboard = useVisaDashboard();
  const renewals = useVisaRenewals(30); // matches the urgency window a home screen should flag

  const upcoming = renewals.data?.length ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Overview</Text>
      {dashboard.isLoading ? (
        <LoadingState size="small" />
      ) : dashboard.isError ? (
        <ErrorState message="Couldn't load the dashboard." onRetry={() => dashboard.refetch()} />
      ) : dashboard.data ? (
        <View style={styles.tileGrid}>
          <Tile label="Open cases" value={String(dashboard.data.openCases)} tone={colors.primary} />
          <Tile label="Overdue" value={String(dashboard.data.overdueCases)} tone={colors.destructive} />
          <Tile label="Due this week" value={String(dashboard.data.dueThisWeek)} tone={colors.warning} />
          <Tile label="Open fees" value={formatCompactValue(dashboard.data.openServiceFees + dashboard.data.openGovtFees, currency)} tone={colors.info} />
        </View>
      ) : null}

      {upcoming > 0 ? (
        <View style={styles.renewalBanner}>
          <Text style={styles.renewalText}>
            {upcoming} passport, document, or visa expiry{upcoming === 1 ? "" : "ies"} in the next 30 days
          </Text>
        </View>
      ) : null}

      <View style={styles.menu}>
        <MenuCard icon="folder" title="Cases" subtitle="Every case, filterable by status" tint={colors.primary} onPress={() => navigation.navigate("CasesList")} />
        <MenuCard icon="calendar" title="Renewals" subtitle="Expiring visas, passports, documents" tint={colors.warning} onPress={() => navigation.navigate("RenewalsList")} />
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
    tileValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
    tileLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    renewalBanner: { backgroundColor: colors.warningLight, borderRadius: 10, padding: spacing.md },
    renewalText: { fontSize: fontSize.base, color: colors.warning, fontWeight: fontWeight.semibold },

    menu: { gap: spacing.sm, marginTop: spacing.sm },
  });
}
