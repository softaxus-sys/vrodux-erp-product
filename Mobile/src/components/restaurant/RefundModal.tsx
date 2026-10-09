import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

const METHODS = ["cash", "card", "online"] as const;

export interface RefundInput {
  amount: number;
  reason: string;
  method: string;
}

/** A refund never blocks on the tied shift being closed (see Backend CLAUDE.md Module 19c) -- a
 *  complaint the next day shouldn't be impossible to refund. The amount is capped here at what
 *  was actually paid, same guard the backend enforces. */
export function RefundModal({
  visible,
  amountPaid,
  currency,
  busy,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  amountPaid: number;
  currency: string;
  busy: boolean;
  errorMessage?: string | null;
  onConfirm: (input: RefundInput) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [amount, setAmount] = useState(String(amountPaid));
  const [method, setMethod] = useState<string>("cash");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (visible) {
      setAmount(String(amountPaid));
      setMethod("cash");
      setReason("");
    }
  }, [visible, amountPaid]);

  const parsed = Number(amount);
  const canConfirm = Number.isFinite(parsed) && parsed > 0 && parsed <= amountPaid + 0.01 && reason.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Refund</Text>
          <Text style={styles.hint}>
            Paid: {currency} {amountPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>

          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={colors.subtleForeground} />
          {parsed > amountPaid + 0.01 ? <Text style={styles.error}>Cannot refund more than what was paid.</Text> : null}

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
          </View>

          <Text style={styles.label}>Reason</Text>
          <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Why is this being refunded?" placeholderTextColor={colors.subtleForeground} />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Button
              label={busy ? "..." : "Refund"}
              variant="destructive"
              disabled={busy || !canConfirm}
              onPress={() => onConfirm({ amount: parsed, method, reason: reason.trim() })}
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
    methodRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
    methodChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
    methodChipText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    error: { fontSize: fontSize.sm, color: colors.destructive, marginTop: spacing.xs },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  });
}
