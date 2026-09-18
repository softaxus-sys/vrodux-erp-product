import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useHealthcareSummary } from "@/hooks/use-healthcare";
import { ErrorState, LoadingState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { HealthcareStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<HealthcareStackParamList, "HealthcareHome">;

/** Read-only browse for this pass -- see README's Healthcare section for what's deferred. */
export default function HealthcareHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const summary = useHealthcareSummary();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Overview</Text>
      {summary.isLoading ? (
        <LoadingState size="small" />
      ) : summary.isError ? (
        <ErrorState message="Couldn't load the overview." onRetry={() => summary.refetch()} />
      ) : summary.data ? (
        <View style={styles.tileGrid}>
          <Tile label="Patients" value={String(summary.data.patients)} tone={colors.primary} />
          <Tile label="Today's appointments" value={String(summary.data.todayAppointments)} tone={colors.info} />
          <Tile label="Scheduled" value={String(summary.data.scheduledAppointments)} tone={colors.warning} />
          <Tile label="Completed" value={String(summary.data.completedAppointments)} tone={colors.success} />
          <Tile label="Active treatments" value={String(summary.data.activeTreatments)} tone={colors.success} />
        </View>
      ) : null}

      <View style={styles.menu}>
        <MenuCard icon="users" title="Patients" subtitle="Patient directory" tint={colors.primary} onPress={() => navigation.navigate("PatientsList")} />
        <MenuCard icon="calendar" title="Appointments" subtitle="Scheduled visits by doctor" tint={colors.info} onPress={() => navigation.navigate("AppointmentsList")} />
        <MenuCard icon="activity" title="Treatment Plans" subtitle="Diagnoses and ongoing care plans" tint={colors.success} onPress={() => navigation.navigate("TreatmentPlansList")} />
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
