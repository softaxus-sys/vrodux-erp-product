import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { DateField, FormScreen, Section, SubmitBar, SwitchField, TextField, errorMessage, isIsoDate, todayIso } from "@/components/forms/FormKit";
import type { ExtraStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<ExtraStackParamList, "NewEvent">;

const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Local date + time on this phone -> the UTC instants the calendar stores. */
function toUtc(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

export default function NewEventScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (body: unknown) => apiClient.post("/api/calendar/events", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["module-list"] }),
  });
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [guests, setGuests] = useState("");

  const emails = guests.split(/[,\s;]+/).filter(Boolean);
  const badEmail = emails.find((e) => !/\S+@\S+\.\S+/.test(e));
  const timesOk = allDay || (isTime(start) && isTime(end) && end > start);
  const canSubmit = title.trim().length > 0 && isIsoDate(date) && timesOk && !badEmail;

  function submit() {
    let startUtc: string;
    let endUtc: string;
    if (allDay) {
      // All-day: midnight UTC of the day, and of the day after (the calendar's own convention).
      const day = new Date(`${date}T00:00:00Z`);
      startUtc = day.toISOString();
      endUtc = new Date(day.getTime() + 86_400_000).toISOString();
    } else {
      startUtc = toUtc(date, start);
      endUtc = toUtc(date, end);
    }
    create.mutate(
      {
        title: title.trim(), description: description.trim() || undefined, location: location.trim() || undefined,
        startUtc, endUtc, isAllDay: allDay, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        attendees: emails.map((email) => ({ email })), addMeet: false,
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Event">
        <TextField label="Title" required value={title} onChangeText={setTitle} />
        <DateField label="Date" required value={date} onChange={setDate} quick={[{ label: "Today", days: 0 }, { label: "Tomorrow", days: 1 }]} />
        <SwitchField label="All day" value={allDay} onChange={setAllDay} />
        {allDay ? null : (
          <>
            <TextField label="Starts" value={start} onChangeText={setStart} placeholder="HH:mm" keyboardType="numbers-and-punctuation" error={isTime(start) ? undefined : "Use HH:mm"} />
            <TextField label="Ends" value={end} onChangeText={setEnd} placeholder="HH:mm" keyboardType="numbers-and-punctuation" error={!isTime(end) ? "Use HH:mm" : end <= start ? "Must be after the start" : undefined} />
          </>
        )}
        <TextField label="Location" value={location} onChangeText={setLocation} />
        <TextField label="Guests (emails)" value={guests} onChangeText={setGuests} keyboardType="email-address" error={badEmail ? `"${badEmail}" is not an email` : undefined} />
        <TextField label="Notes" value={description} onChangeText={setDescription} multiline />
      </Section>
      <SubmitBar label="Add event" onPress={submit} disabled={!canSubmit} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}
