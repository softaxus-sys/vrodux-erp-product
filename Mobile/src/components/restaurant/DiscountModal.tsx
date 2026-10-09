import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

/** `type` matches Order.cs's own "flat/percentage/voucher" vocabulary -- it's a descriptive label
 *  only. `amount` is ALWAYS the computed currency figure, never a raw percentage: the domain
 *  entity's own comment is explicit that `Amount` is "the computed discount amount, not a raw
 *  percentage" -- the backend does not do that math, so a percentage pick here must resolve to a
 *  real amount before it's sent, exactly like the subtotal-based preview below. */
export interface DiscountInput {
  type: "flat" | "percentage";
  amount: number;
  reason: string;
}

export function DiscountModal({
  visible,
  subTotal,
  currency,
  busy,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  subTotal: number;
  currency: string;
  busy: boolean;
  errorMessage?: string | null;
  onConfirm: (input: DiscountInput) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [type, setType] = useState<"flat" | "percentage">("percentage");
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (visible) {
      setType("percentage");
      setAmount("10");
      setReason("");
    }
  }, [visible]);

  const parsed = Number(amount);
  const preview = type === "percentage" ? (subTotal * parsed) / 100 : parsed;
  const canConfirm = Number.isFinite(parsed) && parsed > 0 && reason.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Apply Discount</Text>

          <View style={styles.typeRow}>
            {(["percentage", "flat"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[styles.typeChip, type === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.typeChipText, type === t && { color: colors.onPrimary }]}>
                  {t === "percentage" ? "%" : currency}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Amount {type === "percentage" ? "(%)" : `(${currency})`}</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={colors.subtleForeground} />

          {Number.isFinite(preview) && preview > 0 ? (
            <Text style={styles.hint}>
              ≈ {currency} {preview.toLocaleString(undefined, { maximumFractionDigits: 2 })} off
            </Text>
          ) : null}

          <Text style={styles.label}>Reason</Text>
          <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Manager comp, regular customer…" placeholderTextColor={colors.subtleForeground} />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Button
              label={busy ? "..." : "Apply"}
              disabled={busy || !canConfirm}
              onPress={() => onConfirm({ type, amount: Math.round(preview * 100) / 100, reason: reason.trim() })}
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
    typeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
    typeChip: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    typeChipText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    label: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: spacing.xs },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.background },
    hint: { fontSize: fontSize.sm, color: colors.mutedForeground },
    error: { fontSize: fontSize.sm, color: colors.destructive, marginTop: spacing.xs },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  });
}
