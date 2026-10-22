import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ChipField, FormScreen, Section, SubmitBar, TextField, errorMessage, fieldError } from "@/components/forms/FormKit";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "NewTenant">;

export default function NewTenantScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (body: unknown) => apiClient.post("/api/real-estate/tenants", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["real-estate"] }),
  });
  const [type, setType] = useState("individual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [company, setCompany] = useState("");
  const [license, setLicense] = useState("");

  const isCompany = type === "company";
  const canSubmit = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim()) && phone.trim().length > 0 && nationality.trim().length > 0;

  function submit() {
    create.mutate(
      {
        name: name.trim(), tenantType: type, email: email.trim(), phone: phone.trim(), nationality: nationality.trim(),
        nationalId: nationalId.trim() || null, companyName: isCompany ? company.trim() || null : null, tradeLicense: isCompany ? license.trim() || null : null,
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Tenant">
        <ChipField label="Type" value={type} onChange={setType} options={[{ value: "individual", label: "Individual" }, { value: "company", label: "Company" }]} />
        <TextField label="Full name" required value={name} onChangeText={setName} autoCapitalize="words" error={fieldError(create.error, "name")} />
        <TextField label="Email" required value={email} onChangeText={setEmail} keyboardType="email-address" error={fieldError(create.error, "email")} />
        <TextField label="Phone" required value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label="Nationality" required value={nationality} onChangeText={setNationality} autoCapitalize="words" />
        <TextField label="Emirates ID / national ID" value={nationalId} onChangeText={setNationalId} />
        {isCompany ? (
          <>
            <TextField label="Company name" value={company} onChangeText={setCompany} autoCapitalize="words" />
            <TextField label="Trade licence" value={license} onChangeText={setLicense} />
          </>
        ) : null}
      </Section>
      <SubmitBar label="Add tenant" onPress={submit} disabled={!canSubmit} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}
