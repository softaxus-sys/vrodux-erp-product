import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, radius, spacing } from "@/theme";

type Variant = "primary" | "secondary" | "outline" | "destructive" | "ghost";
type Size = "sm" | "md";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  style?: ViewStyle;
  /** Grows to fill the row instead of hugging its label. */
  fullWidth?: boolean;
}

const VARIANT_STYLE: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.muted, fg: colors.foreground },
  outline: { bg: colors.transparent, fg: colors.foreground, border: colors.border },
  destructive: { bg: colors.destructive, fg: colors.onPrimary },
  ghost: { bg: colors.transparent, fg: colors.primary },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  icon,
  style,
  fullWidth,
}: ButtonProps) {
  const v = VARIANT_STYLE[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === "sm" ? styles.sm : styles.md,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? colors.transparent,
          borderWidth: v.border ? 1 : 0,
        },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={size === "sm" ? 14 : 16} color={isDisabled ? colors.subtleForeground : v.fg} /> : null}
          <Text
            style={[
              styles.label,
              size === "sm" ? styles.labelSm : styles.labelMd,
              { color: isDisabled ? colors.subtleForeground : v.fg },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs + 2,
    borderRadius: radius.md,
    alignSelf: "flex-start",
  },
  fullWidth: { alignSelf: "stretch" },
  sm: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  md: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 },
  label: { fontWeight: fontWeight.semibold },
  labelSm: { fontSize: fontSize.sm },
  labelMd: { fontSize: fontSize.base },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { backgroundColor: colors.disabled },
});
