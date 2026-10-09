import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

const QUICK_PERCENTS = [10, 15, 20] as const;

export function TipModal({
  visible,
  subTotal,
  currency,
  currentTip,
  busy,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  subTotal: number;
  currency: string;
  currentTip: number;
  busy: boolean;
  errorMessage?: string | null;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [amount, setAmount] = useState(String(currentTip || 0));

  useEffect(() => {
    if (visible) setAmount(String(currentTip || 0));
  }, [visible, currentTip]);

  const parsed = Number(amount);
  const canConfirm = Number.isFinite(parsed) && parsed >= 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Tip</Text>

          <View style={styles.quickRow}>
            {QUICK_PERCENTS.map((pct) => (
              <Pressable key={pct} style={styles.quickChip} onPress={() => setAmount(String(Math.round(subTotal * pct) / 100))}>
                <Text style={styles.quickChipText}>{pct}%</Text>
              </Pressable>
            ))}
            <Pressable style={styles.quickChip} onPress={() => setAmount("0")}>
              <Text style={styles.quickChipText}>None</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Amount ({currency})</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={colors.subtleForeground} />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Button label={busy ? "..." : "Save"} disabled={busy || !canConfirm} onPress={() => onConfirm(parsed)} />
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
    quickRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
    quickChip: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    quickChipText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    label: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: spacing.sm },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.background },
    error: { fontSize: fontSize.sm, color: colors.destructive, marginTop: spacing.xs },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  });
}
