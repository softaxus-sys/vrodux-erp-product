import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

/** 1 point = 1 currency unit (LoyaltySupport.PointValue on the backend). `points=0` takes a
 *  previously-redeemed amount back off -- the handler treats that as "remove the discount." The
 *  backend itself refuses more points than the bill is worth or than the customer holds; this
 *  just previews the same two caps so the error is rare, not a guess the server has to catch. */
export function LoyaltyModal({
  visible,
  customerName,
  availablePoints,
  subTotal,
  currentlyRedeemed,
  currency,
  busy,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  customerName: string;
  availablePoints: number;
  subTotal: number;
  currentlyRedeemed: number;
  currency: string;
  busy: boolean;
  errorMessage?: string | null;
  onConfirm: (points: number) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [points, setPoints] = useState(String(currentlyRedeemed));

  useEffect(() => {
    if (visible) setPoints(String(currentlyRedeemed));
  }, [visible, currentlyRedeemed]);

  const parsed = Number(points);
  // availablePoints already reflects the customer's balance with currentlyRedeemed given back --
  // the max usable here is whichever is smaller, their balance or what the bill is worth.
  const maxUsable = Math.min(availablePoints, subTotal);
  const canConfirm = Number.isFinite(parsed) && parsed >= 0 && parsed <= maxUsable + 0.01;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Redeem Loyalty Points</Text>
          <Text style={styles.hint}>
            {customerName} has {availablePoints.toFixed(0)} points available (worth {currency} {availablePoints.toFixed(0)}).
          </Text>

          <Text style={styles.label}>Points to use (max {maxUsable.toFixed(0)})</Text>
          <TextInput style={styles.input} value={points} onChangeText={setPoints} keyboardType="decimal-pad" placeholderTextColor={colors.subtleForeground} />

          <View style={styles.quickRow}>
            <Pressable style={styles.quickChip} onPress={() => setPoints(String(maxUsable))}>
              <Text style={styles.quickChipText}>Max</Text>
            </Pressable>
            <Pressable style={styles.quickChip} onPress={() => setPoints("0")}>
              <Text style={styles.quickChipText}>None</Text>
            </Pressable>
          </View>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Button label={busy ? "..." : "Apply"} disabled={busy || !canConfirm} onPress={() => onConfirm(parsed)} />
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
    quickRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
    quickChip: { flex: 1, paddingVertical: spacing.xs + 2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    quickChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
    error: { fontSize: fontSize.sm, color: colors.destructive, marginTop: spacing.xs },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  });
}
