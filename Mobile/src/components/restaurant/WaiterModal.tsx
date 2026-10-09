import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

/** `Waiter` is a free-text display name on the order (same shape as web's SetOrderWaiterCommand),
 *  not a linked user id -- a plain text field matches what the backend actually stores. */
export function WaiterModal({
  visible,
  currentWaiter,
  busy,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  currentWaiter: string;
  busy: boolean;
  errorMessage?: string | null;
  onConfirm: (waiter: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [waiter, setWaiter] = useState(currentWaiter);

  useEffect(() => {
    if (visible) setWaiter(currentWaiter);
  }, [visible, currentWaiter]);

  const canConfirm = waiter.trim().length > 0 && waiter.trim() !== currentWaiter;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Hand Off to Another Waiter</Text>
          <TextInput style={styles.input} value={waiter} onChangeText={setWaiter} placeholder="Waiter name" placeholderTextColor={colors.subtleForeground} />
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          <Button label={busy ? "..." : "Save"} disabled={busy || !canConfirm} onPress={() => onConfirm(waiter.trim())} style={styles.actionGap} />
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
    title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.background },
    error: { fontSize: fontSize.sm, color: colors.destructive },
    actionGap: { marginTop: spacing.xs },
  });
}
