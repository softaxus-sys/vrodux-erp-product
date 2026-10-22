import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "@/store/auth.store";
import { useAccountRaw, useAssignableUsers, useCreateAccount, useUpdateAccount } from "@/hooks/use-crm-write";
import { CUSTOMER_TIERS } from "@/lib/crm-write.api";
import {
  ChipField, FormScreen, PickerField, Section, SubmitBar, TextField, errorMessage, fieldError, type PickOption,
} from "@/components/forms/FormKit";
import { ErrorState, LoadingState } from "@/components/ui";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "AccountForm">;

/** New account (company), or edit one when `accountId` is passed. */
export default function AccountFormScreen({ route, navigation }: Props) {
  const accountId = route.params?.accountId;
  const me = useAuthStore((s) => s.user);
  const raw = useAccountRaw(accountId);
  const users = useAssignableUsers("crm");
  const create = useCreateAccount();
  const update = useUpdateAccount();

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [tier, setTier] = useState("standard");
  const [terms, setTerms] = useState("");
  const [description, setDescription] = useState("");
  const [manager, setManager] = useState<PickOption | null>(null);
  const [hydrated, setHydrated] = useState(!accountId);

  useEffect(() => {
    if (!accountId || !raw.data || hydrated) return;
    const d = raw.data as Record<string, any>;
    setName(d.name ?? ""); setIndustry(d.industry ?? ""); setPhone(d.phone ?? ""); setEmail(d.email ?? "");
    setCity(d.city ?? ""); setCountry(d.country ?? ""); setAddress(d.address ?? ""); setTier(d.tier ?? "standard");
    setTerms(d.paymentTerms ?? ""); setDescription(d.description ?? "");
    if (d.accountManagerUserId) setManager({ id: d.accountManagerUserId, label: d.accountManager || "Manager" });
    setHydrated(true);
  }, [accountId, raw.data, hydrated]);

  useEffect(() => {
    if (accountId || manager || !me) return;
    setManager({ id: me.id, label: me.fullName });
  }, [accountId, manager, me]);

  const userOptions: PickOption[] = (users.data ?? []).map((u) => ({ id: u.userId, label: u.fullName, sub: u.teams?.map((t) => t.name).join(", ") || u.email }));
  const pending = create.isPending || update.isPending;
  const err = create.error ?? update.error;

  function submit() {
    const teams = (users.data ?? []).find((u) => u.userId === manager?.id)?.teams;
    const done = () => navigation.goBack();
    const common = {
      name: name.trim(), industry: industry.trim(), country: country.trim(), city: city.trim(), address: address.trim(),
      phone: phone.trim(), email: email.trim(), tier, accountManager: manager?.label ?? "", accountManagerUserId: manager?.id ?? null,
      description: description.trim(), paymentTerms: terms.trim() || null,
    };
    if (accountId) update.mutate({ id: accountId, patch: common }, { onSuccess: done });
    else create.mutate({ ...common, teamId: teams && teams.length === 1 ? teams[0].teamId : null }, { onSuccess: done });
  }

  if (accountId && raw.isLoading) return <LoadingState />;
  if (accountId && raw.isError) return <ErrorState message="Could not load this account." onRetry={() => raw.refetch()} />;

  return (
    <FormScreen>
      <Section title="Account">
        <TextField label="Company name" required value={name} onChangeText={setName} autoCapitalize="words" error={fieldError(err, "name")} />
        <TextField label="Industry" value={industry} onChangeText={setIndustry} autoCapitalize="words" />
        <ChipField label="Tier" value={tier} onChange={setTier} options={CUSTOMER_TIERS} />
        <PickerField label="Account manager" value={manager} onChange={setManager} options={userOptions} loading={users.isLoading} allowClear={false} />
      </Section>
      <Section title="Contact">
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={fieldError(err, "phone")} />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" error={fieldError(err, "email")} />
        <TextField label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
        <TextField label="Country" value={country} onChangeText={setCountry} autoCapitalize="words" />
        <TextField label="Address" value={address} onChangeText={setAddress} multiline />
        <TextField label="Payment terms" value={terms} onChangeText={setTerms} placeholder="e.g. Net 30" />
        <TextField label="Notes" value={description} onChangeText={setDescription} multiline />
      </Section>
      <SubmitBar label={accountId ? "Save changes" : "Create account"} onPress={submit} disabled={name.trim().length === 0} loading={pending} error={errorMessage(err)} />
    </FormScreen>
  );
}
