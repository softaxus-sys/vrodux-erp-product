import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

const METHODS = ["cash", "card", "online"] as const;

export interface PaymentInput {
  method: string;
  amount: number;
  reference?: string;
}

/** Covers both the single-method "pay it all off" path (PayOrderCommand) and split-tender --
 *  taking several payments across different methods for the same bill (AddOrderPaymentCommand).
 *  `fullPayLabel` switches the button's wording; the caller decides which endpoint to call based
 *  on whether the amount typed covers the whole outstanding balance. */
export function PaymentModal({
  visible,
  outstanding,
  currency,
  busy,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  outstanding: number;
  currency: string;
  busy: boolean;
  errorMessage?: string | null;
  onConfirm: (input: PaymentInput) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [method, setMethod] = useState<string>("cash");
  const [customMethod, setCustomMethod] = useState("");
  const [amount, setAmount] = useState(String(outstanding));
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (visible) {
      setMethod("cash");
      setCustomMethod("");
      setAmount(outstanding > 0 ? String(outstanding) : "0");
      setReference("");
    }
  }, [visible, outstanding]);

  const parsed = Number(amount);
  const resolvedMethod = method === "other" ? customMethod.trim() : method;
  const canConfirm = Number.isFinite(parsed) && parsed > 0 && resolvedMethod.length > 0;
  const isFullPay = Math.abs(parsed - outstanding) < 0.01;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Take Payment</Text>
          <Text style={styles.hint}>
            Outstanding: {currency} {outstanding.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>

          <View style={styles.methodRow}>
            {METHODS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMethod(m)}
                style={[styles.methodChip, method === m && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.methodChipText, method === m && { color: colors.onPrimary }]}>
                  {m[0].toUpperCase() + m.slice(1)}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setMethod("other")}
              style={[styles.methodChip, method === "other" && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.methodChipText, method === "other" && { color: colors.onPrimary }]}>Other</Text>
            </Pressable>
          </View>
          {method === "other" ? (
            <TextInput
              style={styles.input}
              value={customMethod}
              onChangeText={setCustomMethod}
              placeholder="Wallet, voucher…"
              placeholderTextColor={colors.subtleForeground}
            />
          ) : null}

          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={colors.subtleForeground} />
          {!isFullPay && parsed > 0 ? <Text style={styles.hint}>Split-tender: the remaining balance stays open.</Text> : null}

          <Text style={styles.label}>Reference (optional)</Text>
          <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="Card auth code, transfer ref…" placeholderTextColor={colors.subtleForeground} />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Button
              label={busy ? "..." : isFullPay ? "Pay in full" : "Add payment"}
              disabled={busy || !canConfirm}
              onPress={() => onConfirm({ method: resolvedMethod, amount: parsed, reference: reference.trim() || undefined })}
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
    methodRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
    methodChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
    methodChipText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    label: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: spacing.xs },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.background, marginTop: spacing.xs },
    error: { fontSize: fontSize.sm, color: colors.destructive, marginTop: spacing.xs },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  });
}
