import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useCreateActivity } from "@/hooks/use-activities";
import { useActivityToggle } from "@/hooks/use-crm-extra";
import { useAuthStore } from "@/store/auth.store";
import type { ActivityDto, ActivityType } from "@/types/crm";
import { Button, Chip } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

const TYPES: { key: ActivityType; label: string; icon: string }[] = [
  { key: "note", label: "Note", icon: "📝" },
  { key: "call", label: "Call", icon: "☎️" },
  { key: "meeting", label: "Meeting", icon: "📅" },
  { key: "email", label: "Email", icon: "✉️" },
  { key: "task", label: "Task", icon: "✅" },
];
export const activityIcon = (t: string) => TYPES.find((x) => x.key === t)?.icon ?? "•";

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const iso = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().split("T")[0];

/** Log or schedule an activity against a lead, opportunity or account. Calls and meetings take a time. */
export function ActivityComposer({
  relatedToType, relatedToId, relatedToName,
}: { relatedToType: "lead" | "deal" | "customer"; relatedToId: string; relatedToName?: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const me = useAuthStore((s) => s.user);
  const create = useCreateActivity();
  const [type, setType] = useState<ActivityType | null>(null);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [time, setTime] = useState("");

  const scheduled = type === "call" || type === "meeting" || type === "task";
  const timed = type === "call" || type === "meeting";
  const dueOk = !due || isDate(due);
  const timeOk = !time || (isTime(time) && isDate(due));
  const needsSubject = type !== "note";
  const canSave = Boolean(type) && dueOk && timeOk && (!needsSubject || subject.trim().length > 0 || type === "call");

  function reset() {
    setType(null); setSubject(""); setNotes(""); setDue(""); setTime("");
  }

  function save() {
    if (!type) return;
    create.mutate(
      {
        type,
        subject: subject.trim() || (type === "call" ? "Phone call" : type === "note" ? "Note" : lbl(type)),
        description: notes.trim() || undefined,
        relatedToType, relatedToId, relatedToName,
        dueDate: due || undefined,
        dueTime: time || undefined,
        assignedTo: me?.fullName ?? "",
        assignedToUserId: me?.id,
      },
      { onSuccess: reset },
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.chips}>
        {TYPES.map((t) => <Chip key={t.key} label={`${t.icon} ${t.label}`} active={type === t.key} onPress={() => setType(type === t.key ? null : t.key)} />)}
      </View>
      {type ? (
        <View style={{ gap: spacing.sm }}>
          {type !== "note" ? (
            <TextInput style={styles.input} placeholder={type === "call" ? "Subject (optional)" : "Subject"} placeholderTextColor={colors.subtleForeground} value={subject} onChangeText={setSubject} />
          ) : null}
          <TextInput
            style={[styles.input, styles.multi]}
            placeholder={type === "note" ? "Note" : "Details (optional)"}
            placeholderTextColor={colors.subtleForeground}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          {scheduled ? (
            <View style={styles.chips}>
              <TextInput style={[styles.input, styles.half]} placeholder="Due YYYY-MM-DD" placeholderTextColor={colors.subtleForeground} value={due} onChangeText={setDue} autoCapitalize="none" maxLength={10} />
              {timed ? <TextInput style={[styles.input, styles.half]} placeholder="Time HH:mm" placeholderTextColor={colors.subtleForeground} value={time} onChangeText={setTime} autoCapitalize="none" maxLength={5} /> : null}
              <Chip label="Today" onPress={() => setDue(iso(0))} />
              <Chip label="Tomorrow" onPress={() => setDue(iso(1))} />
              <Chip label="+7d" onPress={() => setDue(iso(7))} />
            </View>
          ) : null}
          {!dueOk || !timeOk ? <Text style={styles.error}>Use YYYY-MM-DD for the date and HH:mm for the time (a time needs a date).</Text> : null}
          {create.isError ? <Text style={styles.error}>Could not save this activity.</Text> : null}
          <View style={styles.chips}>
            <Button label={create.isPending ? "Saving…" : type === "note" ? "Save note" : "Save"} onPress={save} disabled={!canSave || create.isPending} />
            <Button label="Cancel" variant="ghost" onPress={reset} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const lbl = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** One activity row. `onToggle` shows a complete / reopen control for tasks, calls and meetings. */
export function ActivityRow({ a, origin, canToggle = true }: { a: ActivityDto; origin?: string; canToggle?: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const toggle = useActivityToggle();
  const actionable = a.type === "task" || a.type === "call" || a.type === "meeting";
  const today = iso(0);
  const overdue = actionable && !a.completed && a.dueDate && a.dueDate < today;
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.subject, a.completed && styles.done]}>{activityIcon(a.type)} {a.subject}</Text>
        {a.description ? <Text style={styles.notes}>{a.description}</Text> : null}
        <Text style={[styles.date, overdue ? { color: colors.destructive } : null]}>
          {a.dueDate ? `Due ${a.dueDate}${a.dueTime ? ` ${a.dueTime}` : ""}${overdue ? " · overdue" : ""} · ` : ""}
          {origin ? `${origin} · ` : ""}Logged {new Date(a.createdAt).toLocaleString()}
        </Text>
      </View>
      {actionable && canToggle ? (
        <Button
          label={a.completed ? "Reopen" : "Done"}
          size="sm"
          variant={a.completed ? "ghost" : "outline"}
          disabled={toggle.isPending}
          onPress={() => toggle.mutate({ id: a.id, complete: !a.completed })}
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm + 2,
      backgroundColor: colors.card, fontSize: fontSize.md, color: colors.foreground,
    },
    multi: { minHeight: 44, textAlignVertical: "top" },
    half: { minWidth: 130 },
    error: { fontSize: fontSize.sm, color: colors.destructive },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs },
    subject: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    done: { textDecorationLine: "line-through", color: colors.mutedForeground },
    notes: { fontSize: fontSize.base, color: colors.mutedForeground },
    date: { fontSize: fontSize.xs, color: colors.subtleForeground },
  });
}
