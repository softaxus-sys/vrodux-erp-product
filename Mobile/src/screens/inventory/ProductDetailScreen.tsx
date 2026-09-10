import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useProduct, useProductStock } from "@/hooks/use-inventory";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import type { InventoryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<InventoryStackParamList, "ProductDetail">;

export default function ProductDetailScreen({ route, navigation }: Props) {
  const { productId, productName } = route.params;
  navigation.setOptions({ headerTitle: productName });
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const product = useProduct(productId);
  const stock = useProductStock(productId);

  if (product.isLoading || !product.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (product.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn&apos;t load this product.</Text>
        <Pressable onPress={() => product.refetch()}>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const p = product.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{p.name}</Text>
        <Text style={styles.subtitle}>
          {[p.sku, p.categoryName].filter(Boolean).join(" · ") || "—"}
        </Text>
        <View style={styles.statsRow}>
          <Stat label="Sale price" value={formatCompactValue(p.salePrice, currency)} />
          <Stat label="Cost price" value={formatCompactValue(p.costPrice, currency)} />
          <Stat label="Tax rate" value={`${p.taxRate}%`} />
          <Stat label="Total stock" value={`${p.stockQuantity} ${p.unit}`} />
        </View>
        <View style={styles.badgeRow}>
          {p.isLowStock ? <Text style={styles.lowBadge}>Low stock — reorder at {p.reorderLevel}</Text> : null}
          {!p.isActive ? <Text style={styles.inactiveBadge}>Inactive</Text> : null}
        </View>
      </View>

      {p.description ? (
        <Section title="Description">
          <Text style={styles.bodyText}>{p.description}</Text>
        </Section>
      ) : null}

      <Section title="Details">
        <Detail label="Barcode" value={p.barcode ?? "—"} />
        <Detail label="Brand" value={p.brandName ?? "—"} />
        <Detail label="Unit of measure" value={p.unitOfMeasureSymbol ?? p.unit} />
        <Detail label="Tracked" value={p.trackInventory ? "Yes" : "No"} />
      </Section>

      <Section title="Stock by warehouse">
        {stock.isLoading ? (
          <ActivityIndicator />
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
              {w.isLowStock ? <Text style={styles.lowBadge}>Below reorder level ({w.reorderLevel})</Text> : null}
            </View>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorText: { color: "#dc2626" },
  retry: { color: "#2563eb", fontWeight: "600" },

  header: { gap: 4 },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 8 },
  stat: {},
  statLabel: { fontSize: 11, color: "#9ca3af", textTransform: "uppercase" },
  statValue: { fontSize: 14, fontWeight: "600", color: "#111827" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  lowBadge: { fontSize: 12, color: "#b45309", backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  inactiveBadge: { fontSize: 12, color: "#6b7280", backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },

  section: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase" },
  bodyText: { fontSize: 14, color: "#111827" },
  notes: { fontSize: 13, color: "#6b7280" },

  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  detailLabel: { fontSize: 13, color: "#6b7280" },
  detailValue: { fontSize: 13, fontWeight: "600", color: "#111827" },

  warehouseRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8, marginTop: 4, gap: 4 },
  warehouseTop: { flexDirection: "row", justifyContent: "space-between" },
  warehouseName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  warehouseQty: { fontSize: 14, fontWeight: "700", color: "#111827" },
  stockLow: { color: "#b45309" },
});
