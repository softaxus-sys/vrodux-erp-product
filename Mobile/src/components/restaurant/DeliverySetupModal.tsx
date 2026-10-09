import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

/** CreateDeliveryOrderCommand requires both a non-empty address and phone -- this is what
 *  collects them before the delivery leg is created (never submitted blank). */
export function DeliverySetupModal({
  visible,
  busy,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  busy: boolean;
  errorMessage?: string | null;
  onConfirm: (input: { address: string; phone: string }) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (visible) {
      setAddress("");
      setPhone("");
    }
  }, [visible]);

  const canConfirm = address.trim().length > 0 && phone.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Start Delivery</Text>

          <Text style={styles.label}>Delivery address</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={address}
            onChangeText={setAddress}
            placeholder="Building, street, area…"
            placeholderTextColor={colors.subtleForeground}
            multiline
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={colors.subtleForeground} />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Button
              label={busy ? "..." : "Create Delivery"}
              disabled={busy || !canConfirm}
              onPress={() => onConfirm({ address: address.trim(), phone: phone.trim() })}
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
    label: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: spacing.xs },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.background },
    multiline: { minHeight: 56, textAlignVertical: "top" },
    error: { fontSize: fontSize.sm, color: colors.destructive, marginTop: spacing.xs },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  });
}
