import { StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";
import { colors, radius, shadow, spacing } from "@/theme";

interface CardProps extends ViewProps {
  /** Flat = a border, no shadow (used for list rows, dense stacks). Raised = shadow, no border
   *  (used for the one hero card at the top of a detail screen). Default = both, softly. */
  variant?: "default" | "flat" | "raised";
  padding?: keyof typeof spacing | number;
  style?: ViewStyle | ViewStyle[];
}

export function Card({ variant = "default", padding = "lg", style, children, ...rest }: CardProps) {
  const p = typeof padding === "number" ? padding : spacing[padding];
  return (
    <View
      style={[
        styles.base,
        { padding: p },
        variant === "flat" && styles.flat,
        variant === "raised" && styles.raised,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  flat: {
    shadowOpacity: 0,
    elevation: 0,
  },
  raised: {
    borderWidth: 0,
  },
});
