import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

export interface MovePickerOption {
  key: string;
  label: string;
  current?: boolean;
}

/** Touch equivalent of the web app's drag-and-drop move -- tap "..." on a card, pick a
 *  destination. Always appends (sortOrder 0 / list length) rather than offering precise
 *  positioning; the web app itself only reorders within one flat list per container, so exact
 *  drop-position precision isn't essential here. */
export function MovePickerModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: MovePickerOption[];
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {options.map((opt) => (
            <Pressable
              key={opt.key}
              style={styles.option}
              onPress={() => {
                onSelect(opt.key);
                onClose();
              }}
            >
              <Text style={[styles.optionText, opt.current && styles.optionTextCurrent]}>{opt.label}</Text>
              {opt.current ? <Feather name="check" size={16} color={colors.primary} /> : null}
            </Pressable>
          ))}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: 2 },
    title: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: spacing.sm },
    option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.borderLight },
    optionText: { fontSize: fontSize.base, color: colors.foreground },
    optionTextCurrent: { fontWeight: fontWeight.semibold, color: colors.primary },
    cancel: { paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xs },
    cancelText: { fontSize: fontSize.base, color: colors.mutedForeground, fontWeight: fontWeight.medium },
  });
}
