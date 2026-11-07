import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ReasonModal } from "@/components/restaurant/ReasonModal";
import { useFolio, useStayAction } from "@/hooks/use-hospitality";
import { hospitalityApi } from "@/lib/hospitality.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { Badge, Button, Chip, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { HospitalityStackParamList } from "@/navigation/types";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_TONE, FOLIO_CATEGORIES, HOTEL_PAYMENT_METHODS } from "@/types/hospitality";

type Props = NativeStackScreenProps<HospitalityStackParamList, "BookingDetail">;

const EDIT = "hospitality.bookings.edit";
const FOLIO_CREATE = "hospitality.folio.create";
const FOLIO_APPROVE = "hospitality.folio.approve";

const label = (s: string) => s.replace(/_/g, " ");

/** The guest's stay and bill in one place: check in/out, take a payment, post an extra charge, void one,
 *  cancel or mark a no-show. Check-out with money still owing is refused by the server unless the desk
 *  explicitly allows it, so that choice is asked here, never made silently. */
export default function BookingDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { bookingId, bookingNumber } = route.params;
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const canEdit = hasPermission(EDIT);
  const canCharge = hasPermission(FOLIO_CREATE);
  const canVoid = hasPermission(FOLIO_APPROVE);

  useEffect(() => {
    navigation.setOptions({ headerTitle: bookingNumber });
  }, [navigation, bookingNumber]);

  const folio = useFolio(bookingId);
  const checkIn = useStayAction(() => hospitalityApi.checkIn(bookingId));
  const checkOut = useStayAction((allow: boolean) => (allow ? hospitalityApi.checkOutWithBalance(bookingId) : hospitalityApi.checkOut(bookingId)));
  const noShow = useStayAction(() => hospitalityApi.markNoShow(bookingId));
  const cancel = useStayAction((reason: string) => hospitalityApi.cancelBooking(bookingId, reason));
  const voidCharge = useStayAction((a: { chargeId: string; reason: string }) => hospitalityApi.voidCharge(bookingId, a.chargeId, a.reason));

  const [payOpen, setPayOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);

  if (folio.isLoading) return <LoadingState />;
  if (folio.isError || !folio.data) return <ErrorState message="Couldn't load this stay." onRetry={() => folio.refetch()} />;

  const f = folio.data;
  const money = (n: number) => formatCompactValue(n, currency);
  const live = f.status !== "cancelled" && f.status !== "checked_out" && f.status !== "no_show";
  const actionError = [checkIn, checkOut, noShow, cancel, voidCharge]
    .map((m) => (m.isError ? (m.error instanceof Error ? m.error.message : "That didn't go through.") : null))
    .find(Boolean);

  const askCheckOut = () => {
    if (f.balance > 0) {
      Alert.alert("Balance still owing", `${money(f.balance)} is unpaid. Collect it first, or check out anyway and leave it on the account.`, [
        { text: "Back", style: "cancel" },
        { text: "Check out anyway", style: "destructive", onPress: () => checkOut.mutate(true) },
      ]);
    } else {
      checkOut.mutate(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.name}>{f.guestName}</Text>
          <View style={styles.row}>
            <Badge label={BOOKING_STATUS_LABELS[f.status] ?? label(f.status)} tone={BOOKING_STATUS_TONE[f.status] ?? "neutral"} />
            <Text style={styles.meta}>Room {f.roomNumber} · {f.checkIn} → {f.checkOut}</Text>
          </View>
          <View style={styles.stats}>
            <Stat label="Total" value={money(f.total)} tone="primary" />
            <Stat label="Paid" value={money(f.paid)} />
            <Stat label="Balance" value={money(f.balance)} />
          </View>
        </View>

        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

        {canEdit || canCharge ? (
          <View style={styles.actions}>
            {canEdit && f.status === "confirmed" ? <Button label="Check in" size="sm" loading={checkIn.isPending} onPress={() => checkIn.mutate(undefined)} /> : null}
            {canEdit && f.status === "checked_in" ? <Button label="Check out" size="sm" loading={checkOut.isPending} onPress={askCheckOut} /> : null}
            {canEdit && live && f.balance > 0 ? <Button label="Take payment" size="sm" variant="secondary" icon="dollar-sign" onPress={() => setPayOpen(true)} /> : null}
            {canCharge && f.status === "checked_in" ? <Button label="Add charge" size="sm" variant="secondary" icon="plus" onPress={() => setChargeOpen(true)} /> : null}
            {canEdit && f.status === "confirmed" ? (
              <Button
                label="No-show"
                size="sm"
                variant="outline"
                loading={noShow.isPending}
                onPress={() =>
                  Alert.alert("Mark as no-show?", "The room is released and the guest is recorded as not arrived.", [
                    { text: "Back", style: "cancel" },
                    { text: "Mark no-show", style: "destructive", onPress: () => noShow.mutate(undefined) },
                  ])
                }
              />
            ) : null}
            {canEdit && (f.status === "confirmed" || f.status === "checked_in") ? (
              <Button label="Cancel stay" size="sm" variant="outline" onPress={() => setCancelOpen(true)} />
            ) : null}
          </View>
        ) : null}

        <SectionCard title="Bill">
          <DetailRow label="Room" value={money(f.roomCharge)} />
          {f.extrasTotal > 0 ? <DetailRow label="Extras" value={money(f.extrasTotal)} /> : null}
          {f.discountAmount > 0 ? <DetailRow label={f.discountReason ? `Discount (${f.discountReason})` : "Discount"} value={`- ${money(f.discountAmount)}`} /> : null}
          {f.serviceAmount > 0 ? <DetailRow label={`Service ${f.serviceChargePercent}%`} value={money(f.serviceAmount)} /> : null}
          {f.taxAmount > 0 ? <DetailRow label={`${f.taxLabel || "Tax"} ${f.taxPercent}%`} value={money(f.taxAmount)} /> : null}
          {f.feeAmount > 0 ? <DetailRow label={f.nightlyFeeLabel || "Nightly fee"} value={money(f.feeAmount)} /> : null}
          <DetailRow label="Total" value={money(f.total)} />
        </SectionCard>

        {f.charges.length > 0 ? (
          <SectionCard title="Extra charges">
            {f.charges.map((c) => (
              <View key={c.id} style={styles.line}>
                <View style={styles.lineMain}>
                  <Text style={[styles.lineTitle, c.isVoided && styles.struck]}>{c.description}</Text>
                  <Text style={styles.meta}>
                    {c.date} · {label(c.category)} · {c.quantity} × {money(c.unitPrice)}
                    {c.isVoided && c.voidReason ? ` · voided: ${c.voidReason}` : ""}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={[styles.lineTitle, c.isVoided && styles.struck]}>{money(c.amount)}</Text>
                  {canVoid && !c.isVoided && live ? <Text style={styles.link} onPress={() => setVoidId(c.id)}>Void</Text> : null}
                </View>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {f.payments.length > 0 ? (
          <SectionCard title="Payments">
            {f.payments.map((p) => (
              <DetailRow key={p.id} label={`${p.paidOn} · ${label(p.method)}${p.reference ? ` · ${p.reference}` : ""}`} value={money(p.amount)} />
            ))}
          </SectionCard>
        ) : null}
      </ScrollView>

      <PaymentSheet visible={payOpen} bookingId={bookingId} balance={f.balance} onClose={() => setPayOpen(false)} />
      <ChargeSheet visible={chargeOpen} bookingId={bookingId} onClose={() => setChargeOpen(false)} />
      <ReasonModal
        visible={cancelOpen}
        title="Cancel this stay?"
        hint="Any cancellation fee is handled from the web app."
        confirmLabel="Cancel stay"
        destructive
        busy={cancel.isPending}
        errorMessage={null}
        onCancel={() => setCancelOpen(false)}
        onConfirm={(reason) => cancel.mutate(reason, { onSuccess: () => setCancelOpen(false) })}
      />
      <ReasonModal
        visible={voidId !== null}
        title="Void this charge?"
        hint="It stays on the bill, struck through, with your reason."
        confirmLabel="Void charge"
        destructive
        busy={voidCharge.isPending}
        errorMessage={null}
        onCancel={() => setVoidId(null)}
        onConfirm={(reason) => voidId && voidCharge.mutate({ chargeId: voidId, reason }, { onSuccess: () => setVoidId(null) })}
      />
    </>
  );
}

function SheetFrame({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PaymentSheet({ visible, bookingId, balance, onClose }: { visible: boolean; bookingId: string; balance: number; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pay = useStayAction((b: { amount: number; method: string; reference: string | null }) => hospitalityApi.recordPayment(bookingId, b));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
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
    <SheetFrame visible={visible} title="Take payment" onClose={onClose}>
      <Text style={styles.label}>Amount</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={colors.subtleForeground} />
      <Text style={styles.label}>Method</Text>
      <View style={styles.chips}>
        {HOTEL_PAYMENT_METHODS.map((m) => (
          <Chip key={m} label={label(m)} active={method === m} onPress={() => setMethod(m)} />
        ))}
      </View>
      <Text style={styles.label}>Reference (optional)</Text>
      <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholderTextColor={colors.subtleForeground} />
      {pay.isError ? <Text style={styles.error}>{pay.error instanceof Error ? pay.error.message : "Couldn't record the payment."}</Text> : null}
      <View style={styles.sheetActions}>
        <Button label="Cancel" variant="outline" size="sm" onPress={onClose} />
        <Button
          label="Save payment"
          size="sm"
          disabled={!valid}
          loading={pay.isPending}
          onPress={() => pay.mutate({ amount: value, method, reference: reference.trim() || null }, { onSuccess: onClose })}
        />
      </View>
    </SheetFrame>
  );
}

function ChargeSheet({ visible, bookingId, onClose }: { visible: boolean; bookingId: string; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const post = useStayAction((b: { category: string; description: string; quantity: number; unitPrice: number }) => hospitalityApi.postCharge(bookingId, b));
  const [category, setCategory] = useState<string>("food");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  useEffect(() => {
    if (visible) {
      setCategory("food");
      setDescription("");
      setQty("1");
      setPrice("");
      post.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const q = Number(qty);
  const p = Number(price);
  const valid = description.trim().length > 0 && q > 0 && p > 0;
  return (
    <SheetFrame visible={visible} title="Add a charge to the bill" onClose={onClose}>
      <Text style={styles.label}>Type</Text>
      <View style={styles.chips}>
        {FOLIO_CATEGORIES.map((c) => (
          <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>
      <Text style={styles.label}>What was it</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="e.g. Dinner, room service" placeholderTextColor={colors.subtleForeground} />
      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Quantity</Text>
          <TextInput style={styles.input} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Price each</Text>
          <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        </View>
      </View>
      {post.isError ? <Text style={styles.error}>{post.error instanceof Error ? post.error.message : "Couldn't post the charge."}</Text> : null}
      <View style={styles.sheetActions}>
        <Button label="Cancel" variant="outline" size="sm" onPress={onClose} />
        <Button
          label="Post charge"
          size="sm"
          disabled={!valid}
          loading={post.isPending}
          onPress={() => post.mutate({ category, description: description.trim(), quantity: q, unitPrice: p }, { onSuccess: onClose })}
        />
      </View>
    </SheetFrame>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    header: { gap: spacing.sm },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    stats: { flexDirection: "row", gap: spacing.lg },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    error: { fontSize: fontSize.sm, color: colors.destructive },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, flexShrink: 1 },
    line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingVertical: spacing.xs },
    lineMain: { flex: 1 },
    right: { alignItems: "flex-end", gap: 2 },
    lineTitle: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.foreground },
    struck: { textDecorationLine: "line-through", color: colors.mutedForeground },
    link: { fontSize: fontSize.sm, color: colors.destructive, fontWeight: fontWeight.semibold },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.lg },
    sheet: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
    sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.mutedForeground, marginTop: spacing.xs },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.background },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    half: { flex: 1 },
    sheetActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm },
  });
}
