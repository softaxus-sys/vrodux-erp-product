import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, spacing } from "@/theme";

export function LoadingState({ size = "large" as const }: { size?: "small" | "large" }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size={size} color={colors.primary} />
    </View>
  );
}

export function ErrorState({ message = "Something went wrong.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <View style={styles.errorIcon}>
        <Feather name="alert-circle" size={22} color={colors.destructive} />
      </View>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  subtitle,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={22} color={colors.subtleForeground} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** For FlatList's ListEmptyComponent -- same visuals as EmptyState but without flex:1 centering,
 *  which would collapse to nothing inside a list's content container. */
export function EmptyListState(props: Parameters<typeof EmptyState>[0]) {
  return (
    <View style={styles.emptyListWrap}>
      <EmptyState {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyListWrap: { paddingTop: spacing.xxxl },

  errorIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.destructiveLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  errorText: { fontSize: fontSize.md, color: colors.foregroundSecondary, textAlign: "center" },
  retry: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.base, marginTop: spacing.xs },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, textAlign: "center" },
  emptySubtitle: { fontSize: fontSize.base, color: colors.mutedForeground, textAlign: "center" },
});
