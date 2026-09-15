import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useVisaCases, useVisaCasesSummary } from "@/hooks/use-visa";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { CASE_STATUS_LABELS, CASE_STATUS_TONE } from "@/types/visa";
import type { VisaCaseStatus, VisaCaseSummaryDto } from "@/types/visa";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { VisaStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<VisaStackParamList, "CasesList">;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "docs_pending", label: "Docs Pending" },
  { key: "docs_complete", label: "Docs Complete" },
  { key: "submitted", label: "Submitted" },
  { key: "in_review", label: "In Review" },
  { key: "rfi_required", label: "RFI" },
  { key: "approved", label: "Approved" },
  { key: "issued", label: "Issued" },
  { key: "rejected", label: "Rejected" },
];

export default function CasesListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const summary = useVisaCasesSummary();
  const cases = useVisaCases(status);

  const filtered = useMemo(() => {
    const list = cases.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.caseNumber.toLowerCase().includes(q) || c.primaryApplicantName.toLowerCase().includes(q) || (c.customerName ?? "").toLowerCase().includes(q),
    );
  }, [cases.data, search]);

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Open" value={summary.data.open} />
          <SummaryTile label="Docs pending" value={summary.data.docsPending} />
          <SummaryTile label="Approved (mo)" value={summary.data.approvedThisMonth} />
        </View>
      ) : null}

      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by case #, applicant, or client…" />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {cases.isError ? (
        <ErrorState message="Couldn't load cases." onRetry={() => cases.refetch()} />
      ) : cases.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={filtered.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={cases.isRefetching} onRefresh={() => cases.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="folder" title="No cases here" />}
          renderItem={({ item }) => (
            <CaseRow
              c={item}
              currency={currency}
              onPress={() => navigation.navigate("CaseDetail", { caseId: item.id, caseNumber: item.caseNumber })}
            />
          )}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function CaseRow({ c, currency, onPress }: { c: VisaCaseSummaryDto; currency: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const status = c.status as VisaCaseStatus;
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {c.primaryApplicantName}
          {c.applicantCount > 1 ? ` +${c.applicantCount - 1}` : ""}
        </Text>
        <Badge label={CASE_STATUS_LABELS[status] ?? c.status} tone={CASE_STATUS_TONE[status] ?? "neutral"} />
      </View>
      <Text style={styles.meta}>
        {c.caseNumber} · {c.visaTypeName}
        {c.customerName ? ` · ${c.customerName}` : ""}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>
          {c.documentsTotal > 0 ? `${c.documentsTotal - c.documentsPending}/${c.documentsTotal} docs` : "No docs yet"}
          {c.assignedTo ? ` · ${c.assignedTo}` : ""}
        </Text>
        <Text style={styles.statValue}>{formatCompactValue(c.serviceFee + c.govtFee, currency)}</Text>
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
    list: { paddingVertical: spacing.md },

    summaryRow: { flexDirection: "row", justifyContent: "space-around", margin: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: spacing.md },
    summaryTile: { alignItems: "center" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    summaryLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
    rowBottom: { flexDirection: "row", justifyContent: "space-between" },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
    statValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
  });
}
