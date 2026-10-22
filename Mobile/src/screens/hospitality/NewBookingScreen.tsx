import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useRooms } from "@/hooks/use-hospitality";
import {
  ChipField, DateField, FormScreen, NumberField, PickerField, Section, SubmitBar, TextField, errorMessage, isIsoDate, todayIso, toNumber, type PickOption,
} from "@/components/forms/FormKit";
import type { HospitalityStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<HospitalityStackParamList, "NewBooking">;

const SOURCES = [{ value: "direct", label: "Direct" }, { value: "online", label: "OTA" }, { value: "agent", label: "Agent" }, { value: "walk_in", label: "Walk-in" }, { value: "corporate", label: "Corporate" }];
const METHODS = [{ value: "cash", label: "Cash" }, { value: "card", label: "Card" }, { value: "bank_transfer", label: "Bank" }, { value: "cheque", label: "Cheque" }];

const DAY = 86_400_000;
const nightsBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY);
function addDays(iso: string, n: number): string {
  const d = new Date(new Date(`${iso}T00:00:00`).getTime() + n * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NewBookingScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const rooms = useRooms();
  const create = useMutation({
    mutationFn: (body: unknown) => apiClient.post("/api/hospitality/bookings", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hospitality"] }),
  });

  const [room, setRoom] = useState<PickOption | null>(null);
  const [checkIn, setCheckIn] = useState(todayIso());
  const [checkOut, setCheckOut] = useState(addDays(todayIso(), 1));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [source, setSource] = useState("direct");
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState("cash");
  const [requests, setRequests] = useState("");

  const list = rooms.data ?? [];
  const options: PickOption[] = list.map((r) => ({ id: r.id, label: `Room ${r.roomNumber}`, sub: `${r.roomType} · ${r.status} · ${r.ratePerNight}/night` }));
  const nights = isIsoDate(checkIn) && isIsoDate(checkOut) ? nightsBetween(checkIn, checkOut) : 0;
  const dep = toNumber(deposit || "0");
  const canSubmit = room !== null && nights > 0 && name.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim()) && phone.trim().length > 0
    && nationality.trim().length > 0 && !Number.isNaN(dep) && dep >= 0;

  function submit() {
    if (!room) return;
    create.mutate(
      {
        roomId: room.id, guestName: name.trim(), guestEmail: email.trim(), guestPhone: phone.trim(), guestNationality: nationality.trim(),
        checkIn, checkOut, nights, adults: Math.max(1, Math.round(toNumber(adults) || 1)), children: Math.max(0, Math.round(toNumber(children) || 0)),
        source, specialRequests: requests.trim() || null,
        paidAmount: dep > 0 ? dep : null, paymentMethod: dep > 0 ? method : null,
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Stay">
        <PickerField label="Room" required value={room} onChange={setRoom} options={options} loading={rooms.isLoading} allowClear={false} />
        <DateField label="Check in" required value={checkIn} onChange={setCheckIn} quick={[{ label: "Today", days: 0 }, { label: "Tomorrow", days: 1 }]} />
        <DateField label="Check out" required value={checkOut} onChange={setCheckOut} />
        <NumberField label="Adults" value={adults} onChangeText={setAdults} />
        <NumberField label="Children" value={children} onChangeText={setChildren} />
        <ChipField label="Source" value={source} onChange={setSource} options={SOURCES} />
      </Section>
      <Section title="Guest">
        <TextField label="Full name" required value={name} onChangeText={setName} autoCapitalize="words" />
        <TextField label="Email" required value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="Phone" required value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label="Nationality" required value={nationality} onChangeText={setNationality} autoCapitalize="words" />
        <TextField label="Special requests" value={requests} onChangeText={setRequests} multiline />
      </Section>
      <Section title="Deposit">
        <NumberField label="Deposit paid" value={deposit} onChangeText={setDeposit} />
        {dep > 0 ? <ChipField label="Paid by" value={method} onChange={setMethod} options={METHODS} /> : null}
      </Section>
      <SubmitBar label={nights > 0 ? `Book ${nights} night${nights === 1 ? "" : "s"}` : "Create booking"} onPress={submit} disabled={!canSubmit} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}
