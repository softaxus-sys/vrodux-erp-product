import { useState } from "react";
import { Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useActiveSessions, useRefundTransaction, useTransaction, useVoidTransaction } from "@/hooks/use-pos";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { ChipField, FormScreen, Section, SubmitBar, TextField, errorMessage } from "@/components/forms/FormKit";
import { ErrorState, LoadingState } from "@/components/ui";
import type { POSStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<POSStackParamList, "TransactionAction">;

const METHODS = ["Cash", "Card", "Mobile"].map((v) => ({ value: v, label: v }));

/** Void a sale, or refund all of it. Partial refunds stay on the till/web for now. */
export default function TransactionActionScreen({ route, navigation }: Props) {
  const { transactionId, mode } = route.params;
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const txn = useTransaction(transactionId);
  const sessions = useActiveSessions();
  const voidTxn = useVoidTransaction();
  const refundTxn = useRefundTransaction();
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("Cash");

  if (txn.isLoading || !txn.data) return <LoadingState />;
  if (txn.isError) return <ErrorState message="Couldn't load this transaction." onRetry={() => txn.refetch()} />;
  const t = txn.data;
  const openSession = (sessions.data ?? [])[0];
  const pending = voidTxn.isPending || refundTxn.isPending;
  const error = errorMessage(voidTxn.error ?? refundTxn.error);

  function submit() {
    const done = { onSuccess: () => navigation.goBack() };
    if (mode === "void") {
      voidTxn.mutate({ id: t.id, reason: reason.trim() }, done);
      return;
    }
    if (!openSession) return;
    refundTxn.mutate(
      {
        id: t.id,
        payload: {
          sessionId: openSession.id,
          lineItems: t.lineItems.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPriceOverride: l.unitPrice, discountPercent: 0, discountAmount: 0 })),
          payments: [{ method, amount: t.totalAmount, reference: null }],
          reason: reason.trim() || "Customer refund",
        },
      },
      done,
    );
  }

  return (
    <FormScreen>
      <Section title={mode === "void" ? "Void sale" : "Refund sale"}>
        <Text>{t.transactionNumber} · {formatCompactValue(t.totalAmount, currency)}</Text>
        {mode === "refund" ? <ChipField label="Refund by" value={method} onChange={setMethod} options={METHODS} /> : null}
        <TextField label="Reason" required={mode === "void"} value={reason} onChangeText={setReason} multiline />
        {mode === "refund" && !openSession ? <Text>Open a shift first — a refund is recorded against an open shift.</Text> : null}
      </Section>
      <SubmitBar
        label={mode === "void" ? "Void sale" : `Refund ${formatCompactValue(t.totalAmount, currency)}`}
        onPress={submit}
        disabled={pending || (mode === "void" ? reason.trim().length === 0 : !openSession)}
        loading={pending}
        error={error}
      />
    </FormScreen>
  );
}
