import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useTables, useTablesSummary } from "@/hooks/use-restaurant";
import { TABLE_STATUS_LABELS, TABLE_STATUS_TONE } from "@/types/restaurant";
import type { TableDto } from "@/types/restaurant";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "occupied", label: "Occupied" },
  { key: "reserved", label: "Reserved" },
  { key: "cleaning", label: "Cleaning" },
];

export default function TablesListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState("all");

  const summary = useTablesSummary();
  const tables = useTables();

  const filtered = useMemo(() => {
    const list = tables.data ?? [];
    const bySection = [...list].sort((a, b) => a.section.localeCompare(b.section) || a.tableNumber.localeCompare(b.tableNumber));
    return status === "all" ? bySection : bySection.filter((t) => t.status === status);
  }, [tables.data, status]);

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Occupancy" value={`${Math.round(summary.data.occupancyRate)}%`} />
          <SummaryTile label="Covers" value={String(summary.data.totalCovers)} />
          <SummaryTile label="Tables" value={String(summary.data.total)} />
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {tables.isError ? (
        <ErrorState message="Couldn't load tables." onRetry={() => tables.refetch()} />
      ) : tables.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={filtered.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={tables.isRefetching} onRefresh={() => tables.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="grid" title="No tables in this status" />}
          renderItem={({ item }) => <TableRow table={item} />}
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

function TableRow({ table }: { table: TableDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name}>
          Table {table.tableNumber} <Text style={styles.section}>· {table.section}</Text>
        </Text>
        <Badge label={TABLE_STATUS_LABELS[table.status] ?? table.status} tone={TABLE_STATUS_TONE[table.status] ?? "neutral"} />
      </View>
      <Text style={styles.meta}>
        Seats {table.capacity}
        {table.currentWaiter ? ` · ${table.currentWaiter}` : ""}
      </Text>
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
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
    section: { fontWeight: fontWeight.regular, color: colors.mutedForeground },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
  });
}
