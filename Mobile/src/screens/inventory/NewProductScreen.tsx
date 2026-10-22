import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCategories, useCreateProduct } from "@/hooks/use-inventory-write";
import {
  ChipField, FormScreen, NumberField, PickerField, Section, SubmitBar, SwitchField, TextField, errorMessage, fieldError, toNumber, type PickOption,
} from "@/components/forms/FormKit";
import type { InventoryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<InventoryStackParamList, "NewProduct">;

const UNITS = ["pcs", "kg", "g", "l", "ml", "m", "box", "pack"].map((v) => ({ value: v, label: v }));

export default function NewProductScreen({ navigation }: Props) {
  const categories = useCategories();
  const create = useCreateProduct();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState<PickOption | null>(null);
  const [unit, setUnit] = useState("pcs");
  const [sale, setSale] = useState("");
  const [cost, setCost] = useState("");
  const [tax, setTax] = useState("0");
  const [opening, setOpening] = useState("0");
  const [reorder, setReorder] = useState("0");
  const [track, setTrack] = useState(true);

  const options: PickOption[] = (categories.data ?? []).map((c) => ({ id: c.id, label: c.name, sub: c.code ?? undefined }));
  const nums = [sale, cost, tax, opening, reorder].map((v) => toNumber(v || "0"));
  const canSubmit = name.trim().length > 0 && category !== null && nums.every((n) => !Number.isNaN(n) && n >= 0);

  function submit() {
    if (!category) return;
    create.mutate(
      {
        name: name.trim(), sku: sku.trim() || null, barcode: barcode.trim() || null, categoryId: category.id, unit,
        salePrice: nums[0], costPrice: nums[1], taxRate: nums[2], openingStock: nums[3], reorderLevel: nums[4], trackInventory: track,
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Product">
        <TextField label="Name" required value={name} onChangeText={setName} autoCapitalize="words" error={fieldError(create.error, "name")} />
        <PickerField label="Category" required value={category} onChange={setCategory} options={options} loading={categories.isLoading} allowClear={false} />
        <TextField label="SKU" value={sku} onChangeText={setSku} autoCapitalize="characters" error={fieldError(create.error, "sku")} />
        <TextField label="Barcode" value={barcode} onChangeText={setBarcode} keyboardType="number-pad" />
        <ChipField label="Unit" value={unit} onChange={setUnit} options={UNITS} />
      </Section>
      <Section title="Pricing">
        <NumberField label="Selling price" value={sale} onChangeText={setSale} placeholder="0" />
        <NumberField label="Cost price" value={cost} onChangeText={setCost} placeholder="0" />
        <NumberField label="Tax %" value={tax} onChangeText={setTax} />
      </Section>
      <Section title="Stock">
        <SwitchField label="Track stock" value={track} onChange={setTrack} hint="Off for services and other items with no stock count." />
        {track ? <NumberField label="Opening stock" value={opening} onChangeText={setOpening} /> : null}
        {track ? <NumberField label="Reorder level" value={reorder} onChangeText={setReorder} hint="Flagged as low stock at or below this." /> : null}
      </Section>
      <SubmitBar label="Create product" onPress={submit} disabled={!canSubmit} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}
