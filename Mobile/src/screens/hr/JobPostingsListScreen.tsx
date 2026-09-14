import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useJobPostings, useRecruitmentSummary } from "@/hooks/use-hr-recruitment";
import { formatCompactValue } from "@/lib/crm-helpers";
import { JOB_STATUS_LABELS, JOB_STATUS_TONE, type JobPostingDto, type JobStatus } from "@/types/hr-recruitment";
import type { HrStackParamList } from "@/navigation/types";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<HrStackParamList, "JobPostingsList">;

const PAGE_SIZE = 20;

const STATUS_FILTERS: { key: JobStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "on_hold", label: "On hold" },
  { key: "closed", label: "Closed" },
  { key: "draft", label: "Draft" },
];

export default function JobPostingsListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState<JobStatus | "all">("open");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<JobPostingDto[]>([]);

  const query = useJobPostings({ page, pageSize: PAGE_SIZE, status: status === "all" ? undefined : status });
  const summary = useRecruitmentSummary();

  useEffect(() => {
    setPage(1);
  }, [status]);

  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (query.data.page === 1 ? query.data.items : [...prev, ...query.data.items]));
  }, [query.data]);

  const hasMore = query.data ? query.data.page < query.data.totalPages : false;
  function loadMore() {
    if (hasMore && !query.isFetching) setPage((p) => p + 1);
  }

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Open" value={String(summary.data.openPositions)} />
          <SummaryTile label="Applicants" value={String(summary.data.totalApplicants)} />
          <SummaryTile label="In interview" value={String(summary.data.inInterview)} />
          <SummaryTile label="Hired (mo.)" value={String(summary.data.hiredThisMonth)} />
        </View>
      ) : null}

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
        data={STATUS_FILTERS}
        keyExtractor={(f) => f.key}
        renderItem={({ item }) => <Chip label={item.label} active={status === item.key} onPress={() => setStatus(item.key)} />}
      />

      {query.isError ? (
        <ErrorState message="Couldn't load job postings." onRetry={() => query.refetch()} />
      ) : query.isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(j) => j.id}
          contentContainerStyle={items.length === 0 ? undefined : styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyListState icon="briefcase" title="No job postings match" />}
          ListFooterComponent={hasMore && query.isFetching ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <JobRow job={item} onPress={() => navigation.navigate("JobPostingDetail", { jobId: item.id, jobTitle: item.title })} />
          )}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function JobRow({ job, onPress }: { job: JobPostingDto; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>{job.title}</Text>
        <Badge label={JOB_STATUS_LABELS[job.status]} tone={JOB_STATUS_TONE[job.status]} />
      </View>
      <Text style={styles.meta}>{job.department} · {job.branch}</Text>
      <View style={styles.rowBottom}>
        <Text style={styles.salary}>{formatCompactValue(job.salaryMin, job.currency)} – {formatCompactValue(job.salaryMax, job.currency)}</Text>
        <Text style={styles.applicants}>{job.applicants} applicants</Text>
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    summaryRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
    summaryTile: { minWidth: "22%" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    summaryLabel: { fontSize: fontSize.xs, color: colors.subtleForeground },

    filterRow: { maxHeight: 40 },
    filterRowContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },

    list: { paddingVertical: spacing.md },
    footerSpinner: { paddingVertical: spacing.lg },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
    salary: { fontSize: fontSize.sm, color: colors.foregroundSecondary },
    applicants: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },
  });
}
