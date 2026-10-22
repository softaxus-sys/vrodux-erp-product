import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "@/store/auth.store";
import { useAccountsSearch, useAssignableUsers, useCreateDeal, useDealRaw, useUpdateDeal } from "@/hooks/use-crm-write";
import { LEAD_SOURCES, PRIORITIES } from "@/lib/crm-write.api";
import { STAGE_PROBABILITY } from "@/types/crm";
import type { DealStage } from "@/types/crm";
import {
  ChipField, DateField, FormScreen, NumberField, PickerField, Section, SubmitBar, TextField, errorMessage, fieldError, isIsoDate, todayIso, toNumber,
  type PickOption,
} from "@/components/forms/FormKit";
import { ErrorState, LoadingState } from "@/components/ui";
import type { DealsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<DealsStackParamList, "DealForm">;

const STAGES: { value: DealStage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
];

/** New opportunity, or edit one when `dealId` is passed. Moving a deal between stages (and won / lost) stays on the deal screen. */
export default function DealFormScreen({ route, navigation }: Props) {
  const dealId = route.params?.dealId;
  const me = useAuthStore((s) => s.user);
  const raw = useDealRaw(dealId);
  const users = useAssignableUsers("crm");
  const create = useCreateDeal();
  const update = useUpdateDeal();

  const [title, setTitle] = useState("");
  const [account, setAccount] = useState<PickOption | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [company, setCompany] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<DealStage>("lead");
  const [priority, setPriority] = useState("medium");
  const [close, setClose] = useState(todayIso(30));
  const [source, setSource] = useState("website");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState<PickOption | null>(null);
  const [hydrated, setHydrated] = useState(!dealId);
  const accounts = useAccountsSearch(accountSearch);

  useEffect(() => {
    if (!dealId || !raw.data || hydrated) return;
    const d = raw.data as Record<string, any>;
    setTitle(d.title ?? ""); setCompany(d.company ?? ""); setValue(d.value ? String(d.value) : "");
    setStage((d.stage as DealStage) ?? "lead"); setPriority(d.priority ?? "medium");
    setClose((d.expectedCloseDate ?? "").slice(0, 10)); setSource(d.source ?? "website"); setDescription(d.description ?? "");
    if (d.customerId) setAccount({ id: d.customerId, label: d.company || "Account" });
    if (d.assignedToUserId) setOwner({ id: d.assignedToUserId, label: d.assignedTo || "Assigned" });
    setHydrated(true);
  }, [dealId, raw.data, hydrated]);

  useEffect(() => {
    if (dealId || owner || !me) return;
    setOwner({ id: me.id, label: me.fullName });
  }, [dealId, owner, me]);

  const accountOptions: PickOption[] = (accounts.data?.items ?? []).map((a) => ({ id: a.id, label: a.name, sub: [a.city, a.tier].filter(Boolean).join(" · ") }));
  const userOptions: PickOption[] = (users.data ?? []).map((u) => ({ id: u.userId, label: u.fullName, sub: u.teams?.map((t) => t.name).join(", ") || u.email }));

  const valueNum = toNumber(value || "0");
  const canSubmit = title.trim().length > 0 && !Number.isNaN(valueNum) && valueNum >= 0 && isIsoDate(close) && (account !== null || company.trim().length > 0);
  const pending = create.isPending || update.isPending;
  const err = create.error ?? update.error;

  function submit() {
    const teams = (users.data ?? []).find((u) => u.userId === owner?.id)?.teams;
    const company_ = account?.label ?? company.trim();
    const done = () => navigation.goBack();
    if (dealId) {
      update.mutate(
        {
          id: dealId,
          patch: {
            title: title.trim(), company: company_, value: valueNum, stage, priority, probability: STAGE_PROBABILITY[stage],
            expectedCloseDate: close, source, description: description.trim(), customerId: account?.id ?? null,
            assignedTo: owner?.label ?? "", assignedToUserId: owner?.id ?? null,
          },
        },
        { onSuccess: done },
      );
    } else {
      create.mutate(
        {
          title: title.trim(), company: company_, value: valueNum, stage, priority, probability: STAGE_PROBABILITY[stage],
          expectedCloseDate: close, assignedTo: owner?.label ?? "", assignedToUserId: owner?.id ?? null,
          teamId: teams && teams.length === 1 ? teams[0].teamId : null,
          source, industry: "", description: description.trim(), customerId: account?.id ?? null,
        },
        { onSuccess: done },
      );
    }
  }

  if (dealId && raw.isLoading) return <LoadingState />;
  if (dealId && raw.isError) return <ErrorState message="Could not load this deal." onRetry={() => raw.refetch()} />;

  return (
    <FormScreen>
      <Section title="Opportunity">
        <TextField label="Title" required value={title} onChangeText={setTitle} placeholder="e.g. POS rollout, 5 branches" error={fieldError(err, "title")} />
        <PickerField
          label="Account"
          value={account}
          onChange={setAccount}
          options={accountOptions}
          onSearch={setAccountSearch}
          loading={accounts.isFetching}
          placeholder="Pick an existing account"
        />
        {!account ? <TextField label="Company name" required value={company} onChangeText={setCompany} autoCapitalize="words" hint="Or pick an account above." /> : null}
        <NumberField label="Value" value={value} onChangeText={setValue} placeholder="0" error={fieldError(err, "value")} />
        <ChipField label="Stage" value={stage} onChange={setStage} options={STAGES} />
        <ChipField label="Priority" value={priority} onChange={setPriority} options={PRIORITIES} />
        <DateField label="Expected close" value={close} onChange={setClose} required error={fieldError(err, "expectedCloseDate")} />
        <ChipField label="Source" value={source} onChange={setSource} options={LEAD_SOURCES} />
        <PickerField label="Owner" value={owner} onChange={setOwner} options={userOptions} loading={users.isLoading} allowClear={false} />
        <TextField label="Description" value={description} onChangeText={setDescription} multiline />
      </Section>
      <SubmitBar label={dealId ? "Save changes" : "Create opportunity"} onPress={submit} disabled={!canSubmit} loading={pending} error={errorMessage(err)} />
    </FormScreen>
  );
}
