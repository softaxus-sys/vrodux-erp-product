import { StyleSheet, Text, View } from "react-native";
import { fontSize, fontWeight, radius, spacing, toneColors, type Tone } from "@/theme";

interface BadgeProps {
  label: string;
  tone?: Tone;
  /** Small leading dot, like the status pills across the web app (STATUS_CONFIG's `dot`). */
  dot?: boolean;
}

export function Badge({ label, tone = "neutral", dot = true }: BadgeProps) {
  const t = toneColors[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.dot }]} /> : null}
      <Text style={[styles.label, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});
