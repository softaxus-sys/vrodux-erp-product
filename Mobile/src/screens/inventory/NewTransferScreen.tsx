import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "@/store/auth.store";
import { useProductsPaged, useWarehouses } from "@/hooks/use-inventory";
import { useCreateTransfer } from "@/hooks/use-inventory-write";
import {
  DateField, FormScreen, PickerField, Section, SubmitBar, TextField, errorMessage, isIsoDate, todayIso, toNumber, type PickOption,
} from "@/components/forms/FormKit";
import { fontSize, fontWeight, radius, spacing, useAppTheme } from "@/theme";
import type { InventoryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<InventoryStackParamList, "NewTransfer">;

interface Row { id: string; name: string; sku: string; cost: number; qty: string }

/** Move stock between two warehouses. Creates the request and sends it for approval. */
export default function NewTransferScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const me = useAuthStore((s) => s.user?.fullName ?? "");
  const warehouses = useWarehouses(true);
  const create = useCreateTransfer();
  const [from, setFrom] = useState<PickOption | null>(null);
  const [to, setTo] = useState<PickOption | null>(null);
  const [expected, setExpected] = useState(todayIso(2));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<PickOption | null>(null);
  const products = useProductsPaged({ page: 1, pageSize: 30, search });

  const wOptions: PickOption[] = (warehouses.data ?? []).filter((w) => w.isActive).map((w) => ({ id: w.id, label: w.name }));
  const pOptions: PickOption[] = (products.data?.items ?? []).map((p) => ({ id: p.id, label: p.name, sub: `${p.sku ?? ""} · ${p.stockQuantity} in stock` }));

  function addProduct(o: PickOption | null) {
    setProduct(null);
    if (!o) return;
    const p = products.data?.items.find((x) => x.id === o.id);
    if (!p || rows.some((r) => r.id === p.id)) return;
    setRows([...rows, { id: p.id, name: p.name, sku: p.sku ?? "", cost: p.costPrice, qty: "1" }]);
  }

  const sameWh = from !== null && to !== null && from.id === to.id;
  const canSubmit = from !== null && to !== null && !sameWh && isIsoDate(expected) && rows.length > 0 && rows.every((r) => toNumber(r.qty) > 0);

  function submit() {
    if (!from || !to) return;
    create.mutate(
      {
        fromWarehouseId: from.id, fromWarehouseName: from.label, toWarehouseId: to.id, toWarehouseName: to.label,
        requestedBy: me, expectedDate: expected, notes: notes.trim() || null,
        items: rows.map((r) => ({ stockItemId: r.id, itemName: r.name, sku: r.sku, quantity: toNumber(r.qty), unitCost: r.cost })),
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Warehouses">
        <PickerField label="From" required value={from} onChange={setFrom} options={wOptions} loading={warehouses.isLoading} allowClear={false} />
        <PickerField label="To" required value={to} onChange={setTo} options={wOptions} loading={warehouses.isLoading} allowClear={false} error={sameWh ? "Choose two different warehouses" : undefined} />
        <DateField label="Expected date" value={expected} onChange={setExpected} required />
      </Section>
      <Section title="Items">
        {rows.map((r) => (
          <View key={r.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: fontWeight.semibold, fontSize: fontSize.md }}>{r.name}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: fontSize.sm }}>{r.sku}</Text>
            </View>
            <TextInput
              style={[styles.qty, { borderColor: colors.border, color: colors.foreground }]}
              value={r.qty}
              onChangeText={(v) => setRows(rows.map((x) => (x.id === r.id ? { ...x, qty: v } : x)))}
              keyboardType="decimal-pad"
            />
            <Pressable hitSlop={10} onPress={() => setRows(rows.filter((x) => x.id !== r.id))}>
              <Feather name="trash-2" size={18} color={colors.destructive} />
            </Pressable>
          </View>
        ))}
        <PickerField label="Add a product" value={product} onChange={addProduct} options={pOptions} onSearch={setSearch} loading={products.isFetching} placeholder="Search products" allowClear={false} />
      </Section>
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      <SubmitBar label="Request transfer" onPress={submit} disabled={!canSubmit} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  qty: { width: 70, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, textAlign: "center", fontSize: fontSize.md },
});
