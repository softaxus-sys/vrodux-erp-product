import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useContacts, useSaveContact } from "@/hooks/use-crm-extra";
import { FormScreen, Section, SubmitBar, SwitchField, TextField, errorMessage, fieldError } from "@/components/forms/FormKit";
import { LoadingState } from "@/components/ui";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "ContactForm">;

/** Add a contact to an account, or edit one. */
export default function ContactFormScreen({ route, navigation }: Props) {
  const { accountId, contactId } = route.params;
  const contacts = useContacts(accountId);
  const save = useSaveContact();
  const existing = contactId ? (contacts.data ?? []).find((c) => c.id === contactId) : undefined;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [hydrated, setHydrated] = useState(!contactId);

  useEffect(() => {
    if (!contactId || hydrated || !existing) return;
    setFirstName(existing.firstName); setLastName(existing.lastName); setTitle(existing.title ?? ""); setDepartment(existing.department ?? "");
    setEmail(existing.email ?? ""); setPhone(existing.phone ?? ""); setNotes(existing.notes ?? ""); setIsPrimary(existing.isPrimary);
    setHydrated(true);
  }, [contactId, existing, hydrated]);

  useEffect(() => navigation.setOptions({ headerTitle: contactId ? "Edit contact" : "New contact" }), [navigation, contactId]);

  if (contactId && !hydrated) return <LoadingState />;

  const canSubmit = firstName.trim().length > 0 || lastName.trim().length > 0;

  function submit() {
    save.mutate(
      {
        id: contactId,
        body: {
          customerId: accountId, firstName: firstName.trim(), lastName: lastName.trim(), title: title.trim(),
          email: email.trim(), phone: phone.trim(), department: department.trim() || null, isPrimary, notes: notes.trim() || null,
        },
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section>
        <TextField label="First name" required={!lastName.trim()} value={firstName} onChangeText={setFirstName} autoCapitalize="words" error={fieldError(save.error, "firstName")} />
        <TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" error={fieldError(save.error, "lastName")} />
        <TextField label="Job title" value={title} onChangeText={setTitle} autoCapitalize="words" />
        <TextField label="Department" value={department} onChangeText={setDepartment} autoCapitalize="words" />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" error={fieldError(save.error, "email")} />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={fieldError(save.error, "phone")} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
        <SwitchField label="Primary contact" value={isPrimary} onChange={setIsPrimary} hint="The main person to reach at this account." />
      </Section>
      <SubmitBar label={contactId ? "Save changes" : "Add contact"} onPress={submit} disabled={!canSubmit} loading={save.isPending} error={errorMessage(save.error)} />
    </FormScreen>
  );
}
