import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useProduct, useProductStock } from "@/hooks/use-inventory";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import type { InventoryStackParamList } from "@/navigation/types";
import { Badge, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";

type Props = NativeStackScreenProps<InventoryStackParamList, "ProductDetail">;

export default function ProductDetailScreen({ route, navigation }: Props) {
  const { productId, productName } = route.params;
  navigation.setOptions({ headerTitle: productName });
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const product = useProduct(productId);
  const stock = useProductStock(productId);

  if (product.isLoading || !product.data) {
    return <LoadingState />;
  }
  if (product.isError) {
    return <ErrorState message="Couldn't load this product." onRetry={() => product.refetch()} />;
  }

  const p = product.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{p.name}</Text>
        <Text style={styles.subtitle}>{[p.sku, p.categoryName].filter(Boolean).join(" · ") || "—"}</Text>
        <View style={styles.statsRow}>
          <Stat label="Sale price" value={formatCompactValue(p.salePrice, currency)} tone="primary" />
          <Stat label="Cost price" value={formatCompactValue(p.costPrice, currency)} />
          <Stat label="Tax rate" value={`${p.taxRate}%`} />
          <Stat label="Total stock" value={`${p.stockQuantity} ${p.unit}`} />
        </View>
        <View style={styles.badgeRow}>
          {p.isLowStock ? <Badge label={`Low stock — reorder at ${p.reorderLevel}`} tone="warning" /> : null}
          {!p.isActive ? <Badge label="Inactive" tone="neutral" /> : null}
        </View>
      </View>

      {p.description ? (
        <SectionCard title="Description">
          <Text style={styles.bodyText}>{p.description}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title="Details">
        <DetailRow label="Barcode" value={p.barcode ?? "—"} />
        <DetailRow label="Brand" value={p.brandName ?? "—"} />
        <DetailRow label="Unit of measure" value={p.unitOfMeasureSymbol ?? p.unit} />
        <DetailRow label="Tracked" value={p.trackInventory ? "Yes" : "No"} />
      </SectionCard>

      <SectionCard title="Stock by warehouse">
        {stock.isLoading ? (
          <LoadingState size="small" />
        ) : stock.isError ? (
          <Text style={styles.notes}>Couldn&apos;t load per-warehouse stock.</Text>
        ) : !stock.data || stock.data.warehouses.length === 0 ? (
          <Text style={styles.notes}>No warehouse stock recorded.</Text>
        ) : (
          stock.data.warehouses.map((w) => (
            <View key={w.warehouseId} style={styles.warehouseRow}>
              <View style={styles.warehouseTop}>
                <Text style={styles.warehouseName}>
                  {w.warehouseName}
                  {w.isDefault ? " (default)" : ""}
                </Text>
                <Text style={[styles.warehouseQty, w.isLowStock && styles.stockLow]}>{w.quantity}</Text>
              </View>
              {w.isLowStock ? <Badge label={`Below reorder level (${w.reorderLevel})`} tone="warning" /> : null}
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },

  header: { gap: spacing.xs },
  name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
  subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },

  bodyText: { fontSize: fontSize.md, color: colors.foreground },
  notes: { fontSize: fontSize.base, color: colors.mutedForeground },

  warehouseRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: spacing.xs },
  warehouseTop: { flexDirection: "row", justifyContent: "space-between" },
  warehouseName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
  warehouseQty: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
  stockLow: { color: colors.warning },
});
