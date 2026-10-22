import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "@/store/auth.store";
import { useCreateQuotation, useCreateSalesOrder, useSalesCustomers } from "@/hooks/use-sales-write";
import {
  DateField, FormScreen, NumberField, PickerField, Section, SubmitBar, TextField, errorMessage, isIsoDate, todayIso, toNumber, type PickOption,
} from "@/components/forms/FormKit";
import { LineItemsEditor, linesAreValid, newLine, type Line } from "@/components/forms/LineItemsEditor";
import type { SalesStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<SalesStackParamList, "NewOrder" | "NewQuotation">;

/** One form for both documents -- they differ only in the date field, the header discount and the endpoint. */
export default function SalesDocFormScreen({ route, navigation }: Props) {
  const isQuote = route.name === "NewQuotation";
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const createOrder = useCreateSalesOrder();
  const createQuote = useCreateQuotation();

  const [search, setSearch] = useState("");
  const customers = useSalesCustomers(search);
  const [customer, setCustomer] = useState<PickOption | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [date, setDate] = useState(isQuote ? todayIso(30) : "");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const options: PickOption[] = (customers.data ?? []).map((c) => ({ id: c.id, label: c.name, sub: c.email ?? c.phone ?? undefined }));
  const discountNum = toNumber(discount || "0");
  const hasWho = customer !== null || customerName.trim().length > 0;
  const dateOk = date === "" || isIsoDate(date);
  const canSubmit = hasWho && dateOk && linesAreValid(lines) && !Number.isNaN(discountNum) && discountNum >= 0 && discountNum <= 100;
  const pending = createOrder.isPending || createQuote.isPending;
  const err = createOrder.error ?? createQuote.error;

  function submit() {
    const common = { customerId: customer?.id ?? null, customerName: customer?.label ?? customerName.trim(), notes: notes.trim() || null, lines };
    const done = () => navigation.goBack();
    if (isQuote) createQuote.mutate({ ...common, validUntil: date || null, discountPercent: discountNum }, { onSuccess: done });
    else createOrder.mutate({ ...common, expectedDate: date || null }, { onSuccess: done });
  }

  return (
    <FormScreen>
      <Section title="Customer">
        <PickerField label="Customer" value={customer} onChange={setCustomer} options={options} onSearch={setSearch} loading={customers.isFetching} placeholder="Pick a customer" />
        {!customer ? <TextField label="Or type a name" value={customerName} onChangeText={setCustomerName} autoCapitalize="words" /> : null}
        <DateField label={isQuote ? "Valid until" : "Expected delivery"} value={date} onChange={setDate} />
        {isQuote ? <NumberField label="Discount %" value={discount} onChangeText={setDiscount} /> : null}
      </Section>
      <Section title="Items">
        <LineItemsEditor lines={lines} onChange={setLines} priceField="sale" currency={currency} />
      </Section>
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      <SubmitBar label={isQuote ? "Create quotation" : "Create order"} onPress={submit} disabled={!canSubmit} loading={pending} error={errorMessage(err)} />
    </FormScreen>
  );
}
