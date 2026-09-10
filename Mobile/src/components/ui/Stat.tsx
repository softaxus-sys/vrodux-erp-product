import { StyleSheet, Text, View } from "react-native";
import { colors, fontSize, fontWeight, spacing } from "@/theme";

/** Label-over-value block used in every detail header's stat row (Value/Tax/Total/etc). */
export function Stat({ label, value, tone = "default" as const }: { label: string; value: string; tone?: "default" | "primary" }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, tone === "primary" && styles.valuePrimary]}>{value}</Text>
    </View>
  );
}

/** Label/value row used in "Details" cards (Vendor phone, Tax number, etc). */
export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 72 },
  label: { fontSize: fontSize.xs, color: colors.subtleForeground, textTransform: "uppercase", letterSpacing: 0.3 },
  value: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground, marginTop: 2 },
  valuePrimary: { color: colors.primary },

  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: 5 },
  rowLabel: { fontSize: fontSize.base, color: colors.mutedForeground, flexShrink: 0 },
  rowValue: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, textAlign: "right", flexShrink: 1 },
});
