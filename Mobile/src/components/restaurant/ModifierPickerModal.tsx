import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import type { MenuItemDto } from "@/types/restaurant";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

/** Mirrors the web app's ModifierPickerModal (Backend CLAUDE.md Module 19d): radio-style for a
 *  group whose maxSelect is 1, checkboxes (capped at maxSelect) otherwise. Required groups
 *  (minSelect >= 1) are validated before Add enables -- the same rule the backend enforces
 *  server-side (OrderItemFactory), so a bad selection here is caught before the request, not after. */
export function ModifierPickerModal({
  visible,
  menuItem,
  currency,
  onAdd,
  onCancel,
}: {
  visible: boolean;
  menuItem: MenuItemDto | null;
  currency: string;
  onAdd: (selectedModifierIds: string[], quantity: number) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [selected, setSelected] = useState<Record<string, string[]>>({}); // groupId -> modifierIds
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (visible && menuItem) {
      setSelected({});
      setQuantity(1);
    }
  }, [visible, menuItem]);

  const allValid = useMemo(() => {
    if (!menuItem) return false;
    return menuItem.modifierGroups.every((g) => {
      const count = (selected[g.id] ?? []).length;
      return count >= g.minSelect && count <= g.maxSelect;
    });
  }, [menuItem, selected]);

  if (!menuItem) return null;

  const modifierDelta = menuItem.modifierGroups
    .flatMap((g) => g.modifiers)
    .filter((m) => Object.values(selected).flat().includes(m.id))
    .reduce((sum, m) => sum + m.priceDelta, 0);
  const unitPrice = menuItem.price + modifierDelta;

  function toggle(groupId: string, modifierId: string, maxSelect: number) {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (maxSelect === 1) {
        return { ...prev, [groupId]: current.includes(modifierId) ? [] : [modifierId] };
      }
      if (current.includes(modifierId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== modifierId) };
      }
      if (current.length >= maxSelect) return prev; // at the cap, extra taps are no-ops
      return { ...prev, [groupId]: [...current, modifierId] };
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{menuItem.name}</Text>
          {menuItem.description ? <Text style={styles.description}>{menuItem.description}</Text> : null}

          <ScrollView style={styles.groupsScroll}>
            {menuItem.modifierGroups.map((group) => {
              const count = (selected[group.id] ?? []).length;
              const required = group.minSelect >= 1;
              return (
                <View key={group.id} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    {required ? <Text style={styles.requiredTag}>Required</Text> : null}
                  </View>
                  {group.modifiers
                    .filter((m) => m.isActive)
                    .map((m) => {
                      const isSelected = (selected[group.id] ?? []).includes(m.id);
                      return (
                        <Pressable key={m.id} style={styles.modifierRow} onPress={() => toggle(group.id, m.id, group.maxSelect)}>
                          <View style={[styles.checkbox, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]} />
                          <Text style={styles.modifierName}>{m.name}</Text>
                          {m.priceDelta !== 0 ? (
                            <Text style={styles.modifierDelta}>
                              {m.priceDelta > 0 ? "+" : ""}
                              {currency} {m.priceDelta.toFixed(2)}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  {required && count < group.minSelect ? (
                    <Text style={styles.groupHint}>Select at least {group.minSelect}.</Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.quantityStepper}>
              <Pressable style={styles.stepperButton} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.quantityValue}>{quantity}</Text>
              <Pressable style={styles.stepperButton} onPress={() => setQuantity((q) => q + 1)}>
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
            <Button
              label={`Add · ${currency} ${(unitPrice * quantity).toFixed(2)}`}
              disabled={!allValid}
              onPress={() => onAdd(Object.values(selected).flat(), quantity)}
              fullWidth
              style={styles.addButton}
            />
          </View>
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, maxHeight: "85%" },
    title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    description: { fontSize: fontSize.sm, color: colors.mutedForeground },

    groupsScroll: { maxHeight: 320 },
    group: { marginTop: spacing.sm },
    groupHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
    groupName: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.foreground },
    requiredTag: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.warning },
    groupHint: { fontSize: fontSize.xs, color: colors.warning, marginTop: 2 },

    modifierRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
    checkbox: { width: 18, height: 18, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border },
    modifierName: { fontSize: fontSize.base, color: colors.foreground, flex: 1 },
    modifierDelta: { fontSize: fontSize.sm, color: colors.mutedForeground },

    footer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
    quantityStepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    stepperButton: { width: 32, height: 32, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    stepperButtonText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    quantityValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground, minWidth: 20, textAlign: "center" },
    addButton: { flex: 1 },
  });
}
