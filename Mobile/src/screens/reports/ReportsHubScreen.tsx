import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { REPORT_REGISTRY, resolveCountryCode } from "@/lib/reports.api";
import { hasModuleAccess, useAuthStore } from "@/store/auth.store";
import { Badge, EmptyState, ListItemCard, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { ReportCategory, ReportDef } from "@/types/reports";
import type { ReportsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<ReportsStackParamList, "ReportsHub">;

const CATEGORY_MODULE: Record<ReportCategory, string> = { POS: "pos", Inventory: "inventory" };

/** Country is derived from the tenant, never user-selectable here -- same call as
 *  FrontendVite/src/modules/reports/components/reports-view.tsx's own hub. CRM's 8 analytical
 *  reports are excluded entirely; see lib/reports.api.ts's top-of-file note for why. */
export default function ReportsHubScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tenant = useAuthStore((s) => s.tenant);
  const [search, setSearch] = useState("");

  const countryCode = useMemo(() => resolveCountryCode(tenant?.country, tenant?.currency), [tenant?.country, tenant?.currency]);

  const categories = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: { category: ReportCategory; reports: ReportDef[] }[] = [];
    for (const category of ["POS", "Inventory"] as ReportCategory[]) {
      if (!hasModuleAccess(CATEGORY_MODULE[category])) continue;
      const reports = REPORT_REGISTRY.filter((r) => {
        if (r.category !== category) return false;
        if (r.countries && !r.countries.includes(countryCode)) return false;
        if (q && !r.title.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
        return true;
      });
      if (reports.length > 0) out.push({ category, reports });
    }
    return out;
  }, [countryCode, search]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search reports…" />
      <Text style={styles.countryHint}>Showing universal reports plus those for {countryCode.toUpperCase()}</Text>

      {categories.length === 0 ? (
        <EmptyState icon="bar-chart-2" title="No reports available on your plan" />
      ) : (
        categories.map(({ category, reports }) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryLabel}>{category}</Text>
            {reports.map((r) => (
              <ReportRow key={r.id} report={r} onPress={() => navigation.navigate("ReportRunner", { reportId: r.id })} />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function ReportRow({ report, onPress }: { report: ReportDef; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <Text style={styles.title}>{report.title}</Text>
      <Text style={styles.description} numberOfLines={2}>
        {report.description}
      </Text>
      {(report.badges?.length || report.regulator) ? (
        <View style={styles.badgeRow}>
          {report.badges?.map((b) => (
            <Badge key={b} label={b} tone={b === "Required" ? "warning" : "info"} />
          ))}
          {report.regulator ? <Badge label={report.regulator} tone="neutral" /> : null}
        </View>
      ) : null}
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { paddingBottom: spacing.xl },
    countryHint: { fontSize: fontSize.xs, color: colors.subtleForeground, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },

    categorySection: { marginBottom: spacing.md },
    categoryLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },

    title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    description: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  });
}
