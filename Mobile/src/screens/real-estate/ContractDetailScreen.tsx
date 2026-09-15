import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useContract, useRecordPayment, useRemindContract, useWaiveInstallment } from "@/hooks/use-real-estate";
import { RecordPaymentModal, type RecordPaymentInput } from "@/components/real-estate/RecordPaymentModal";
import { formatCompactValue } from "@/lib/crm-helpers";
import { REAL_ESTATE_RENT_RECORD, REAL_ESTATE_RENT_REMIND } from "@/lib/real-estate.api";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONE,
  INSTALLMENT_STATUS_LABELS,
  INSTALLMENT_STATUS_TONE,
  PAYMENT_FREQUENCY_LABELS,
} from "@/types/real-estate";
import type { RentInstallmentDto } from "@/types/real-estate";
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "ContractDetail">;

export default function ContractDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contractId, contractNumber } = route.params;
  navigation.setOptions({ headerTitle: contractNumber });
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const canRecord = hasPermission(REAL_ESTATE_RENT_RECORD);
  const canRemind = hasPermission(REAL_ESTATE_RENT_REMIND);

  const detail = useContract(contractId);
  const recordPayment = useRecordPayment();
  const waive = useWaiveInstallment();
  const remind = useRemindContract();

  const [payingId, setPayingId] = useState<string | null>(null);
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");

  if (detail.isLoading || !detail.data) {
    return <LoadingState />;
  }
  if (detail.isError) {
    return <ErrorState message="Couldn't load this contract." onRetry={() => detail.refetch()} />;
  }

  const { contract: c, installments } = detail.data;
  const paying = installments.find((i) => i.id === payingId) ?? null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>
          {c.propertyName} · {c.unitNumber}
        </Text>
        <View style={styles.subtitleRow}>
          <Badge label={CONTRACT_STATUS_LABELS[c.status] ?? c.status} tone={CONTRACT_STATUS_TONE[c.status] ?? "neutral"} />
          <Text style={styles.subtitle}>{c.tenantName}</Text>
        </View>
        <View style={styles.statsRow}>
          <Stat label="Annual Rent" value={formatCompactValue(c.annualRent, currency)} />
          <Stat label="Collected" value={formatCompactValue(c.totalPaid, currency)} />
          <Stat label="Balance" value={formatCompactValue(c.balance, currency)} tone={c.balance > 0 ? "primary" : "default"} />
          {c.daysToExpiry != null ? <Stat label="Expires In" value={`${c.daysToExpiry}d`} /> : null}
        </View>
      </View>

      {canRemind ? (
        <View style={styles.remindRow}>
          <Button
            label={remind.isPending ? "..." : "Send Expiry Reminder Now"}
            variant="outline"
            size="sm"
            disabled={remind.isPending}
            onPress={() => remind.mutate({ contractId })}
          />
        </View>
      ) : null}

      <SectionCard title="Lease Details">
        <DetailRow label="Frequency" value={PAYMENT_FREQUENCY_LABELS[c.paymentFrequency] ?? c.paymentFrequency} />
        <DetailRow label="Term" value={`${c.startDate} → ${c.endDate}`} />
        <DetailRow label="Security Deposit" value={formatCompactValue(c.securityDeposit, currency)} />
        <DetailRow label="Cheques" value={String(c.cheques)} />
        {c.ejariNumber ? <DetailRow label="Ejari #" value={c.ejariNumber} /> : null}
      </SectionCard>

      {c.notes ? (
        <SectionCard title="Notes">
          <Text style={styles.bodyText}>{c.notes}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title={`Rent Schedule (${installments.length})`}>
        {installments.map((i) => (
          <InstallmentRow
            key={i.id}
            installment={i}
            currency={currency}
            canRecord={canRecord}
            canRemind={canRemind}
            busy={recordPayment.isPending || waive.isPending || remind.isPending}
            onRecord={() => setPayingId(i.id)}
            onWaive={() => setWaivingId(i.id)}
            onRemind={() => remind.mutate({ contractId, installmentId: i.id })}
          />
        ))}
      </SectionCard>

      <RecordPaymentModal
        visible={Boolean(paying)}
        balance={paying?.balance ?? 0}
        currency={currency}
        busy={recordPayment.isPending}
        onCancel={() => setPayingId(null)}
        onConfirm={(input: RecordPaymentInput) => {
          if (!payingId) return;
          recordPayment.mutate({
            contractId,
            installmentId: payingId,
            body: { amount: input.amount, paidDate: input.paidDate, method: input.method, reference: input.reference },
          });
          setPayingId(null);
        }}
      />

      <WaiveModal
        visible={Boolean(waivingId)}
        reason={waiveReason}
        onChangeReason={setWaiveReason}
        busy={waive.isPending}
        onCancel={() => {
          setWaivingId(null);
          setWaiveReason("");
        }}
        onConfirm={() => {
          if (!waivingId) return;
          waive.mutate({ contractId, installmentId: waivingId, reason: waiveReason.trim() || undefined });
          setWaivingId(null);
          setWaiveReason("");
        }}
      />
    </ScrollView>
  );
}

