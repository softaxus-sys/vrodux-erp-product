import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useDepartments } from "@/hooks/use-hr-directory";
import {
  ChipField, DateField, FormScreen, NumberField, PickerField, Section, SubmitBar, TextField, errorMessage, fieldError, isIsoDate, todayIso, toNumber,
  type PickOption,
} from "@/components/forms/FormKit";
import type { HrStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<HrStackParamList, "NewEmployee">;

const TYPES = ["Full-Time", "Part-Time", "Contract", "Internship", "Probation"].map((v) => ({ value: v, label: v }));

export default function NewEmployeeScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const departments = useDepartments();
  const create = useMutation({
    mutationFn: (body: unknown) => apiClient.post<{ id: string }>("/api/hr/employees", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-directory"] }),
  });

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState<PickOption | null>(null);
  const [type, setType] = useState("Full-Time");
  const [salary, setSalary] = useState("");
  const [joining, setJoining] = useState(todayIso());
  const [nationality, setNationality] = useState("");
  const [emiratesId, setEmiratesId] = useState("");
  const [iban, setIban] = useState("");

  const options: PickOption[] = ((departments.data as { id: string; name: string }[] | undefined) ?? []).map((d) => ({ id: d.id, label: d.name }));
  const pay = toNumber(salary || "0");
  const canSubmit = first.trim().length > 0 && last.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim()) && isIsoDate(joining) && !Number.isNaN(pay) && pay >= 0;

  function submit() {
    create.mutate(
      {
        firstName: first.trim(), lastName: last.trim(), email: email.trim(), phone: phone.trim() || undefined,
        jobTitle: title.trim() || undefined, departmentId: dept?.id, departmentName: dept?.label,
        employmentType: type, basicSalary: pay, joiningDate: joining,
        nationality: nationality.trim() || undefined, emiratesId: emiratesId.trim() || undefined, iban: iban.trim() || undefined,
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Person">
        <TextField label="First name" required value={first} onChangeText={setFirst} autoCapitalize="words" error={fieldError(create.error, "firstName")} />
        <TextField label="Last name" required value={last} onChangeText={setLast} autoCapitalize="words" error={fieldError(create.error, "lastName")} />
        <TextField label="Email" required value={email} onChangeText={setEmail} keyboardType="email-address" error={fieldError(create.error, "email")} />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label="Nationality" value={nationality} onChangeText={setNationality} autoCapitalize="words" />
        <TextField label="Emirates ID" value={emiratesId} onChangeText={setEmiratesId} keyboardType="number-pad" />
      </Section>
      <Section title="Job">
        <TextField label="Job title" value={title} onChangeText={setTitle} autoCapitalize="words" />
        <PickerField label="Department" value={dept} onChange={setDept} options={options} loading={departments.isLoading} />
        <ChipField label="Employment type" value={type} onChange={setType} options={TYPES} />
        <DateField label="Joining date" value={joining} onChange={setJoining} required quick={[{ label: "Today", days: 0 }, { label: "Next month", days: 30 }]} />
        <NumberField label="Basic salary" value={salary} onChangeText={setSalary} placeholder="0" />
        <TextField label="IBAN" value={iban} onChangeText={setIban} autoCapitalize="characters" hint="Needed for the salary file (WPS)." />
      </Section>
      <SubmitBar label="Add employee" onPress={submit} disabled={!canSubmit} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}
