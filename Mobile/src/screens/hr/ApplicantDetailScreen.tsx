import { useEffect, useMemo } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useApplicant, useUpdateApplicantStage } from "@/hooks/use-hr-recruitment";
import {
  APPLICANT_STAGE_LABELS,
  APPLICANT_STAGE_ORDER,
  APPLICANT_STAGE_TONE,
} from "@/types/hr-recruitment";
import type { HrStackParamList } from "@/navigation/types";
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<HrStackParamList, "ApplicantDetail">;

export default function ApplicantDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { applicantId, applicantName } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: applicantName });
  }, [navigation, applicantName]);

  const applicant = useApplicant(applicantId);
  const updateStage = useUpdateApplicantStage();

  if (applicant.isLoading || !applicant.data) {
    return <LoadingState />;
  }
  if (applicant.isError) {
    return <ErrorState message="Couldn't load this applicant." onRetry={() => applicant.refetch()} />;
  }

  const a = applicant.data;
  const currentIndex = APPLICANT_STAGE_ORDER.indexOf(a.stage as (typeof APPLICANT_STAGE_ORDER)[number]);
  const nextStage = currentIndex >= 0 && currentIndex < APPLICANT_STAGE_ORDER.length - 1 ? APPLICANT_STAGE_ORDER[currentIndex + 1] : null;
  const isTerminal = a.stage === "hired" || a.stage === "rejected";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.name}>{a.name}</Text>
          <Badge label={APPLICANT_STAGE_LABELS[a.stage]} tone={APPLICANT_STAGE_TONE[a.stage]} />
        </View>
        <Text style={styles.subtitle}>
          {[a.currentRole, a.currentCompany].filter(Boolean).join(" @ ") || "—"}
        </Text>
        <Text style={styles.appliedFor}>Applied for {a.jobTitle}</Text>
        <View style={styles.statsRow}>
          <Stat label="Experience" value={`${a.experience} yrs`} />
          {a.rating != null ? <Stat label="Rating" value={"★".repeat(a.rating)} /> : null}
          <Stat label="Applied" value={a.appliedDate} />
        </View>
      </View>

      <SectionCard title="Pipeline">
        <View style={styles.pipelineRow}>
          {APPLICANT_STAGE_ORDER.map((stage, i) => (
            <View key={stage} style={styles.pipelineStep}>
              <View style={[styles.pipelineDot, i <= currentIndex && a.stage !== "rejected" && styles.pipelineDotDone]} />
              <Text style={[styles.pipelineLabel, i <= currentIndex && a.stage !== "rejected" && styles.pipelineLabelDone]}>
                {APPLICANT_STAGE_LABELS[stage]}
              </Text>
            </View>
          ))}
        </View>
        {!isTerminal ? (
          <View style={styles.actionsRow}>
            {nextStage ? (
              <Button
                label={updateStage.isPending && updateStage.variables?.stage === nextStage ? "..." : `Move to ${APPLICANT_STAGE_LABELS[nextStage]}`}
                icon="arrow-right"
                loading={updateStage.isPending && updateStage.variables?.stage === nextStage}
                onPress={() => updateStage.mutate({ id: a.id, stage: nextStage })}
                style={styles.actionButton}
              />
            ) : null}
            <Button
              label={updateStage.isPending && updateStage.variables?.stage === "rejected" ? "..." : "Reject"}
              variant="destructive"
              icon="x"
              loading={updateStage.isPending && updateStage.variables?.stage === "rejected"}
              onPress={() => updateStage.mutate({ id: a.id, stage: "rejected" })}
              style={styles.actionButton}
            />
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Contact">
        <View style={styles.contactActionsRow}>
          <Button label="Call" icon="phone" variant="outline" disabled={!a.phone} onPress={() => Linking.openURL(`tel:${a.phone}`)} style={styles.contactButton} />
          <Button label="Email" icon="mail" variant="outline" onPress={() => Linking.openURL(`mailto:${a.email}`)} style={styles.contactButton} />
        </View>
        <DetailRow label="Email" value={a.email} />
        {a.phone ? <DetailRow label="Phone" value={a.phone} /> : null}
        {a.nationality ? <DetailRow label="Nationality" value={a.nationality} /> : null}
        {a.source ? <DetailRow label="Source" value={a.source} /> : null}
        {a.hasResume ? (
          <View style={styles.resumeRow}>
            <Feather name="paperclip" size={14} color={colors.mutedForeground} />
            <Text style={styles.resumeText}>Resume on file</Text>
          </View>
        ) : null}
      </SectionCard>

      {a.notes ? (
        <SectionCard title="Notes">
          <Text style={styles.bodyText}>{a.notes}</Text>
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.sm },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground, flexShrink: 1 },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
    appliedFor: { fontSize: fontSize.sm, color: colors.subtleForeground },
    statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.xs },

    pipelineRow: { flexDirection: "row", justifyContent: "space-between" },
    pipelineStep: { alignItems: "center", flex: 1, gap: 4 },
    pipelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.muted },
    pipelineDotDone: { backgroundColor: colors.primary },
    pipelineLabel: { fontSize: fontSize.xs, color: colors.subtleForeground, textAlign: "center" },
    pipelineLabelDone: { color: colors.foreground, fontWeight: fontWeight.medium },

    actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    actionButton: { flex: 1 },

    contactActionsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xs },
    contactButton: { flex: 1 },

    resumeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    resumeText: { fontSize: fontSize.sm, color: colors.mutedForeground },

    bodyText: { fontSize: fontSize.base, color: colors.foreground },
  });
}
