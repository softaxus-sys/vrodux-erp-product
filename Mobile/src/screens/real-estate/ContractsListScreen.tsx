import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useContracts, useContractsSummary } from "@/hooks/use-real-estate";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONE } from "@/types/real-estate";
import type { ContractDto } from "@/types/real-estate";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "ContractsList">;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "expired", label: "Expired" },
  { key: "terminated", label: "Terminated" },
  { key: "renewed", label: "Renewed" },
];

export default function ContractsListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [status, setStatus] = useState("all");

  const summary = useContractsSummary();
  const contracts = useContracts(status);

  const sorted = useMemo(() => [...(contracts.data ?? [])].sort((a, b) => b.overdueAmount - a.overdueAmount), [contracts.data]);

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Active" value={summary.data.active} />
          <SummaryTile label="Overdue" value={formatCompactValue(summary.data.overdueAmount, currency)} />
          <SummaryTile label="Due this mo." value={formatCompactValue(summary.data.dueThisMonthAmount, currency)} />
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {contracts.isError ? (
        <ErrorState message="Couldn't load contracts." onRetry={() => contracts.refetch()} />
      ) : contracts.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(c) => c.id}
          contentContainerStyle={sorted.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={contracts.isRefetching} onRefresh={() => contracts.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="file-text" title="No contracts here" />}
          renderItem={({ item }) => (
            <ContractRow contract={item} currency={currency} onPress={() => navigation.navigate("ContractDetail", { contractId: item.id, contractNumber: item.contractNumber })} />
          )}
        />
      )}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: number | string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ContractRow({ contract, currency, onPress }: { contract: ContractDto; currency: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {contract.propertyName} · {contract.unitNumber}
        </Text>
        <Badge label={CONTRACT_STATUS_LABELS[contract.status] ?? contract.status} tone={CONTRACT_STATUS_TONE[contract.status] ?? "neutral"} />
      </View>
      <Text style={styles.meta}>
        {contract.contractNumber} · {contract.tenantName}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>
          {contract.startDate} → {contract.endDate}
        </Text>
        {contract.overdueAmount > 0 ? (
          <Text style={styles.overdue}>{formatCompactValue(contract.overdueAmount, currency)} overdue</Text>
        ) : contract.nextDueDate ? (
          <Text style={styles.stat}>Next due {contract.nextDueDate}</Text>
        ) : null}
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
    overdue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.destructive },
  });
}
