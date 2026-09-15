import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useBoqs } from "@/hooks/use-construction";
import { formatCompactValue } from "@/lib/crm-helpers";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { useAuthStore } from "@/store/auth.store";
import type { BoqDto } from "@/types/construction";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

export default function BoqsListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const boqs = useBoqs();

  const statusFilters = useMemo(() => {
    const present = new Set((boqs.data ?? []).map((b) => b.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [boqs.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (boqs.data ?? []).filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (q && !b.projectName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [boqs.data, search, status]);

  return (
    <View style={styles.container}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by project…" />
      <View style={styles.filterRow}>
        {statusFilters.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {boqs.isError ? (
        <ErrorState message="Couldn't load bills of quantities." onRetry={() => boqs.refetch()} />
      ) : boqs.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          contentContainerStyle={filtered.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={boqs.isRefetching} onRefresh={() => boqs.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="list" title="No BOQs here" />}
          renderItem={({ item }) => <BoqRow boq={item} currency={currency} />}
        />
      )}
    </View>
  );
}

function BoqRow({ boq, currency }: { boq: BoqDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pct = boq.totalValue > 0 ? Math.round((boq.completedValue / boq.totalValue) * 100) : 0;
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {boq.projectName}
        </Text>
        <Badge label={titleCaseStatus(boq.status)} tone={guessStatusTone(boq.status)} />
      </View>
      <Text style={styles.meta}>
        {boq.items.length} line item{boq.items.length === 1 ? "" : "s"}
        {boq.approvedBy ? ` · Approved by ${boq.approvedBy}` : ""}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>{pct}% completed</Text>
        <Text style={styles.statValue}>{formatCompactValue(boq.totalValue, currency)}</Text>
      </View>
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
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
    rowBottom: { flexDirection: "row", justifyContent: "space-between" },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
    statValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
  });
}
