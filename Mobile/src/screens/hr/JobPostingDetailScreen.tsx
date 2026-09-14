import { useMemo } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useApplicants } from "@/hooks/use-hr-recruitment";
import { useJobPosting, useUpdateJobStatus } from "@/hooks/use-hr-recruitment";
import { formatCompactValue } from "@/lib/crm-helpers";
import {
  APPLICANT_STAGE_LABELS,
  APPLICANT_STAGE_TONE,
  JOB_STATUS_LABELS,
  JOB_STATUS_TONE,
  type ApplicantDto,
  type JobStatus,
} from "@/types/hr-recruitment";
import type { HrStackParamList } from "@/navigation/types";
import { Badge, Button, DetailRow, ErrorState, ListItemCard, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<HrStackParamList, "JobPostingDetail">;

const NEXT_STATUS: Record<JobStatus, JobStatus[]> = {
  draft: ["open"],
  open: ["on_hold", "closed"],
  on_hold: ["open", "closed"],
  closed: [],
};

export default function JobPostingDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { jobId, jobTitle } = route.params;
  navigation.setOptions({ headerTitle: jobTitle });

  const job = useJobPosting(jobId);
  const applicants = useApplicants({ jobId, pageSize: 50 });
  const updateStatus = useUpdateJobStatus();

  if (job.isLoading || !job.data) {
    return <LoadingState />;
  }
  if (job.isError) {
    return <ErrorState message="Couldn't load this job posting." onRetry={() => job.refetch()} />;
  }

  const j = job.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{j.title}</Text>
          <Badge label={JOB_STATUS_LABELS[j.status]} tone={JOB_STATUS_TONE[j.status]} />
        </View>
        <Text style={styles.subtitle}>{j.department} · {j.branch}</Text>
        <View style={styles.statsRow}>
          <Stat label="Salary" value={`${formatCompactValue(j.salaryMin, j.currency)}–${formatCompactValue(j.salaryMax, j.currency)}`} />
          <Stat label="Headcount" value={String(j.headcount)} />
          <Stat label="Applicants" value={String(j.applicants)} />
        </View>
      </View>

      {NEXT_STATUS[j.status].length > 0 ? (
        <View style={styles.actionsRow}>
          {NEXT_STATUS[j.status].map((next) => (
            <Button
              key={next}
              label={updateStatus.isPending ? "..." : JOB_STATUS_LABELS[next]}
              size="sm"
              variant={next === "closed" ? "outline" : "primary"}
              loading={updateStatus.isPending && updateStatus.variables?.status === next}
              onPress={() => updateStatus.mutate({ id: j.id, status: next })}
            />
          ))}
        </View>
      ) : null}

      <SectionCard title="Details">
        <DetailRow label="Type" value={j.type.replace("_", " ")} />
        <DetailRow label="Experience" value={j.experienceLevel} />
        <DetailRow label="Posted" value={j.postedDate} />
        {j.closingDate ? <DetailRow label="Closing" value={j.closingDate} /> : null}
        {j.hiringManager ? <DetailRow label="Hiring manager" value={j.hiringManager} /> : null}
      </SectionCard>

      {j.description ? (
        <SectionCard title="Description">
          <Text style={styles.bodyText}>{j.description}</Text>
        </SectionCard>
      ) : null}

      {j.requirements.length > 0 ? (
        <SectionCard title="Requirements">
          {j.requirements.map((r, i) => (
            <Text key={i} style={styles.listItem}>• {r}</Text>
          ))}
        </SectionCard>
      ) : null}

      {j.responsibilities.length > 0 ? (
        <SectionCard title="Responsibilities">
          {j.responsibilities.map((r, i) => (
            <Text key={i} style={styles.listItem}>• {r}</Text>
          ))}
        </SectionCard>
      ) : null}

      <SectionCard title={`Applicants (${applicants.data?.totalCount ?? j.applicants})`}>
        {applicants.isLoading ? (
          <LoadingState size="small" />
        ) : (
          <FlatList
            data={applicants.data?.items ?? []}
            keyExtractor={(a) => a.id}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No applicants yet.</Text>}
            renderItem={({ item }) => (
              <ApplicantRow applicant={item} onPress={() => navigation.navigate("ApplicantDetail", { applicantId: item.id, applicantName: item.name })} />
            )}
          />
        )}
      </SectionCard>
    </ScrollView>
  );
}

function ApplicantRow({ applicant, onPress }: { applicant: ApplicantDto; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress} style={styles.applicantCard}>
      <View style={styles.rowTop}>
        <Text style={styles.applicantName} numberOfLines={1}>{applicant.name}</Text>
        <Badge label={APPLICANT_STAGE_LABELS[applicant.stage]} tone={APPLICANT_STAGE_TONE[applicant.stage]} />
      </View>
      <Text style={styles.meta}>{[applicant.currentRole, applicant.currentCompany].filter(Boolean).join(" @ ") || applicant.email}</Text>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.sm },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground, flexShrink: 1 },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
    statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.xs },

    actionsRow: { flexDirection: "row", gap: spacing.sm },

    bodyText: { fontSize: fontSize.base, color: colors.foreground, lineHeight: 20 },
    listItem: { fontSize: fontSize.base, color: colors.foreground, lineHeight: 20 },

    applicantCard: { marginHorizontal: 0 },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    applicantName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    emptyText: { fontSize: fontSize.sm, color: colors.subtleForeground, textAlign: "center", paddingVertical: spacing.md },
  });
}
