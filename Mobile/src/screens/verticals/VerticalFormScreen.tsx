import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { VERTICAL_FORMS, type VerticalField } from "@/lib/vertical-forms";
import {
  ChipField, DateField, FormScreen, NumberField, PickerField, Section, SubmitBar, TextField, errorMessage, isIsoDate, toNumber, type PickOption,
} from "@/components/forms/FormKit";

type Props = NativeStackScreenProps<{ VerticalForm: { formKey: string } }, "VerticalForm">;

const pad = (n: number) => String(n).padStart(2, "0");
function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

function initial(f: VerticalField): string {
  if (f.kind === "date") return f.dateOffsetDays !== undefined ? isoOffset(f.dateOffsetDays) : "";
  if (f.kind === "datetime") return `${isoOffset(0)}|09:00`;
  return f.default ?? "";
}

/** Renders any create form from `VERTICAL_FORMS`, so each pack's records share one tested screen. */
export default function VerticalFormScreen({ route, navigation }: Props) {
  const spec = VERTICAL_FORMS[route.params.formKey];
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(spec.fields.map((f) => [f.name, initial(f)])));
  const [picked, setPicked] = useState<Record<string, PickOption | null>>({});

  const create = useMutation({
    mutationFn: (body: unknown) => apiClient.post(spec.path, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [spec.queryKey] }),
  });

  const set = (name: string, v: string) => setValues((s) => ({ ...s, [name]: v }));

  const valid = spec.fields.every((f) => {
    const v = values[f.name] ?? "";
    if (f.kind === "lookup") return !f.required || Boolean(picked[f.name]);
    if (f.kind === "datetime") {
      const [d, t] = v.split("|");
      return (!f.required && !d) || (isIsoDate(d ?? "") && isTime(t ?? ""));
    }
    if (f.required && v.trim() === "") return false;
    if (f.kind === "number" && v.trim() !== "") return !Number.isNaN(toNumber(v)) && toNumber(v) >= 0;
    if (f.kind === "date" && v !== "") return isIsoDate(v);
    return true;
  });

  function submit() {
    const body: Record<string, unknown> = {};
    for (const f of spec.fields) {
      const v = (values[f.name] ?? "").trim();
      if (f.kind === "lookup") {
        const p = picked[f.name];
        body[f.name] = p?.id ?? null;
        if (f.labelAs) body[f.labelAs] = p?.label ?? null;
      } else if (f.kind === "number") {
        body[f.name] = v === "" ? (f.blank === "zero" ? 0 : null) : toNumber(v);
      } else if (f.kind === "datetime") {
        const [d, t] = (values[f.name] ?? "").split("|");
        body[f.name] = d ? `${d}T${t}` : null;
      } else {
        body[f.name] = v === "" ? null : v;
      }
    }
    create.mutate(body, { onSuccess: () => navigation.goBack() });
  }

  return (
    <FormScreen>
      <Section title={spec.title}>
        {spec.fields.map((f) => (
          <FieldInput key={f.name} field={f} value={values[f.name] ?? ""} onChange={(v) => set(f.name, v)}
            picked={picked[f.name] ?? null} onPick={(p) => setPicked((s) => ({ ...s, [f.name]: p }))} />
        ))}
      </Section>
      <SubmitBar label={spec.submitLabel} onPress={submit} disabled={!valid} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}

function FieldInput({ field: f, value, onChange, picked, onPick }: {
  field: VerticalField; value: string; onChange: (v: string) => void; picked: PickOption | null; onPick: (p: PickOption | null) => void;
}) {
  if (f.kind === "choice") return <ChipField label={f.label} value={value} onChange={onChange} options={f.options ?? []} />;
  if (f.kind === "number") return <NumberField label={f.label} required={f.required} value={value} onChangeText={onChange} />;
  if (f.kind === "date") return <DateField label={f.label} required={f.required} value={value} onChange={onChange} />;
  if (f.kind === "datetime") {
    const [d, t] = value.split("|");
    return (
      <>
        <DateField label={`${f.label} (date)`} required={f.required} value={d ?? ""} onChange={(v) => onChange(`${v}|${t ?? ""}`)} quick={[{ label: "Today", days: 0 }, { label: "Tomorrow", days: 1 }]} />
        <TextField label={`${f.label} (time)`} value={t ?? ""} onChangeText={(v) => onChange(`${d ?? ""}|${v}`)} placeholder="HH:mm  e.g. 09:30"
          keyboardType="numbers-and-punctuation" error={t && !isTime(t) ? "Use HH:mm" : undefined} />
      </>
    );
  }
  if (f.kind === "lookup") return <LookupInput field={f} picked={picked} onPick={onPick} />;
  return <TextField label={f.label} required={f.required} value={value} onChangeText={onChange} multiline={f.kind === "multiline"} autoCapitalize={f.kind === "text" ? "sentences" : undefined} />;
}

function LookupInput({ field: f, picked, onPick }: { field: VerticalField; picked: PickOption | null; onPick: (p: PickOption | null) => void }) {
  const path = f.lookup!.path;
  const q = useQuery({ queryKey: ["vertical-lookup", path], queryFn: () => apiClient.get<{ items: Record<string, unknown>[] }>(`${path}?page=1&pageSize=200`) });
  const options = useMemo<PickOption[]>(
    () => (q.data?.items ?? []).map((r) => ({
      id: String(r.id), label: String(r[f.lookup!.label] ?? ""), sub: f.lookup!.sub && r[f.lookup!.sub] ? String(r[f.lookup!.sub]) : undefined,
    })),
    [q.data, f.lookup],
  );
  return <PickerField label={f.label} required={f.required} value={picked} onChange={onPick} options={options} loading={q.isLoading} allowClear={false} />;
}
