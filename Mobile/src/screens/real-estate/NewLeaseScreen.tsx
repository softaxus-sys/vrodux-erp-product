import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { usePropertiesPaged, useTenantsPaged, useUnitsPaged } from "@/hooks/use-real-estate";
import {
  ChipField, DateField, FormScreen, NumberField, PickerField, Section, SubmitBar, TextField, errorMessage, isIsoDate, todayIso, toNumber, type PickOption,
} from "@/components/forms/FormKit";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "NewLease">;

const FREQ = [{ value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "semi_annual", label: "Half-yearly" }, { value: "annual", label: "Yearly" }];

function plusYear(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Property, then a vacant unit, then the tenant, then term and rent. The rent schedule is built by the server. */
export default function NewLeaseScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (body: unknown) => apiClient.post("/api/real-estate/contracts", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["real-estate"] }),
  });
  const [property, setProperty] = useState<PickOption | null>(null);
  const [unit, setUnit] = useState<PickOption | null>(null);
  const [tenant, setTenant] = useState<PickOption | null>(null);
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(plusYear(todayIso()));
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [freq, setFreq] = useState("quarterly");
  const [ejari, setEjari] = useState("");
  const [advance, setAdvance] = useState("");
  const [notes, setNotes] = useState("");

  const properties = usePropertiesPaged({ pageSize: 200 });
  const units = useUnitsPaged({ propertyId: property?.id, status: "vacant", pageSize: 200 }, property !== null);
  const tenants = useTenantsPaged({ pageSize: 200 });

  const rentN = toNumber(rent || "0");
  const depN = toNumber(deposit || "0");
  const advN = toNumber(advance || "0");
  const canSubmit = Boolean(property && unit && tenant) && isIsoDate(start) && isIsoDate(end) && end > start && rentN > 0 && depN >= 0 && advN >= 0;

  function submit() {
    if (!property || !unit || !tenant) return;
    create.mutate(
      {
        propertyId: property.id, unitId: unit.id, tenantId: tenant.id, startDate: start, endDate: end, annualRent: rentN,
        securityDeposit: depN, paymentFrequency: freq, ejariNumber: ejari.trim() || null, notes: notes.trim() || null,
        advanceRentAmount: advN, advancePaidDate: advN > 0 ? todayIso() : null, advanceMethod: advN > 0 ? "cash" : null, advanceReference: null,
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Who and where">
        <PickerField label="Building" required value={property} onChange={(v) => { setProperty(v); setUnit(null); }}
          options={(properties.data?.items ?? []).map((p) => ({ id: p.id, label: p.name, sub: p.propertyNumber }))} loading={properties.isLoading} allowClear={false} />
        <PickerField label="Vacant unit" required value={unit} onChange={setUnit}
          options={(units.data?.items ?? []).map((u) => ({ id: u.id, label: u.unitNumber, sub: u.unitType }))} loading={units.isLoading} allowClear={false} />
        <PickerField label="Tenant" required value={tenant} onChange={setTenant}
          options={(tenants.data?.items ?? []).map((t) => ({ id: t.id, label: t.name, sub: t.phone }))} loading={tenants.isLoading} allowClear={false} />
      </Section>
      <Section title="Term and rent">
        <DateField label="Start" required value={start} onChange={(v) => { setStart(v); if (isIsoDate(v)) setEnd(plusYear(v)); }} />
        <DateField label="End" required value={end} onChange={setEnd} />
        <NumberField label="Annual rent" required value={rent} onChangeText={setRent} />
        <ChipField label="Payments" value={freq} onChange={setFreq} options={FREQ} />
        <NumberField label="Security deposit" value={deposit} onChangeText={setDeposit} />
        <NumberField label="Advance rent received (cash)" value={advance} onChangeText={setAdvance} hint="Applied to the first payments so they are not chased." />
        <TextField label="Ejari number" value={ejari} onChangeText={setEjari} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Section>
      <SubmitBar label="Create lease" onPress={submit} disabled={!canSubmit} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}
