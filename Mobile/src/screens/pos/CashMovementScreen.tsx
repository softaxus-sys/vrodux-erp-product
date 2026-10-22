import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRecordCashMovement } from "@/hooks/use-pos";
import { CASH_CATEGORIES } from "@/lib/pos.api";
import { ChipField, FormScreen, NumberField, Section, SubmitBar, TextField, errorMessage, toNumber } from "@/components/forms/FormKit";
import type { POSStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<POSStackParamList, "CashMovement">;

export default function CashMovementScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;
  const record = useRecordCashMovement();
  const [type, setType] = useState<"payin" | "payout">("payout");
  const [category, setCategory] = useState<string>(CASH_CATEGORIES.payout[0].value);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const cats = CASH_CATEGORIES[type];
  const value = toNumber(amount);
  const canSubmit = !Number.isNaN(value) && value > 0 && reason.trim().length > 0;

  function changeType(v: "payin" | "payout") {
    setType(v);
    setCategory(CASH_CATEGORIES[v][0].value);
  }

  return (
    <FormScreen>
      <Section title="Cash drawer">
        <ChipField label="Direction" value={type} onChange={changeType} options={[{ value: "payin", label: "Cash in" }, { value: "payout", label: "Cash out" }]} />
        <ChipField label="Category" value={category} onChange={setCategory} options={[...cats]} />
        <NumberField label="Amount" required value={amount} onChangeText={setAmount} />
        <TextField label="Reason" required value={reason} onChangeText={setReason} multiline />
      </Section>
      <SubmitBar
        label="Record movement"
        onPress={() => record.mutate({ sessionId, payload: { type, amount: value, reason: reason.trim(), category } }, { onSuccess: () => navigation.goBack() })}
        disabled={!canSubmit}
        loading={record.isPending}
        error={errorMessage(record.error)}
      />
    </FormScreen>
  );
}
