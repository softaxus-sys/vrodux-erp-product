import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEducationSummary } from "@/hooks/use-education";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { ErrorState, LoadingState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { EducationStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<EducationStackParamList, "EducationHome">;

/** Read-only browse for this pass -- see README's Education section for what's deferred. */
export default function EducationHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const summary = useEducationSummary();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Overview</Text>
      {summary.isLoading ? (
        <LoadingState size="small" />
      ) : summary.isError ? (
        <ErrorState message="Couldn't load the overview." onRetry={() => summary.refetch()} />
      ) : summary.data ? (
        <View style={styles.tileGrid}>
          <Tile label="Open inquiries" value={String(summary.data.openInquiries)} tone={colors.primary} />
          <Tile label="Admissions" value={String(summary.data.totalAdmissions)} tone={colors.info} />
          <Tile label="Enrolled students" value={String(summary.data.enrolledStudents)} tone={colors.success} />
          <Tile label="Active enrollments" value={String(summary.data.activeEnrollments)} tone={colors.success} />
          <Tile label="Fees collected" value={formatCompactValue(summary.data.feesCollected, currency)} tone={colors.success} />
          <Tile label="Fees outstanding" value={formatCompactValue(summary.data.feesOutstanding, currency)} tone={colors.warning} />
        </View>
      ) : null}

      <View style={styles.menu}>
        <MenuCard icon="user-plus" title="Admissions" subtitle="Applicants working through the pipeline" tint={colors.primary} onPress={() => navigation.navigate("AdmissionsList")} />
        <MenuCard icon="users" title="Students" subtitle="Enrolled student directory" tint={colors.info} onPress={() => navigation.navigate("StudentsList")} />
        <MenuCard icon="book-open" title="Enrollments" subtitle="Course enrollments and fee status" tint={colors.success} onPress={() => navigation.navigate("EnrollmentsList")} />
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
