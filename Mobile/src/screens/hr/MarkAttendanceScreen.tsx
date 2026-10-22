import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useEmployees } from "@/hooks/use-hr-directory";
import {
  ChipField, DateField, FormScreen, PickerField, Section, SubmitBar, TextField, errorMessage, isIsoDate, todayIso, type PickOption,
} from "@/components/forms/FormKit";
import type { HrStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<HrStackParamList, "MarkAttendance">;

const STATUSES = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half day" },
  { value: "remote", label: "Remote" },
  { value: "on_leave", label: "On leave" },
];

const isTime = (v: string) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Record attendance for someone else (a manager marking their team). Everyone's own check-in is on the HR home screen. */
export default function MarkAttendanceScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const employees = useEmployees();
  const mark = useMutation({
    mutationFn: (body: unknown) => apiClient.post("/api/hr/attendance", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-self"] }),
  });

  const [employee, setEmployee] = useState<PickOption | null>(null);
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState("present");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [notes, setNotes] = useState("");

  const rows = employees.data ?? [];
  const options: PickOption[] = rows.map((e) => ({ id: e.id, label: e.fullName, sub: e.designation }));
  const canSubmit = employee !== null && isIsoDate(date) && isTime(checkIn) && isTime(checkOut);

  function submit() {
    if (!employee) return;
    mark.mutate(
      { employeeId: employee.id, employeeName: employee.label, date, status, checkIn: checkIn || null, checkOut: checkOut || null, notes: notes.trim() || null },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Attendance">
        <PickerField label="Employee" required value={employee} onChange={setEmployee} options={options} loading={employees.isLoading} allowClear={false} />
        <DateField label="Date" value={date} onChange={setDate} required quick={[{ label: "Today", days: 0 }, { label: "Yesterday", days: -1 }]} />
        <ChipField label="Status" value={status} onChange={setStatus} options={STATUSES} />
        <TextField label="Check in" value={checkIn} onChangeText={setCheckIn} placeholder="HH:mm  e.g. 09:00" keyboardType="numbers-and-punctuation" error={isTime(checkIn) ? undefined : "Use HH:mm"} />
        <TextField label="Check out" value={checkOut} onChangeText={setCheckOut} placeholder="HH:mm  e.g. 18:00" keyboardType="numbers-and-punctuation" error={isTime(checkOut) ? undefined : "Use HH:mm"} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Section>
      <SubmitBar label="Save attendance" onPress={submit} disabled={!canSubmit} loading={mark.isPending} error={errorMessage(mark.error)} />
    </FormScreen>
  );
}
