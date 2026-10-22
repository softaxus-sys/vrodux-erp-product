import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useProductsPaged } from "@/hooks/use-inventory";
import { Button } from "@/components/ui";
import { toNumber } from "@/components/forms/FormKit";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

/**
 * Line items for quotations, orders, purchase orders and invoices: pick a product (price and tax come from
 * the product) or add a free-text line, then adjust quantity and price. `priceField` says which product price
 * to use -- selling price for sales documents, cost price for purchases.
 */
export interface Line {
  key: string;
  productId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxRate: string;
}

let seq = 0;
export const newLine = (p: Partial<Line> = {}): Line => ({
  key: `l${++seq}`,
  productId: null,
  description: "",
  quantity: "1",
  unitPrice: "",
  discountPercent: "0",
  taxRate: "0",
  ...p,
});

export function lineAmount(l: Line): number {
  const q = toNumber(l.quantity || "0");
  const p = toNumber(l.unitPrice || "0");
  const d = toNumber(l.discountPercent || "0");
  if ([q, p, d].some(Number.isNaN)) return 0;
  return q * p * (1 - d / 100);
}

export function linesTotals(lines: Line[]) {
  let sub = 0;
  let tax = 0;
  for (const l of lines) {
    const a = lineAmount(l);
    sub += a;
    const t = toNumber(l.taxRate || "0");
    if (!Number.isNaN(t)) tax += (a * t) / 100;
  }
  return { subTotal: sub, tax, total: sub + tax };
}

export function linesAreValid(lines: Line[]): boolean {
  return (
    lines.length > 0 &&
    lines.every((l) => l.description.trim().length > 0 && toNumber(l.quantity) > 0 && toNumber(l.unitPrice || "0") >= 0 && !Number.isNaN(toNumber(l.unitPrice || "0")))
  );
}

export function LineItemsEditor({
  lines,
  onChange,
  priceField = "sale",
  showDiscount = true,
  showTax = true,
  currency = "",
}: {
  lines: Line[];
  onChange: (l: Line[]) => void;
  priceField?: "sale" | "cost";
  showDiscount?: boolean;
  showTax?: boolean;
  currency?: string;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const products = useProductsPaged({ page: 1, pageSize: 30, search: q });
  const totals = linesTotals(lines);
  const patch = (key: string, p: Partial<Line>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const money = (n: number) => `${currency ? currency + " " : ""}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <View style={{ gap: spacing.md }}>
      {lines.map((l) => (
        <View key={l.key} style={s.card}>
          <View style={s.head}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={l.description}
              onChangeText={(t) => patch(l.key, { description: t })}
              placeholder="Item description"
              placeholderTextColor={colors.subtleForeground}
            />
            <Pressable hitSlop={10} onPress={() => onChange(lines.filter((x) => x.key !== l.key))}>
              <Feather name="trash-2" size={18} color={colors.destructive} />
            </Pressable>
          </View>
          <View style={s.row}>
            <Mini label="Qty" value={l.quantity} onChange={(v) => patch(l.key, { quantity: v })} />
            <Mini label="Price" value={l.unitPrice} onChange={(v) => patch(l.key, { unitPrice: v })} />
            {showDiscount ? <Mini label="Disc %" value={l.discountPercent} onChange={(v) => patch(l.key, { discountPercent: v })} /> : null}
            {showTax ? <Mini label="Tax %" value={l.taxRate} onChange={(v) => patch(l.key, { taxRate: v })} /> : null}
          </View>
          <Text style={s.lineTotal}>{money(lineAmount(l))}</Text>
        </View>
      ))}

      <View style={s.row}>
        <Button label="Add product" icon="search" variant="outline" onPress={() => setPicking(true)} style={{ flex: 1 }} />
        <Button label="Custom line" icon="plus" variant="outline" onPress={() => onChange([...lines, newLine()])} style={{ flex: 1 }} />
      </View>

      <View style={s.totals}>
        <TotalRow label="Subtotal" value={money(totals.subTotal)} />
        {showTax ? <TotalRow label="Tax" value={money(totals.tax)} /> : null}
        <TotalRow label="Total" value={money(totals.total)} bold />
      </View>

      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <SafeAreaView style={[{ flex: 1 }, { backgroundColor: colors.background }]}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Add product</Text>
            <Pressable hitSlop={10} onPress={() => setPicking(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <TextInput
            style={[s.input, { margin: spacing.lg, marginTop: 0 }]}
            value={q}
            onChangeText={setQ}
            placeholder="Search by name, SKU or barcode"
            placeholderTextColor={colors.subtleForeground}
            autoFocus
          />
          <FlatList
            data={products.data?.items ?? []}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={[s.sub, { textAlign: "center", marginTop: spacing.xl }]}>{products.isFetching ? "Loading…" : "No products found"}</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={s.option}
                onPress={() => {
                  const price = priceField === "cost" ? item.costPrice : item.salePrice;
                  const existing = lines.find((x) => x.productId === item.id);
                  if (existing) patch(existing.key, { quantity: String((toNumber(existing.quantity) || 0) + 1) });
                  else onChange([...lines, newLine({ productId: item.id, description: item.name, unitPrice: String(price ?? 0), taxRate: String(item.taxRate ?? 0) })]);
                  setPicking(false);
                  setQ("");
                }}
              >
                <Text style={s.optionTitle}>{item.name}</Text>
                <Text style={s.sub}>
                  {[item.sku, `${item.stockQuantity} in stock`, money(priceField === "cost" ? item.costPrice : item.salePrice)].filter(Boolean).join(" · ")}
                </Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function Mini({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={s.sub}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholderTextColor={colors.subtleForeground} />
    </View>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  return (
    <View style={s.totalRow}>
      <Text style={[s.sub, bold && { color: colors.foreground, fontWeight: fontWeight.bold }]}>{label}</Text>
      <Text style={[s.optionTitle, bold && { fontSize: fontSize.xl }]}>{value}</Text>
    </View>
  );
}

function styles(colors: AppColors) {
  return StyleSheet.create({
    card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
    head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    row: { flexDirection: "row", gap: spacing.sm },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm + 1,
      fontSize: fontSize.md, color: colors.foreground, backgroundColor: colors.background,
    },
    lineTotal: { alignSelf: "flex-end", fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    totals: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.muted },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sub: { fontSize: fontSize.sm, color: colors.mutedForeground },
    modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
    modalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    option: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 2 },
    optionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: colors.foreground },
  });
}
