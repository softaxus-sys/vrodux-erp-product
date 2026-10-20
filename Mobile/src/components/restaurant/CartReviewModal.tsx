import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui";
import type { CartLineSelection } from "@/types/restaurant";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

export function CartReviewModal({
  visible,
  lines,
  currency,
  notes,
  busy,
  errorMessage,
  submitLabel,
  onNotesChange,
  onChangeQuantity,
  onRemove,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  lines: CartLineSelection[];
  currency: string;
  notes: string;
  busy: boolean;
  errorMessage?: string | null;
  submitLabel: string;
  onNotesChange: (notes: string) => void;
  onChangeQuantity: (index: number, quantity: number) => void;
  onRemove: (index: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [localNotes, setLocalNotes] = useState(notes);

  const total = lines.reduce((sum, l) => sum + l.unitPriceWithModifiers * l.quantity, 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Your Order ({lines.length})</Text>

          {lines.length === 0 ? (
            <Text style={styles.empty}>Nothing added yet.</Text>
          ) : (
            <ScrollView style={styles.list}>
              {lines.map((line, index) => (
                <View key={`${line.menuItem.id}-${index}`} style={styles.row}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName}>{line.menuItem.name}</Text>
                    {line.modifierSummary ? <Text style={styles.rowMeta}>{line.modifierSummary}</Text> : null}
                    <Text style={styles.rowPrice}>
                      {currency} {(line.unitPriceWithModifiers * line.quantity).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    <View style={styles.stepper}>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() => (line.quantity <= 1 ? onRemove(index) : onChangeQuantity(index, line.quantity - 1))}
                      >
                        <Text style={styles.stepperButtonText}>−</Text>
                      </Pressable>
                      <Text style={styles.stepperValue}>{line.quantity}</Text>
                      <Pressable style={styles.stepperButton} onPress={() => onChangeQuantity(index, line.quantity + 1)}>
                        <Text style={styles.stepperButtonText}>+</Text>
                      </Pressable>
                    </View>
                    <Pressable onPress={() => onRemove(index)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={localNotes}
            onChangeText={(t) => {
              setLocalNotes(t);
              onNotesChange(t);
            }}
            placeholder="Allergy, special request…"
            placeholderTextColor={colors.subtleForeground}
            multiline
          />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {currency} {total.toFixed(2)}
            </Text>
          </View>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Button label={busy ? "..." : submitLabel} disabled={busy || lines.length === 0} onPress={onSubmit} fullWidth />
          </View>
          <Button label="Back to menu" variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, maxHeight: "88%" },
    title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    empty: { fontSize: fontSize.sm, color: colors.mutedForeground, paddingVertical: spacing.md },
    list: { maxHeight: 300 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs },
    rowBody: { flex: 1, gap: 2, marginRight: spacing.sm },
    rowName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    rowMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    rowPrice: { fontSize: fontSize.sm, color: colors.foreground, marginTop: 2 },
    rowActions: { alignItems: "flex-end", gap: spacing.xs },
    stepper: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    stepperButton: { width: 26, height: 26, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    stepperButtonText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.foreground },
    stepperValue: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, minWidth: 18, textAlign: "center" },
    removeText: { fontSize: fontSize.xs, color: colors.destructive },

    label: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: spacing.xs },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.background },
    multiline: { minHeight: 52, textAlignVertical: "top" },

    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
    totalLabel: { fontSize: fontSize.base, color: colors.mutedForeground },
    totalValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    error: { fontSize: fontSize.sm, color: colors.destructive },
    actions: { marginTop: spacing.sm },
  });
}
