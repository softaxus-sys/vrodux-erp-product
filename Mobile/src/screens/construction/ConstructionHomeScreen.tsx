import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useProjectsSummary, useSitesSummary } from "@/hooks/use-construction";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { ErrorState, LoadingState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { ConstructionStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<ConstructionStackParamList, "ConstructionHome">;

/** Read-only browse for this pass -- see README's Construction section for what's deferred
 *  (the CRM-linked RFQ -> Estimate -> Contract bidding lifecycle is its own sub-feature). */
export default function ConstructionHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const projects = useProjectsSummary();
  const sites = useSitesSummary();

  const loading = projects.isLoading || sites.isLoading;
  const anyError = projects.isError || sites.isError;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Overview</Text>
      {loading ? (
        <LoadingState size="small" />
      ) : anyError ? (
        <ErrorState message="Couldn't load the overview." onRetry={() => { projects.refetch(); sites.refetch(); }} />
      ) : (
        <View style={styles.tileGrid}>
          {projects.data ? <Tile label="In progress" value={String(projects.data.inProgress)} tone={colors.primary} /> : null}
          {projects.data ? <Tile label="Avg completion" value={`${Math.round(projects.data.avgCompletion)}%`} tone={colors.info} /> : null}
          {projects.data ? <Tile label="Contract value" value={formatCompactValue(projects.data.totalContractValue, currency)} tone={colors.success} /> : null}
          {sites.data ? <Tile label="Active sites" value={String(sites.data.active)} tone={colors.success} /> : null}
          {sites.data ? <Tile label="Total workers" value={String(sites.data.totalWorkers)} tone={colors.info} /> : null}
          {sites.data ? <Tile label="Permits expiring" value={String(sites.data.permitsExpiringSoon)} tone={colors.warning} /> : null}
        </View>
      )}

      <View style={styles.menu}>
        <MenuCard icon="briefcase" title="Projects" subtitle="Contract value, budget, and phases" tint={colors.primary} onPress={() => navigation.navigate("ProjectsList")} />
        <MenuCard icon="map-pin" title="Sites" subtitle="Location, safety score, permits" tint={colors.info} onPress={() => navigation.navigate("SitesList")} />
        <MenuCard icon="users" title="Contractors" subtitle="Trade partners and ratings" tint={colors.success} onPress={() => navigation.navigate("ContractorsList")} />
        <MenuCard icon="list" title="BOQs" subtitle="Bill of quantities per project" tint={colors.warning} onPress={() => navigation.navigate("BoqsList")} />
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
