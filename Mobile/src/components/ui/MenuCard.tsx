import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fontSize, fontWeight, radius, shadow, spacing, useAppTheme, type AppColors } from "@/theme";

interface MenuCardProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  tint?: string;
}

/** The module-home "menu into sub-sections" card (HrHomeScreen/SalesHomeScreen/etc). */
export function MenuCard({ icon, title, subtitle, onPress, tint }: MenuCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const resolvedTint = tint ?? colors.primary;
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.iconTile, { backgroundColor: `${resolvedTint}1A` }]}>
        <Feather name={icon} size={20} color={resolvedTint} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.subtleForeground} />
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      ...shadow,
    },
    pressed: { backgroundColor: colors.cardMuted },
    iconTile: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    textWrap: { flex: 1 },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
    subtitle: { fontSize: fontSize.base, color: colors.mutedForeground, marginTop: 2 },
  });
}
