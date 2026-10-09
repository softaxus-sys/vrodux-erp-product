import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import type { OrderItemDto } from "@/types/restaurant";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

/** Item-level bill splitting -- every non-deleted item on the order must land in exactly one
 *  guest bucket (SplitOrderCommand's own rule). Whole-row assignment only, matching the backend:
 *  splitting a single line's quantity across guests isn't supported there either. */
export function SplitBillModal({
  visible,
  items,
  currency,
  busy,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  items: OrderItemDto[];
  currency: string;
  busy: boolean;
  errorMessage?: string | null;
  onConfirm: (groups: { itemIds: string[] }[]) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [guestCount, setGuestCount] = useState(2);
  // itemId -> guest index (0-based), or undefined if not yet assigned.
  const [assignments, setAssignments] = useState<Record<string, number>>({});

  useEffect(() => {
    if (visible) {
      setGuestCount(2);
      setAssignments({});
    }
  }, [visible]);

  const voidableItems = useMemo(() => items, [items]);
  const guestTotals = useMemo(() => {
    const totals = Array.from({ length: guestCount }, () => 0);
    for (const item of voidableItems) {
      const g = assignments[item.id];
      if (g !== undefined && g < guestCount) totals[g] += item.lineTotal;
    }
    return totals;
  }, [assignments, guestCount, voidableItems]);

  const allAssigned = voidableItems.every((i) => assignments[i.id] !== undefined && assignments[i.id] < guestCount);
  const canConfirm = allAssigned && guestCount >= 2;

  function buildGroups(): { itemIds: string[] }[] {
    const groups: string[][] = Array.from({ length: guestCount }, () => []);
    for (const item of voidableItems) {
      const g = assignments[item.id];
      if (g !== undefined) groups[g].push(item.id);
    }
    return groups.filter((g) => g.length > 0).map((itemIds) => ({ itemIds }));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Split Bill</Text>

          <View style={styles.stepperRow}>
            <Text style={styles.label}>Guests</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepperButton} onPress={() => setGuestCount((n) => Math.max(2, n - 1))}>
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{guestCount}</Text>
              <Pressable style={styles.stepperButton} onPress={() => setGuestCount((n) => Math.min(8, n + 1))}>
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.itemList}>
            {voidableItems.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.quantity}× {item.itemName}
                  </Text>
                  <Text style={styles.itemTotal}>
                    {currency} {item.lineTotal.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.guestChipRow}>
                  {Array.from({ length: guestCount }, (_, g) => g).map((g) => (
                    <Pressable
                      key={g}
                      onPress={() => setAssignments((prev) => ({ ...prev, [item.id]: g }))}
                      style={[styles.guestChip, assignments[item.id] === g && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    >
                      <Text style={[styles.guestChipText, assignments[item.id] === g && { color: colors.onPrimary }]}>{g + 1}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.totalsRow}>
            {guestTotals.map((t, g) => (
              <Text key={g} style={styles.totalChip}>
                G{g + 1}: {currency} {t.toFixed(0)}
              </Text>
            ))}
          </View>

          {!allAssigned ? <Text style={styles.hint}>Assign every item to a guest before splitting.</Text> : null}
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Button label={busy ? "..." : "Split"} disabled={busy || !canConfirm} onPress={() => onConfirm(buildGroups())} />
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
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, maxHeight: "85%" },
    title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    label: { fontSize: fontSize.sm, color: colors.mutedForeground },
    stepperRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    stepperButton: { width: 32, height: 32, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    stepperButtonText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    stepperValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground, minWidth: 24, textAlign: "center" },

    itemList: { maxHeight: 280 },
    itemRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: spacing.xs },
    itemBody: { flexDirection: "row", justifyContent: "space-between" },
    itemName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1, marginRight: spacing.sm },
    itemTotal: { fontSize: fontSize.base, color: colors.mutedForeground },
    guestChipRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
    guestChip: { width: 30, height: 30, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    guestChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },

    totalsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
    totalChip: { fontSize: fontSize.xs, color: colors.mutedForeground },
    hint: { fontSize: fontSize.sm, color: colors.warning },
    error: { fontSize: fontSize.sm, color: colors.destructive },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  });
}
