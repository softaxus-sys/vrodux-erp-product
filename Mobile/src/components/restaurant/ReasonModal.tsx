import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

/** Every audited void/cancel/remove-discount action on an order requires a reason -- mirrors the
 *  web app's own shared ReasonModal (Backend CLAUDE.md Module 19c). One component so the three
 *  call sites can't drift on wording or validation. */
export function ReasonModal({
  visible,
  title,
  hint,
  confirmLabel = "Confirm",
  destructive,
  busy,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  hint?: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy: boolean;
  errorMessage?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (visible) setReason("");
  }, [visible]);

  const canConfirm = reason.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}

          <Text style={styles.label}>Reason</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={reason}
            onChangeText={setReason}
            placeholder="Why?"
            placeholderTextColor={colors.subtleForeground}
            multiline
          />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Button
              label={busy ? "..." : confirmLabel}
              variant={destructive ? "destructive" : "primary"}
              disabled={busy || !canConfirm}
              onPress={() => onConfirm(reason.trim())}
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
    multiline: { minHeight: 72, textAlignVertical: "top" },
    error: { fontSize: fontSize.sm, color: colors.destructive, marginTop: spacing.xs },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  });
}
