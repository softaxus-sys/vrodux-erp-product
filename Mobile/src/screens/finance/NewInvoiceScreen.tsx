import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import {
  DateField, FormScreen, NumberField, PickerField, Section, SubmitBar, SwitchField, TextField, errorMessage, fieldError, isIsoDate, todayIso, toNumber,
  type PickOption,
} from "@/components/forms/FormKit";
import { LineItemsEditor, linesAreValid, type Line } from "@/components/forms/LineItemsEditor";
import type { FinanceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<FinanceStackParamList, "NewInvoice">;

interface FinanceCustomer { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null; taxNumber?: string | null }

/** Raise an invoice. Tax is one rate for the whole invoice (the invoice endpoint takes a single rate). */
export default function NewInvoiceScreen({ navigation }: Props) {
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const customers = useQuery({
    queryKey: ["finance", "customers", search],
    queryFn: () => apiClient.get<FinanceCustomer[]>(`/api/finance/customers?isActive=true${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`),
  });
  const create = useMutation({
    mutationFn: (body: unknown) => apiClient.post<{ id: string }>("/api/finance/invoices", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });

  const [customer, setCustomer] = useState<PickOption | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issue, setIssue] = useState(todayIso());
  const [due, setDue] = useState(todayIso(30));
  const [taxRate, setTaxRate] = useState("0");
  const [remind, setRemind] = useState(false);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const options: PickOption[] = (customers.data ?? []).map((c) => ({ id: c.id, label: c.name, sub: c.email ?? c.phone ?? undefined }));
  const picked = customer ? customers.data?.find((c) => c.id === customer.id) : undefined;
  const tax = toNumber(taxRate || "0");
  const canSubmit = (customer !== null || name.trim().length > 0) && isIsoDate(issue) && isIsoDate(due) && due >= issue && !Number.isNaN(tax) && linesAreValid(lines);

  function submit() {
    create.mutate(
      {
        customerName: customer?.label ?? name.trim(),
        customerEmail: (picked?.email ?? email.trim()) || null,
        customerAddress: picked?.address ?? null,
        customerTrn: picked?.taxNumber ?? null,
        invoiceDate: issue,
        dueDate: due,
        taxRate: tax,
        remindBeforeDue: remind,
        notes: notes.trim() || null,
        items: lines.map((l) => ({
          description: l.description.trim(),
          quantity: toNumber(l.quantity),
          // The invoice has no per-line discount, so fold it into the unit price.
          unitPrice: toNumber(l.unitPrice || "0") * (1 - (toNumber(l.discountPercent || "0") || 0) / 100),
        })),
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Customer">
        <PickerField label="Customer" value={customer} onChange={setCustomer} options={options} onSearch={setSearch} loading={customers.isFetching} placeholder="Pick a customer" />
        {!customer ? (
          <>
            <TextField label="Or type a name" value={name} onChangeText={setName} autoCapitalize="words" error={fieldError(create.error, "customerName")} />
            <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" hint="Needed to email the invoice." />
          </>
        ) : null}
        <DateField label="Invoice date" value={issue} onChange={setIssue} required />
        <DateField label="Due date" value={due} onChange={setDue} required quick={[{ label: "+15d", days: 15 }, { label: "+30d", days: 30 }, { label: "+60d", days: 60 }]} />
      </Section>
      <Section title="Items">
        <LineItemsEditor lines={lines} onChange={setLines} showTax={false} currency={currency} />
        <NumberField label="Tax rate % (whole invoice)" value={taxRate} onChangeText={setTaxRate} />
      </Section>
      <SwitchField label="Remind the customer before it is due" value={remind} onChange={setRemind} />
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      <SubmitBar label="Create invoice" onPress={submit} disabled={!canSubmit} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}
