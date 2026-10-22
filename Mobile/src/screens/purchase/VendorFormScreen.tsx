import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useVendor } from "@/hooks/use-purchase";
import { useCreateVendor, useUpdateVendor } from "@/hooks/use-purchase-write";
import { FormScreen, Section, SubmitBar, TextField, errorMessage, fieldError } from "@/components/forms/FormKit";
import { ErrorState, LoadingState } from "@/components/ui";
import type { PurchaseStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<PurchaseStackParamList, "VendorForm">;

export default function VendorFormScreen({ route, navigation }: Props) {
  const vendorId = route.params?.vendorId;
  const existing = useVendor(vendorId ?? "");
  const create = useCreateVendor();
  const update = useUpdateVendor();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [tax, setTax] = useState("");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(!vendorId);

  useEffect(() => {
    if (!vendorId || !existing.data || hydrated) return;
    const v = existing.data;
    setName(v.name);
    setCategory(v.category ?? "");
    setContact(v.contactPerson ?? "");
    setEmail(v.email ?? "");
    setPhone(v.phone ?? "");
    setAddress(v.address ?? "");
    setTax(v.taxNumber ?? "");
    setTerms(v.paymentTerms ?? "");
    setNotes(v.notes ?? "");
    setHydrated(true);
  }, [vendorId, existing.data, hydrated]);

  const err = create.error ?? update.error;
  function submit() {
    const body = {
      name: name.trim(),
      category: category.trim() || null,
      contactPerson: contact.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      taxNumber: tax.trim() || null,
      paymentTerms: terms.trim() || null,
      notes: notes.trim() || null,
    };
    const done = () => navigation.goBack();
    if (vendorId) update.mutate({ id: vendorId, patch: body }, { onSuccess: done });
    else create.mutate(body, { onSuccess: done });
  }

  if (vendorId && existing.isLoading) return <LoadingState />;
  if (vendorId && existing.isError) return <ErrorState message="Could not load this vendor." onRetry={() => existing.refetch()} />;

  return (
    <FormScreen>
      <Section title="Vendor">
        <TextField label="Name" required value={name} onChangeText={setName} autoCapitalize="words" error={fieldError(err, "name")} />
        <TextField label="Category" value={category} onChangeText={setCategory} autoCapitalize="words" />
        <TextField label="Contact person" value={contact} onChangeText={setContact} autoCapitalize="words" />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" error={fieldError(err, "email")} />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label="Address" value={address} onChangeText={setAddress} multiline />
        <TextField label="Tax number" value={tax} onChangeText={setTax} autoCapitalize="characters" />
        <TextField label="Payment terms" value={terms} onChangeText={setTerms} placeholder="e.g. Net 30" />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Section>
      <SubmitBar
        label={vendorId ? "Save changes" : "Create vendor"}
        onPress={submit}
        disabled={name.trim().length === 0}
        loading={create.isPending || update.isPending}
        error={errorMessage(err)}
      />
    </FormScreen>
  );
}
