import { Pressable, StyleSheet, Text } from "react-native";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

interface ChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
}

/** Filter/status chip row item -- the pill-row pattern used across every list screen's filter bar. */
export function Chip({ label, active, onPress }: ChipProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.base, active && styles.active, pressed && styles.pressed]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    base: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.full,
      backgroundColor: colors.muted,
    },
    active: { backgroundColor: colors.primary },
    pressed: { opacity: 0.8 },
    label: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.foregroundSecondary },
    labelActive: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  });
}
