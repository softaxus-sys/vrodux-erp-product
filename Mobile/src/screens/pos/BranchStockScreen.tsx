import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useBranchStock } from "@/hooks/use-pos";
import type { BranchStockRowDto } from "@/types/pos";
import { Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/**
 * What each branch holds of each product, as last reported by its branch server. Read-only at head
 * office: a branch's figure changes only through that branch's own sales, refunds and adjustments.
 * Mirrors the web's Stock by Branch page.
 */
export default function BranchStockScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState<string>("all");
  const stock = useBranchStock(search, branch === "all" ? undefined : branch);

  const rows = stock.data ?? [];
  // The branch filter is built from what has reported, not from the branch list: a branch that has
  // never synced has nothing to filter to.
  const branches = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.branchId, r.branchName));
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  return (
    <View style={styles.container}>
      <View style={styles.search}>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Search product, SKU or barcode" />
      </View>
      {branches.length > 1 || branch !== "all" ? (
        <View style={styles.filters}>
          <Chip label="All branches" active={branch === "all"} onPress={() => setBranch("all")} />
          {branches.map((b) => (
            <Chip key={b.id} label={b.name} active={branch === b.id} onPress={() => setBranch(b.id)} />
          ))}
        </View>
      ) : null}

      {stock.isError ? (
        <ErrorState message="Couldn't load stock by branch." onRetry={() => stock.refetch()} />
      ) : stock.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.branchId}-${r.productId}`}
          contentContainerStyle={rows.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={stock.isRefetching} onRefresh={() => stock.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyListState icon="server" title="Nothing reported yet" subtitle="A branch appears here after its branch server has synced at least once." />
          }
          renderItem={({ item }) => <Row row={item} />}
        />
      )}
    </View>
  );
}

function Row({ row }: { row: BranchStockRowDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const low = row.reorderLevel > 0 && row.stockQuantity <= row.reorderLevel;
  const tone = row.stockQuantity <= 0 ? colors.destructive : low ? colors.warning : colors.foreground;
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>{row.productName}</Text>
        <Text style={[styles.qty, { color: tone }]}>{qty(row.stockQuantity)} {row.unit}</Text>
      </View>
      <Text style={styles.meta}>
        {row.branchName}{row.sku ? ` · ${row.sku}` : ""}{row.reorderLevel > 0 ? ` · reorder at ${qty(row.reorderLevel)}` : ""}
      </Text>
      {row.asOf ? <Text style={styles.meta}>As of {new Date(row.asOf).toLocaleString()}</Text> : null}
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    search: { padding: spacing.lg, paddingBottom: spacing.sm },
    filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    list: { paddingVertical: spacing.md },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
    name: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
    qty: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
