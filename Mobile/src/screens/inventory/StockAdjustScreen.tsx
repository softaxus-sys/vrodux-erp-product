import { useState } from "react";
import { Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useProduct, useProductStock, useWarehouses } from "@/hooks/use-inventory";
import { useCreateMovement } from "@/hooks/use-inventory-write";
import type { MovementType } from "@/lib/inventory-write.api";
import {
  ChipField, FormScreen, NumberField, PickerField, Section, SubmitBar, TextField, errorMessage, toNumber, type PickOption,
} from "@/components/forms/FormKit";
import { ErrorState, LoadingState } from "@/components/ui";
import { fontSize, useAppTheme } from "@/theme";
import type { InventoryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<InventoryStackParamList, "StockAdjust">;

const KINDS: { value: MovementType; label: string }[] = [
  { value: "Receipt", label: "Stock in" },
  { value: "WriteOff", label: "Write off" },
  { value: "Adjustment", label: "Count correction" },
];

/**
 * Change one product's stock. "Count correction" takes the number you actually counted and works out the
 * difference, which is how people think when standing at a shelf; stock in / write off take a plain quantity.
 */
export default function StockAdjustScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const { colors } = useAppTheme();
  const product = useProduct(productId);
  const stock = useProductStock(productId);
  const warehouses = useWarehouses(true);
  const create = useCreateMovement();

  const [kind, setKind] = useState<MovementType>("Receipt");
  const [qty, setQty] = useState("");
  const [warehouse, setWarehouse] = useState<PickOption | null>(null);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  if (product.isLoading) return <LoadingState />;
  if (product.isError || !product.data) return <ErrorState message="Could not load this product." onRetry={() => product.refetch()} />;
  const p = product.data;

  const options: PickOption[] = (warehouses.data ?? []).filter((w) => w.isActive).map((w) => ({ id: w.id, label: w.name, sub: w.isDefault ? "Default" : undefined }));
  const wh = warehouse ?? (options.find((o) => o.sub === "Default") ?? options[0] ?? null);
  const onHandHere = stock.data?.warehouses.find((w) => w.warehouseId === wh?.id)?.quantity ?? p.stockQuantity;

  const entered = toNumber(qty || "0");
  const valid = !Number.isNaN(entered) && (kind === "Adjustment" ? entered >= 0 : entered > 0);
  const delta = kind === "Adjustment" ? entered - onHandHere : kind === "WriteOff" ? -entered : entered;

  function submit() {
    create.mutate(
      {
        productId,
        movementType: kind,
        quantity: kind === "Adjustment" ? delta : entered,
        unitCost: p.costPrice,
        warehouseId: wh?.id ?? null,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title={p.name}>
        <Text style={{ color: colors.mutedForeground, fontSize: fontSize.md }}>
          On hand: {p.stockQuantity} {p.unit}{wh ? ` · ${onHandHere} in ${wh.label}` : ""}
        </Text>
        <ChipField label="What happened" value={kind} onChange={setKind} options={KINDS} />
        <PickerField label="Warehouse" value={wh} onChange={setWarehouse} options={options} loading={warehouses.isLoading} allowClear={false} />
        <NumberField
          label={kind === "Adjustment" ? "Counted quantity" : "Quantity"}
          value={qty}
          onChangeText={setQty}
          placeholder="0"
          hint={valid && kind === "Adjustment" ? `Stock will change by ${delta > 0 ? "+" : ""}${delta}` : undefined}
        />
        <TextField label="Reference" value={reference} onChangeText={setReference} placeholder="Delivery note, count sheet…" />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Section>
      <SubmitBar label="Save stock change" onPress={submit} disabled={!valid} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}
