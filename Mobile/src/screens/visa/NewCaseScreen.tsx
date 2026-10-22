import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import {
  ChipField, DateField, FormScreen, NumberField, PickerField, Section, SubmitBar, TextField, errorMessage, isIsoDate, toNumber, type PickOption,
} from "@/components/forms/FormKit";
import type { VisaStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<VisaStackParamList, "NewCase">;

interface VisaType { id: string; name: string; category: string; defaultGovtFee: number; defaultServiceFee: number; processingDays: number }

const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"].map((v) => ({ value: v, label: v }));
const PRIORITIES = [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }];

/** New visa case for one primary applicant. Dependants can be added on the web. */
export default function NewCaseScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const userName = useAuthStore((s) => s.user?.fullName ?? "");
  const types = useQuery({ queryKey: ["visa", "types"], queryFn: () => apiClient.get<VisaType[]>("/api/visa/types") });
  const create = useMutation({
    mutationFn: (body: unknown) => apiClient.post("/api/visa/cases", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visa"] }),
  });

  const [type, setType] = useState<PickOption | null>(null);
  const [emirate, setEmirate] = useState("Dubai");
  const [priority, setPriority] = useState("medium");
  const [client, setClient] = useState("");
  const [serviceFee, setServiceFee] = useState("");
  const [govtFee, setGovtFee] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [nationality, setNationality] = useState("");
  const [passport, setPassport] = useState("");
  const [passportExpiry, setPassportExpiry] = useState("");
  const [notes, setNotes] = useState("");

  const list = types.data ?? [];
  const options: PickOption[] = list.map((t) => ({ id: t.id, label: t.name, sub: t.category }));
  const canSubmit = type !== null && first.trim().length > 0 && nationality.trim().length > 0 && passport.trim().length > 0
    && (passportExpiry === "" || isIsoDate(passportExpiry));

  function pickType(v: PickOption | null) {
    setType(v);
    const t = list.find((x) => x.id === v?.id);
    if (t) {
      setServiceFee(String(t.defaultServiceFee));
      setGovtFee(String(t.defaultGovtFee));
    }
  }

  function submit() {
    if (!type) return;
    const sf = toNumber(serviceFee || "0");
    const gf = toNumber(govtFee || "0");
    create.mutate(
      {
        visaTypeId: type.id, emirate, priority, customerName: client.trim() || null, customerId: null,
        assignedTo: userName, serviceFee: Number.isNaN(sf) ? null : sf, govtFee: Number.isNaN(gf) ? null : gf,
        slaDueDate: null, notes: notes.trim() || null, createdByName: userName,
        applicants: [{
          firstName: first.trim(), lastName: last.trim(), nationality: nationality.trim(), passportNumber: passport.trim(),
          passportExpiry: passportExpiry || null, dateOfBirth: null, emiratesId: null, uidNumber: null, relationship: "primary",
        }],
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Case">
        <PickerField label="Visa type" required value={type} onChange={pickType} options={options} loading={types.isLoading} allowClear={false} />
        <ChipField label="Emirate" value={emirate} onChange={setEmirate} options={EMIRATES} />
        <ChipField label="Priority" value={priority} onChange={setPriority} options={PRIORITIES} />
        <TextField label="Client / company" value={client} onChangeText={setClient} autoCapitalize="words" />
        <NumberField label="Service fee" value={serviceFee} onChangeText={setServiceFee} />
        <NumberField label="Government fee" value={govtFee} onChangeText={setGovtFee} />
      </Section>
      <Section title="Applicant">
        <TextField label="First name" required value={first} onChangeText={setFirst} autoCapitalize="words" />
        <TextField label="Last name" value={last} onChangeText={setLast} autoCapitalize="words" />
        <TextField label="Nationality" required value={nationality} onChangeText={setNationality} autoCapitalize="words" />
        <TextField label="Passport number" required value={passport} onChangeText={setPassport} autoCapitalize="characters" />
        <DateField label="Passport expiry" value={passportExpiry} onChange={setPassportExpiry} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Section>
      <SubmitBar label="Create case" onPress={submit} disabled={!canSubmit} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}