function InstallmentRow({
  installment,
  currency,
  canRecord,
  canRemind,
  busy,
  onRecord,
  onWaive,
  onRemind,
}: {
  installment: RentInstallmentDto;
  currency: string;
  canRecord: boolean;
  canRemind: boolean;
  busy: boolean;
  onRecord: () => void;
  onWaive: () => void;
  onRemind: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const settled = installment.status === "paid" || installment.status === "waived";

  return (
    <View style={styles.installmentRow}>
      <View style={styles.rowTop}>
        <Text style={styles.installmentTitle}>
          #{installment.installmentNumber} · Due {installment.dueDate}
        </Text>
        <Badge label={INSTALLMENT_STATUS_LABELS[installment.status] ?? installment.status} tone={INSTALLMENT_STATUS_TONE[installment.status] ?? "neutral"} />
      </View>
      <Text style={styles.installmentMeta}>
        {formatCompactValue(installment.amount, currency)}
        {installment.balance > 0 ? ` · ${formatCompactValue(installment.balance, currency)} due` : ""}
        {installment.daysOverdue > 0 ? ` · ${installment.daysOverdue}d overdue` : ""}
      </Text>
      {installment.paidDate ? (
        <Text style={styles.installmentMeta}>
          Paid {installment.paidDate}
          {installment.paymentMethod ? ` via ${installment.paymentMethod}` : ""}
        </Text>
      ) : null}

      {!settled && (canRecord || canRemind) ? (
        <View style={styles.actionsRow}>
          {canRecord ? <Button label="Record Payment" size="sm" disabled={busy} onPress={onRecord} /> : null}
          {canRecord ? <Button label="Waive" size="sm" variant="ghost" disabled={busy} onPress={onWaive} /> : null}
          {canRemind ? <Button label="Remind" size="sm" variant="outline" disabled={busy} onPress={onRemind} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function WaiveModal({
  visible,
  reason,
  onChangeReason,
  busy,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  reason: string;
  onChangeReason: (v: string) => void;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Waive this installment?</Text>
          <TextInput
            style={styles.sheetInput}
            value={reason}
            onChangeText={onChangeReason}
            placeholder="Reason (optional)"
            placeholderTextColor={colors.subtleForeground}
            multiline
          />
          <View style={styles.sheetActions}>
            <Button label={busy ? "..." : "Waive"} variant="destructive" disabled={busy} onPress={onConfirm} />
            <Button label="Cancel" variant="ghost" onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.xs },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },

    remindRow: { flexDirection: "row" },

    bodyText: { fontSize: fontSize.md, color: colors.foreground },

    installmentRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: 2 },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    installmentTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    installmentMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
    sheetTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    sheetInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm + 2, minHeight: 44, backgroundColor: colors.background, textAlignVertical: "top", fontSize: fontSize.base, color: colors.foreground },
    sheetActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  });
}
