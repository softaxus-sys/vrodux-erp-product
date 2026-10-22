import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "@/store/auth.store";
import { useVendorsPaged } from "@/hooks/use-purchase";
import { useCreatePurchaseOrder } from "@/hooks/use-purchase-write";
import {
  DateField, FormScreen, PickerField, Section, SubmitBar, TextField, errorMessage, isIsoDate, todayIso, type PickOption,
} from "@/components/forms/FormKit";
import { LineItemsEditor, linesAreValid, type Line } from "@/components/forms/LineItemsEditor";
import type { PurchaseStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<PurchaseStackParamList, "NewPurchaseOrder">;

export default function NewPurchaseOrderScreen({ navigation }: Props) {
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const create = useCreatePurchaseOrder();
  const [search, setSearch] = useState("");
  const vendors = useVendorsPaged({ page: 1, pageSize: 30, search });
  const [vendor, setVendor] = useState<PickOption | null>(null);
  const [expected, setExpected] = useState(todayIso(7));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const options: PickOption[] = (vendors.data?.items ?? []).map((v) => ({
    id: v.id,
    label: v.name,
    sub: [v.category, v.paymentTerms].filter(Boolean).join(" · "),
  }));
  const canSubmit = vendor !== null && (expected === "" || isIsoDate(expected)) && linesAreValid(lines);

  function submit() {
    if (!vendor) return;
    create.mutate(
      { vendorId: vendor.id, notes: notes.trim() || null, expectedDate: expected || null, lines },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Vendor">
        <PickerField label="Vendor" required value={vendor} onChange={setVendor} options={options} onSearch={setSearch} loading={vendors.isFetching} allowClear={false} />
        <DateField label="Expected delivery" value={expected} onChange={setExpected} />
      </Section>
      <Section title="Items">
        <LineItemsEditor lines={lines} onChange={setLines} priceField="cost" showDiscount={false} currency={currency} />
      </Section>
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      <SubmitBar label="Create purchase order" onPress={submit} disabled={!canSubmit} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}
