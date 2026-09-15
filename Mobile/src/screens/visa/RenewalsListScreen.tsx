import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useVisaRenewals } from "@/hooks/use-visa";
import { RENEWAL_KIND_LABELS } from "@/types/visa";
import type { RenewalItemDto, RenewalKind } from "@/types/visa";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type Tone, type AppColors } from "@/theme";
import type { VisaStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<VisaStackParamList, "RenewalsList">;

const WINDOWS = [30, 60, 90, 180];
const KIND_FILTERS: { key: "all" | RenewalKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "visa", label: "Visas" },
  { key: "passport", label: "Passports" },
  { key: "document", label: "Documents" },
];

function urgencyTone(daysLeft: number): Tone {
  if (daysLeft < 0) return "destructive";
  if (daysLeft <= 14) return "warning";
  return "info";
}

function urgencyLabel(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`;
  if (daysLeft === 0) return "Due today";
  return `${daysLeft}d left`;
}

export default function RenewalsListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [withinDays, setWithinDays] = useState(90);
  const [kind, setKind] = useState<"all" | RenewalKind>("all");

  const renewals = useVisaRenewals(withinDays);

  const filtered = useMemo(() => {
    const list = renewals.data ?? [];
    const scoped = kind === "all" ? list : list.filter((r) => r.kind === kind);
    return [...scoped].sort((a, b) => a.daysLeft - b.daysLeft);
  }, [renewals.data, kind]);

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {WINDOWS.map((w) => (
          <Chip key={w} label={`${w}d`} active={withinDays === w} onPress={() => setWithinDays(w)} />
        ))}
      </View>
      <View style={styles.filterRow}>
        {KIND_FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={kind === f.key} onPress={() => setKind(f.key)} />
        ))}
      </View>

      {renewals.isError ? (
        <ErrorState message="Couldn't load renewals." onRetry={() => renewals.refetch()} />
      ) : renewals.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r, i) => `${r.kind}-${r.caseId}-${i}`}
          contentContainerStyle={filtered.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={renewals.isRefetching} onRefresh={() => renewals.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="check-circle" title="Nothing expiring in this window" />}
          renderItem={({ item }) => (
            <RenewalRow renewal={item} onPress={() => navigation.navigate("CaseDetail", { caseId: item.caseId, caseNumber: item.caseNumber })} />
          )}
        />
      )}
    </View>
  );
}

function RenewalRow({ renewal, onPress }: { renewal: RenewalItemDto; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {renewal.subject}
        </Text>
        <Badge label={urgencyLabel(renewal.daysLeft)} tone={urgencyTone(renewal.daysLeft)} />
      </View>
      <Text style={styles.meta}>
        {RENEWAL_KIND_LABELS[renewal.kind]} · {renewal.caseNumber} · {renewal.visaTypeName}
      </Text>
      <Text style={styles.meta}>
        Expires {renewal.expiryDate ?? "—"}
        {renewal.assignedTo ? ` · ${renewal.assignedTo}` : ""}
      </Text>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
    list: { paddingVertical: spacing.md },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
  });
}
