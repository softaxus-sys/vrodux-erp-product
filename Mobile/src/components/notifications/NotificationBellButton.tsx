import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMyNotifications } from "@/hooks/use-notifications";
import { radius, useAppTheme } from "@/theme";

/** Rendered once as every tab's `headerRight` (see RootNavigator.tsx) so it's reachable from
 *  anywhere, the same "always-on, not a tab slot" call already made for the AI assistant. */
export function NotificationBellButton({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  const { data } = useMyNotifications();
  const unread = data?.unreadCount ?? 0;

  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.button}>
      <Feather name="bell" size={20} color={colors.foreground} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
          <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { marginRight: 12, padding: 4 },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 15,
    height: 15,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
