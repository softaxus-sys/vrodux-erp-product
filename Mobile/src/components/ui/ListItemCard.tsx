import { Pressable, View, StyleSheet, type ViewStyle } from "react-native";
import { colors, radius, shadow, spacing } from "@/theme";

/**
 * The pressable card shell every FlatList row across the app sits inside -- rounded, subtle
 * shadow, breathing room between rows. Replaces the old flat-divided-list-row look (a plain
 * `borderBottomWidth` list, which read as a bare web table rather than a native app). Content
 * stays screen-specific (each list's row fields differ); this only owns the chrome.
 *
 * `onPress` is optional -- a row with nowhere to navigate (e.g. a plain attendance history entry)
 * renders as a static card instead of a touch target that silently does nothing when tapped.
 */
export function ListItemCard({ onPress, children, style }: { onPress?: () => void; children: React.ReactNode; style?: ViewStyle }) {
  if (!onPress) {
    return <View style={[styles.card, style]}>{children}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm + 2,
    gap: 4,
    ...shadow,
  },
  pressed: { backgroundColor: colors.cardMuted, borderColor: colors.primaryLight },
});
