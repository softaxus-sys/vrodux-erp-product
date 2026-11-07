import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ReasonModal } from "@/components/restaurant/ReasonModal";
import { useTourBooking, useTourPayment, useTourStatus } from "@/hooks/use-tours";
import { formatCompactValue } from "@/lib/crm-helpers";
import { TOUR_PAYMENT_METHODS, TOURS_BOOKINGS_EDIT, TOURS_BOOKINGS_RECORD } from "@/lib/tours.api";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { Badge, Button, Chip, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { HospitalityStackParamList } from "@/navigation/types";
import { TOUR_STATUS_LABEL, TOUR_STATUS_TONE } from "@/screens/hospitality/TourBookingsListScreen";

type Props = NativeStackScreenProps<HospitalityStackParamList, "TourBookingDetail">;

const INSTALMENT_TONE = { paid: "success", partial: "warning", overdue: "destructive", due: "warning", upcoming: "neutral" } as const;

export default function TourBookingDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { bookingId, bookingNumber } = route.params;
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const canEdit = hasPermission(TOURS_BOOKINGS_EDIT);
  const canRecord = hasPermission(TOURS_BOOKINGS_RECORD);

  useEffect(() => {
    navigation.setOptions({ headerTitle: bookingNumber });
  }, [navigation, bookingNumber]);

  const detail = useTourBooking(bookingId);
  const setStatus = useTourStatus();
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (detail.isLoading) return <LoadingState />;
  if (detail.isError || !detail.data) return <ErrorState message="Couldn't load this booking." onRetry={() => detail.refetch()} />;

  const { booking: b, travellers, services, instalments, payments } = detail.data;
  const open = b.status === "enquiry" || b.status === "confirmed";

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.name}>{b.customerName}</Text>
          <View style={styles.subtitleRow}>
            <Badge label={TOUR_STATUS_LABEL[b.status] ?? b.status} tone={TOUR_STATUS_TONE[b.status] ?? "neutral"} />
            <Text style={styles.subtitle} numberOfLines={1}>{b.title}</Text>
          </View>
          <View style={styles.statsRow}>
            <Stat label="Total" value={formatCompactValue(b.totalAmount, currency)} tone="primary" />
            <Stat label="Paid" value={formatCompactValue(b.amountPaid, currency)} />
            <Stat label="Balance" value={formatCompactValue(b.balance, currency)} />
          </View>
          {b.overdueAmount > 0 ? <Text style={styles.overdue}>Overdue: {formatCompactValue(b.overdueAmount, currency)}</Text> : null}
        </View>

        {setStatus.isError ? (
          <Text style={styles.error}>{setStatus.error instanceof Error ? setStatus.error.message : "Couldn't update the booking."}</Text>
        ) : null}

        <View style={styles.actionRow}>
          {canRecord && open && b.balance > 0 ? <Button label="Record payment" size="sm" icon="dollar-sign" onPress={() => setPayOpen(true)} /> : null}
          {canEdit && b.status === "enquiry" ? (
            <Button label="Confirm" size="sm" variant="secondary" loading={setStatus.isPending} onPress={() => setStatus.mutate({ id: b.id, action: "confirm" })} />
          ) : null}
          {canEdit && b.status === "confirmed" ? (
            <Button label="Mark completed" size="sm" variant="secondary" loading={setStatus.isPending} onPress={() => setStatus.mutate({ id: b.id, action: "complete" })} />
          ) : null}
          {canEdit && open ? <Button label="Cancel booking" size="sm" variant="outline" onPress={() => setCancelOpen(true)} /> : null}
          {canEdit && b.status === "cancelled" ? (
            <Button label="Reopen" size="sm" variant="outline" loading={setStatus.isPending} onPress={() => setStatus.mutate({ id: b.id, action: "reopen" })} />
          ) : null}
        </View>

        <SectionCard title="Trip">
          <DetailRow label="Dates" value={`${b.startDate} → ${b.endDate}`} />
          {detail.data.packageName ? <DetailRow label="Package" value={detail.data.packageName} /> : null}
          {detail.data.destination ? <DetailRow label="Destination" value={detail.data.destination} /> : null}
          <DetailRow label="Travellers" value={`${b.adults} adult${b.adults === 1 ? "" : "s"}${b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}`} />
          {b.customerPhone ? <DetailRow label="Phone" value={b.customerPhone} /> : null}
          {b.customerEmail ? <DetailRow label="Email" value={b.customerEmail} /> : null}
          {b.cancelReason ? <DetailRow label="Cancelled because" value={b.cancelReason} /> : null}
          {b.notes ? <DetailRow label="Notes" value={b.notes} /> : null}
        </SectionCard>

        {instalments.length > 0 ? (
          <SectionCard title="Payment schedule">
            {instalments.map((i) => (
              <View key={i.id} style={styles.line}>
                <View style={styles.lineMain}>
                  <Text style={styles.lineTitle}>{i.label}</Text>
                  <Text style={styles.meta}>Due {i.dueDate} · {formatCompactValue(i.paid, currency)} of {formatCompactValue(i.amount, currency)}</Text>
                </View>
                <Badge label={i.status} tone={INSTALMENT_TONE[i.status] ?? "neutral"} />
              </View>
            ))}
          </SectionCard>
        ) : null}

        {payments.length > 0 ? (
          <SectionCard title="Payments">
            {payments.map((p) => (
              <DetailRow
                key={p.id}
                label={`${p.paidOn} · ${p.method.replace(/_/g, " ")}${p.isVoided ? " (voided)" : ""}`}
                value={formatCompactValue(p.amount, currency)}
              />
            ))}
          </SectionCard>
        ) : null}

        {travellers.length > 0 ? (
          <SectionCard title="Travellers">
            {travellers.map((t) => (
              <View key={t.id} style={styles.line}>
                <View style={styles.lineMain}>
                  <Text style={styles.lineTitle}>{t.fullName}</Text>
                  <Text style={styles.meta}>
                    {t.type}{t.nationality ? ` · ${t.nationality}` : ""}{t.passportNumber ? ` · ${t.passportNumber}` : " · no passport yet"}
                  </Text>
                </View>
                {t.passportProblem ? <Badge label="Passport" tone="destructive" /> : null}
              </View>
            ))}
          </SectionCard>
        ) : null}

        {services.length > 0 ? (
          <SectionCard title="Services">
            {services.map((s) => (
              <View key={s.id} style={styles.line}>
                <View style={styles.lineMain}>
                  <Text style={styles.lineTitle}>{s.description}</Text>
                  <Text style={styles.meta}>
                    {s.type} · {s.supplierName}{s.serviceDate ? ` · ${s.serviceDate}` : ""}{s.confirmationNumber ? ` · ${s.confirmationNumber}` : ""}
                  </Text>
                </View>
                <Badge label={s.status} tone={s.status === "confirmed" ? "success" : s.status === "cancelled" ? "destructive" : "warning"} />
              </View>
            ))}
          </SectionCard>
        ) : null}
      </ScrollView>

      <PaymentSheet visible={payOpen} bookingId={b.id} balance={b.balance} onClose={() => setPayOpen(false)} />
      <ReasonModal
        visible={cancelOpen}
        title="Cancel this booking?"
        hint="The customer's balance and any supplier holds stay as they are until you handle them."
        confirmLabel="Cancel booking"
        destructive
        busy={setStatus.isPending}
        errorMessage={null}
        onCancel={() => setCancelOpen(false)}
        onConfirm={(reason) => setStatus.mutate({ id: b.id, action: "cancel", reason }, { onSuccess: () => setCancelOpen(false) })}
      />
    </>
  );
}

