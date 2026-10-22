import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAssignableUsers, useAssignLead } from "@/hooks/use-crm-write";
import { FormScreen, PickerField, SubmitBar, TextField, errorMessage, type PickOption } from "@/components/forms/FormKit";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "LeadReassign">;

/** Hand a lead to someone else (records the handoff). Only the people the server says the caller may assign to are listed. */
export default function LeadReassignScreen({ route, navigation }: Props) {
  const { leadId } = route.params;
  const users = useAssignableUsers("crm");
  const assign = useAssignLead();
  const [to, setTo] = useState<PickOption | null>(null);
  const [note, setNote] = useState("");

  const options: PickOption[] = (users.data ?? []).map((u) => ({
    id: u.userId,
    label: u.fullName,
    sub: u.teams?.length ? u.teams.map((t) => t.name).join(", ") : u.email,
  }));

  function submit() {
    if (!to) return;
    const teams = (users.data ?? []).find((u) => u.userId === to.id)?.teams;
    assign.mutate(
      { id: leadId, toUserId: to.id, toUserName: to.label, note: note.trim() || undefined, teamId: teams && teams.length === 1 ? teams[0].teamId : null },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <PickerField label="Hand over to" required value={to} onChange={setTo} options={options} loading={users.isLoading} allowClear={false} />
      <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline />
      <SubmitBar label="Reassign lead" onPress={submit} disabled={!to} loading={assign.isPending} error={errorMessage(assign.error)} />
    </FormScreen>
  );
}
