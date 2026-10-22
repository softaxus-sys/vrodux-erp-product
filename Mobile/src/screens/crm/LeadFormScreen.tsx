import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "@/store/auth.store";
import { useAssignableUsers, useCreateLead, useLeadRaw, useUpdateLead } from "@/hooks/use-crm-write";
import { LEAD_SOURCES, PRIORITIES, TIMEFRAMES, type LeadForm } from "@/lib/crm-write.api";
import {
  ChipField, FormScreen, NumberField, PickerField, Section, SubmitBar, TextField, errorMessage, fieldError, toNumber, type PickOption,
} from "@/components/forms/FormKit";
import { ErrorState, LoadingState } from "@/components/ui";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "LeadForm">;

/** New lead, or edit one when `leadId` is passed. Owner defaults to the signed-in user. */
export default function LeadFormScreen({ route, navigation }: Props) {
  const leadId = route.params?.leadId;
  const me = useAuthStore((s) => s.user);
  const raw = useLeadRaw(leadId);
  const users = useAssignableUsers("crm");
  const create = useCreateLead();
  const update = useUpdateLead();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsApp, setWhatsApp] = useState("");
  const [city, setCity] = useState("");
  const [source, setSource] = useState("website");
  const [priority, setPriority] = useState("medium");
  const [value, setValue] = useState("");
  const [interestedIn, setInterestedIn] = useState("");
  const [budget, setBudget] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState<PickOption | null>(null);
  const [ownerTeam, setOwnerTeam] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!leadId);

  // Edit: fill the form once from the server copy.
  useEffect(() => {
    if (!leadId || !raw.data || hydrated) return;
    const d = raw.data as Record<string, any>;
    setFirstName(d.firstName ?? ""); setLastName(d.lastName ?? ""); setCompany(d.company ?? ""); setTitle(d.title ?? "");
    setEmail(d.email ?? ""); setPhone(d.phone ?? ""); setWhatsApp(d.whatsApp ?? ""); setCity(d.city ?? "");
    setSource(d.source ?? "website"); setPriority(d.priority ?? "medium"); setValue(d.estimatedValue ? String(d.estimatedValue) : "");
    setInterestedIn(d.interestedIn ?? ""); setBudget(d.budget ?? ""); setTimeframe(d.purchaseTimeframe ?? "");
    setMessage(d.message ?? ""); setNotes(d.notes ?? "");
    if (d.assignedToUserId) { setOwner({ id: d.assignedToUserId, label: d.assignedTo || "Assigned" }); setOwnerTeam(d.teamId ?? null); }
    setHydrated(true);
  }, [leadId, raw.data, hydrated]);

  // Create: default the owner to me once the pool is known.
  useEffect(() => {
    if (leadId || owner || !me) return;
    setOwner({ id: me.id, label: me.fullName });
  }, [leadId, owner, me]);

  const options: PickOption[] = (users.data ?? []).map((u) => ({
    id: u.userId,
    label: u.fullName,
    sub: u.teams?.length ? u.teams.map((t) => t.name).join(", ") : u.email,
  }));

  const valueNum = value.trim() ? toNumber(value) : 0;
  const hasName = firstName.trim().length > 0 || lastName.trim().length > 0;
  const hasContact = email.trim().length > 0 || phone.trim().length > 0;
  const canSubmit = hasName && hasContact && !Number.isNaN(valueNum);
  const pending = create.isPending || update.isPending;
  const err = create.error ?? update.error;

  function submit() {
    const teamOfOwner = (users.data ?? []).find((u) => u.userId === owner?.id)?.teams;
    const form: LeadForm = {
      firstName: firstName.trim(), lastName: lastName.trim(), title: title.trim(), company: company.trim(), industry: "",
      email: email.trim(), phone: phone.trim(), whatsApp: whatsApp.trim(), country: "", city: city.trim(), source, priority,
      estimatedValue: valueNum, notes: notes.trim(), interestedIn: interestedIn.trim(), budget: budget.trim(), message: message.trim(),
      purchaseTimeframe: timeframe,
      assignedToUserId: owner?.id ?? null,
      assignedTo: owner?.label ?? "",
      // One team: file to it. Several: leave it unfiled rather than guess (same rule the web form applies).
      teamId: ownerTeam ?? (teamOfOwner && teamOfOwner.length === 1 ? teamOfOwner[0].teamId : null),
    };
    const done = () => navigation.goBack();
    if (leadId) update.mutate({ id: leadId, patch: form }, { onSuccess: done });
    else create.mutate(form, { onSuccess: done });
  }

  if (leadId && raw.isLoading) return <LoadingState />;
  if (leadId && raw.isError) return <ErrorState message="Could not load this lead." onRetry={() => raw.refetch()} />;

  return (
    <FormScreen>
      <Section title="Contact">
        <TextField label="First name" required={!lastName.trim()} value={firstName} onChangeText={setFirstName} autoCapitalize="words" error={fieldError(err, "firstName")} />
        <TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" error={fieldError(err, "lastName")} />
        <TextField label="Company" value={company} onChangeText={setCompany} autoCapitalize="words" />
        <TextField label="Job title" value={title} onChangeText={setTitle} autoCapitalize="words" />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" error={fieldError(err, "email")} hint="An email or a phone number is needed." />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={fieldError(err, "phone")} />
        <TextField label="WhatsApp" value={whatsApp} onChangeText={setWhatsApp} keyboardType="phone-pad" />
        <TextField label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
      </Section>

      <Section title="Lead">
        <ChipField label="Source" value={source} onChange={setSource} options={LEAD_SOURCES} />
        <ChipField label="Priority" value={priority} onChange={setPriority} options={PRIORITIES} />
        <NumberField label="Estimated value" value={value} onChangeText={setValue} placeholder="0" error={fieldError(err, "estimatedValue")} />
        <PickerField label="Owner" value={owner} onChange={(o) => { setOwner(o); setOwnerTeam(null); }} options={options} loading={users.isLoading} allowClear={false} />
      </Section>

      <Section title="What they want">
        <TextField label="Interested in" value={interestedIn} onChangeText={setInterestedIn} />
        <TextField label="Budget" value={budget} onChangeText={setBudget} placeholder="e.g. 50k, AED 500,000" autoCapitalize="none" />
        <ChipField label="Planning to buy" value={timeframe} onChange={setTimeframe} options={TIMEFRAMES} />
        <TextField label="Message" value={message} onChangeText={setMessage} multiline />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Section>

      <SubmitBar
        label={leadId ? "Save changes" : "Create lead"}
        onPress={submit}
        disabled={!canSubmit}
        loading={pending}
        error={errorMessage(err)}
      />
    </FormScreen>
  );
}