function PaymentSheet({ visible, bookingId, balance, onClose }: { visible: boolean; bookingId: string; balance: number; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pay = useTourPayment();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (visible) {
      setAmount(balance > 0 ? String(balance) : "");
      setMethod("cash");
      setReference("");
      pay.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Record payment</Text>
          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={colors.subtleForeground} />
          <Text style={styles.label}>Method</Text>
          <View style={styles.chips}>
            {TOUR_PAYMENT_METHODS.map((m) => (
              <Chip key={m.value} label={m.label} active={method === m.value} onPress={() => setMethod(m.value)} />
            ))}
          </View>
          <Text style={styles.label}>Reference (optional)</Text>
          <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="Receipt or transfer no." placeholderTextColor={colors.subtleForeground} />
          {pay.isError ? <Text style={styles.error}>{pay.error instanceof Error ? pay.error.message : "Couldn't record the payment."}</Text> : null}
          <View style={styles.sheetActions}>
            <Button label="Cancel" variant="outline" size="sm" onPress={onClose} />
            <Button
              label={pay.isPending ? "Saving…" : "Save payment"}
              size="sm"
              disabled={!valid || pay.isPending}
              loading={pay.isPending}
              onPress={() => pay.mutate({ id: bookingId, amount: value, method, reference: reference.trim() || null }, { onSuccess: onClose })}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    header: { gap: spacing.sm },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    subtitle: { flex: 1, fontSize: fontSize.base, color: colors.mutedForeground },
    statsRow: { flexDirection: "row", gap: spacing.lg },
    overdue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.destructive },
    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    error: { fontSize: fontSize.sm, color: colors.destructive },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingVertical: spacing.xs },
    lineMain: { flex: 1 },
    lineTitle: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.foreground },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.lg },
    sheet: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
    sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.mutedForeground, marginTop: spacing.xs },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.background },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    sheetActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm },
  });
}
