import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface RecordPaymentInput {
  amount: number;
  paidDate: string;
  method?: string;
  reference?: string;
}

/** Shared between Contract Detail's own rent schedule and the cross-lease Rent Due chase queue --
 *  both record money against the same installment endpoint. Defaults the amount to the balance
 *  still owed and the date to today (dynamic, per the project's "never hardcode dates" rule). */
export function RecordPaymentModal({
  visible,
  balance,
  currency,
  busy,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  balance: number;
  currency: string;
  busy: boolean;
  onConfirm: (input: RecordPaymentInput) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [amount, setAmount] = useState(String(balance));
  const [paidDate, setPaidDate] = useState(today());
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (visible) {
      setAmount(String(balance));
      setPaidDate(today());
      setMethod("");
      setReference("");
    }
  }, [visible, balance]);

  const parsed = Number(amount);
  const canConfirm = Number.isFinite(parsed) && parsed > 0 && paidDate.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Record Payment</Text>
          <Text style={styles.hint}>
            Balance due: {currency} {balance.toLocaleString()}
          </Text>

          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={colors.subtleForeground} />

          <Text style={styles.label}>Paid date (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={paidDate} onChangeText={setPaidDate} placeholderTextColor={colors.subtleForeground} />

          <Text style={styles.label}>Method (optional)</Text>
          <TextInput style={styles.input} value={method} onChangeText={setMethod} placeholder="Cheque, transfer, cash…" placeholderTextColor={colors.subtleForeground} />

          <Text style={styles.label}>Reference (optional)</Text>
          <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="Cheque #, transaction ref…" placeholderTextColor={colors.subtleForeground} />

          <View style={styles.actions}>
            <Button
              label={busy ? "..." : "Record"}
              disabled={busy || !canConfirm}
              onPress={() => onConfirm({ amount: parsed, paidDate: paidDate.trim(), method: method.trim() || undefined, reference: reference.trim() || undefined })}
            />
            <Button label="Cancel" variant="ghost" onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.xs },
    title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    hint: { fontSize: fontSize.sm, color: colors.mutedForeground, marginBottom: spacing.xs },
    label: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: spacing.xs },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.background },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  });
}
